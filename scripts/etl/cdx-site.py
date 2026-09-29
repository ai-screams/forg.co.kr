#!/usr/bin/env python3
"""CDX sweep for forg's static sections — the pages outside the boards.

Besides the boards, forg.co.kr carried hand-written guide pages: skills
(`/skill/`, `/skill_knowhow/`, `/skill_index/`, `/skill_newbie/`), dungeons,
maps, spotlights, crafting, Diablo II, and the root frame set. This asks
Wayback once per host for every 200 text/html capture outside the board
scripts and writes a download plan with one entry per (page, digest), so a
page that changed over the years keeps each version.

Dropped before planning:
  - board paths (`_zb`, `zboard`, `zb`, `bbs`, `~forg`) — the post phases own them —
    except the plain pages under `_zb/` the 2003 left menu opened: the guild
    directory, the vendor list and the poll (`kritz_vote/`) — and the 2001
    poll board `UO_Vote`, whose vote skin prints a poll and its comments as a
    page of its own. The member list (`forg_member.php`) is left out: its one
    capture is an error page
  - other users' home directories on a shared host (`forg.uospace.net/~sirl/`)
  - image/binary extensions: Wayback labels a missing image's error page
    text/html, so those rows are the host's error page, not a page
  - the host's error page itself, recognised by its digest (4,137 captures)

Plan entry (phase S): board = first path segment (`_root` for the top level),
post_id = rest of the path, made filesystem-safe, plus `~{timestamp}`.

USAGE
    python3 scripts/etl/cdx-site.py            # writes .docs/research/cdx/site-plan.json
    python3 scripts/etl/download.py --phase S --plan .docs/research/cdx/site-plan.json
"""
from __future__ import annotations

import json
import re
import sys
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from wayback_client import fetch_with_retry, global_polite_slot  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent / ".docs" / "research" / "cdx"
RAW = ROOT / "site-html.json"
PLAN = ROOT / "site-plan.json"

HOSTS = ("forg.co.kr", "forg.dotple.com", "forg.uospace.net")
# forg's home directory on its earlier host (2002–2003): the same site under
# `/~forg/`, so its pages join forg.co.kr's at the same paths. The 2003 menu's
# "UO.만화" opened `/~forg/lomo/` there.
MIRRORS: dict[tuple[str, str], str] = {
    ("hosting27.interpia98.net", "/~forg/"): "/",
}
BOARD_PATHS = (
    r".*/(~[^/]+/|bbs/|_zb/(?!guild/|vendor/|kritz_vote/)"
    r"|(zboard|zb)/(?!(zboard|view|apply_vote)\.php\?([^#]*&)?id=UO_Vote(&|#|$))).*"
)
ERROR_PAGE_DIGESTS = {"YJ5BLWSK5YU6LWI7FRNUGUOJEJBD4K6Q"}
BINARY_RE = re.compile(r"\.(gif|jpe?g|png|bmp|zip|exe|swf|mid|wav|css|js|txt)$", re.I)
SESSION_RE = re.compile(r"(^|&)PHPSESSID=[0-9a-f]+")
# Form screens (log in, sign up, write) the poll board's links reach: no content.
FORM_RE = re.compile(r"/(login|member_join|write|member_modify)\.php$")


def cdx_rows(prefix: str, *, board_filter: bool = True) -> list[list[str]]:
    """`board_filter` drops the board scripts; a mirrored folder has none, and
    its own path (`/~forg/…`) would match the old board path pattern."""
    params = [
        ("url", prefix),
        ("matchType", "prefix"),
        ("fl", "timestamp,original,statuscode,mimetype,length,digest"),
        ("filter", "statuscode:200"),
        ("filter", "mimetype:text/html"),
        ("output", "json"),
    ]
    if board_filter:
        params.insert(-1, ("filter", f"!original:{BOARD_PATHS}"))
    url = "https://web.archive.org/cdx/search/cdx?" + urllib.parse.urlencode(params)
    with global_polite_slot():
        body = fetch_with_retry(url)
    rows = json.loads(body) if body.strip() else []
    return rows[1:]


def mirror_path(host: str, path: str) -> str | None:
    """The museum path of a mirrored folder's URL, or None if not mirrored."""
    for (m_host, prefix), local in MIRRORS.items():
        if host == m_host and path.startswith(prefix):
            return local + path[len(prefix):]
    return None


def page_key(original: str) -> str:
    """Path plus query, without host, port or session id; mirrored folders
    take their museum path."""
    s = urllib.parse.urlsplit(original)
    query = SESSION_RE.sub("", s.query).strip("&")
    host = (s.hostname or "").lower().removeprefix("www.")
    path = mirror_path(host, s.path) or s.path
    return path + (f"?{query}" if query else "")


def safe(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", s) or "index"


def main() -> None:
    rows: list[list[str]] = []
    prefixes = [(f"{host}/", True) for host in HOSTS] + [(h + p, False) for h, p in MIRRORS]
    for prefix, board_filter in prefixes:
        got = cdx_rows(prefix, board_filter=board_filter)
        print(f"[cdx-site] {prefix}: {len(got)} rows", file=sys.stderr)
        rows += got
    RAW.write_text(json.dumps(rows, ensure_ascii=False))

    versions: dict[str, dict[str, list[str]]] = {}
    for row in sorted(rows):  # oldest capture of each digest wins
        ts, original, _st, _mt, _length, digest = row
        key = page_key(original)
        path = urllib.parse.urlsplit(key).path
        if digest in ERROR_PAGE_DIGESTS or BINARY_RE.search(path) or FORM_RE.search(path):
            continue
        versions.setdefault(key, {}).setdefault(digest, row)

    plan = []
    for key, by_digest in sorted(versions.items()):
        path = key.lstrip("/")
        section, _, rest = path.partition("/")
        if not rest:
            section, rest = "_root", path
        for ts, original, _st, _mt, length, digest in by_digest.values():
            plan.append({
                "era": "site",
                "board": safe(section),
                "post_id": f"{safe(rest)}~{ts}",
                "phase": "S",
                "ts": ts,
                "url": original,
                "page": key,
                "length": int(length),
                "digest": digest,
            })
    PLAN.write_text(json.dumps(plan, ensure_ascii=False, indent=1))
    print(f"[cdx-site] pages={len(versions)} versions={len(plan)} → {PLAN}", file=sys.stderr)


if __name__ == "__main__":
    main()
