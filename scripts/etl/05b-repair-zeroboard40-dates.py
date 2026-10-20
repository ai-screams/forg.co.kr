#!/usr/bin/env python3
"""Re-date the Zeroboard 4.0 gold posts (02f's and 02h's) with 02f's date rule.

`02f-parse-zeroboard40.py` dated a post from any list row with its number,
and failing that from the board index's row with that number. Numbers repeat
(boards numbered again, Sell starting again at 1), so posts took other
posts' dates, some after their own capture. 02f now takes a row only when
its title is the post's and it is not later than the capture
(`zb40.date_of`).

Re-parsing would undo later stages that edited the same files (image-address
rewrites), so this recomputes each post's date with `zb40.date_of` and
replaces only its top-level `"createdAt"` line, in place: no other byte
changes, and no `createdAtApprox` key is added. The list rows are read again
from every capture in `archive-clean/{Z,Y,U,T,LZ}/` (`zb40.pooled_rows`), so
a run after more list pages are decoded dates from them too. A second run
over the same captures changes nothing: the date depends only on them and
on the post's title and capture time, which this leaves alone.

Posts in scope: 02f's — a gold file whose `originalUrl` is the view
`{ORIGIN_BY_PHASE[phase]}?id={board}&no={no}` and whose capture in
`archive-clean/{phase}/` 02f reads as a post. 02e's 2001 notice, file-room
and link posts carry the same kind of address, but their captures there are
no view (02e dates them from their own list pages). A capture 02f now fails
on (as it records a failure) is counted as `unreadable` and named, and its
post left alone.

02h's posts, rebuilt from a reply form (`originalUrl` the form's,
`mode=reply`, its capture in `archive-clean/R/`), are dated by the same rule:
02h leaves a post it has made alone, so a list page decoded later reaches it
only here. 02h pools the rows of every phase but S and R; this, like 02f,
those of Z, Y, U, T and LZ. On the 13 posts 02h has made, both give the same
dates.

USAGE
    python3 scripts/etl/05b-repair-zeroboard40-dates.py [--dry-run]
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
POSTS = PROJECT_ROOT / "src" / "content" / "posts"
# The post's own date: two spaces in, where `model_dump_json(indent=2)` puts
# the top-level keys. A comment's `createdAt` sits deeper.
CREATED_AT_RE = re.compile(r'^  "createdAt": "([^"]*)",$', re.M)

sys.path.insert(0, str(HERE))
from etl_io import write_atomic  # noqa: E402

_spec = importlib.util.spec_from_file_location("zb40", HERE / "02f-parse-zeroboard40.py")
assert _spec and _spec.loader
zb40 = importlib.util.module_from_spec(_spec)
sys.modules["zb40"] = zb40
_spec.loader.exec_module(zb40)


def view_phase(post: dict, stats: Counter[str]) -> str | None:
    """The phase whose view 02f made the post from, or None when it is not
    02f's or 02f fails on its capture (counted in `stats`)."""
    for phase, origin in zb40.ORIGIN_BY_PHASE.items():
        if post["originalUrl"] != f"{origin}?id={post['board']}&no={post['postId']}":
            continue
        capture = zb40.INPUT_BASE / phase / post["board"] / f"{post['postId']}.html"
        if not capture.exists():
            return None
        try:
            zb40.parse_view(
                capture.read_text(encoding="utf-8"),
                board=post["board"],
                post_id=post["postId"],
                phase=phase,
                created_at=zb40.UNKNOWN_DATE,
                captured_at=post["capturedAt"],
                parsed_at=datetime.now(),
            )
        except zb40.NonPost:
            return None
        except (KeyError, ValueError) as e:  # 02f's failures; a ValidationError is a ValueError
            stats["unreadable"] += 1
            print(f"[05b-repair] {capture}: {type(e).__name__}: {e}"[:400], file=sys.stderr)
            return None
        return phase
    return None


def reply_form_post(post: dict) -> bool:
    """Whether 02h made the post, from a captured reply form."""
    capture = zb40.INPUT_BASE / "R" / post["board"] / f"{post['postId']}.html"
    return "mode=reply" in post["originalUrl"] and capture.exists()


def redate(raw: str, when: datetime) -> str | None:
    """`raw` with the post's `createdAt` set to `when`, or None when it
    already says so. Raises ValueError unless the line is there once."""
    found = CREATED_AT_RE.findall(raw)
    if len(found) != 1:
        raise ValueError(f"{len(found)} top-level createdAt lines")
    if datetime.fromisoformat(found[0]) == when:
        return None
    return CREATED_AT_RE.sub(lambda _: f'  "createdAt": "{when.isoformat()}",', raw)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    rows = zb40.pooled_rows()
    stats: Counter[str] = Counter()
    changes: list[tuple[str, str, str, str, str]] = []
    for f in sorted(POSTS.glob("*/*.json")):
        raw = f.read_bytes().decode("utf-8")
        post = json.loads(raw)
        if view_phase(post, stats) is None and not reply_form_post(post):
            continue
        key = (post["board"], post["postId"])
        when, how = zb40.date_of(post["title"], post["capturedAt"], rows.get(key, []))
        stats[f"posts:{how}"] += 1
        new = redate(raw, when)
        if new is None:
            continue
        stats[f"changed:{how}"] += 1
        changes.append((*key, post["createdAt"], when.isoformat(), how))
        if not args.dry_run:
            write_atomic(f, new.encode("utf-8"))
    print("board\tpostId\told\tnew\tfrom")
    for change in changes:
        print("\t".join(change))
    print(f"[05b-repair] dry_run={args.dry_run} {json.dumps(dict(sorted(stats.items())))}", file=sys.stderr)


if __name__ == "__main__":
    main()
