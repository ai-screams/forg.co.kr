#!/usr/bin/env python3
"""Add the comments a later capture of a post shows and the museum's copy lacks.

`e-policy-plan.json` downloaded one capture per post, and comments kept
coming after it was taken. Phase `W` (`cdx/alt-captures-plan.json`,
`cdx/later-captures-plan.json`, `download.py --phase W`, `01-decode.py`)
fetched the newest other capture of each post as
`archive-clean/W/{board}/{no}~{ts}.html`. This parses it with the post's own
parser and appends the comments that are new.

MATCHING
    A comment is the same comment when its text matches, counted: a text the
    museum has once and the later capture twice adds one comment. Neither
    the author nor the time is part of the match. forg's Zeroboard showed a
    non-member's comment under a different random name on each view
    (Newbie 490: "Nebirots" in one capture, "Molech" in the next), and
    Gnuboard4 prints a comment's time without its year, which each parse
    takes from its own capture date (Reveal 2625's comments come out a year
    apart). Text is compared with tags dropped and entities decoded
    (`D&amp;D` and `D&D` are one comment).

    Nothing already in a post is removed or edited, so a later capture that
    shows fewer comments (most are truncated pages) adds nothing. The post's
    body, title and capture date stay those of the capture it was parsed from.

NEW COMMENTS
    Appended after the existing ones: every one the later captures hold is
    newer than the post's last comment (45 of 45 on 2026-10-02). Their images are rewritten the way Phase F leaves a post:
    an emoticon points at the shared store (`/img/emoticon/{file}`) when the
    file is there, any other image gets the missing-image placeholder with
    the original URL in `data-original-src`.

Re-parsing a post from scratch would undo the image rewrites and the
emoticon store (`.claude/rules/etl.md`), hence a merge, like
`05-repair-zeroboard-meta.py`.

USAGE
    python3 scripts/etl/06-merge-later-comments.py [--dry-run]
"""
from __future__ import annotations

import argparse
import html
import importlib.util
import json
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin

from bs4 import BeautifulSoup

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
CDX = PROJECT_ROOT / ".docs" / "research" / "cdx"
CLEAN_W = PROJECT_ROOT / ".docs" / "research" / "archive-clean" / "W"
POSTS = PROJECT_ROOT / "src" / "content" / "posts"
EMOTICON_STORE = PROJECT_ROOT / "public" / "img" / "emoticon"
PLANS = ("alt-captures-plan.json", "later-captures-plan.json")

sys.path.insert(0, str(HERE))


def _load(name: str, file: str):
    spec = importlib.util.spec_from_file_location(name, HERE / file)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


zb41 = _load("zb41", "02-parse-zeroboard.py")
g4 = _load("g4", "02b-parse-gnuboard4.py")
g5 = _load("g5", "02d-parse-gnuboard5.py")
phase_f = _load("phase_f", "04-rewrite-image-urls.py")


def text_of(body_html: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", body_html))).strip()


def parse_capture(entry: dict, html: str):
    no = entry["post_id"].split("~")[0]
    if entry["era"] == "g5":
        return g5.parse_one(entry["board"], no, html, entry["ts"], datetime.now())
    if entry["era"] == "g4":
        return g4.parse_one(html, board=entry["board"], post_id=no,
                            captured_at=entry["ts"], parsed_at=datetime.now())
    # Every Zeroboard entry is a 4.1 `/_zb/` view: no post on the 4.0 paths
    # (02f) has a later capture.
    return zb41.parse_one(html, board=entry["board"], post_id=no,
                          captured_at=entry["ts"], parsed_at=datetime.now())


def rewrite_images(body_html: str, base_url: str, stats: Counter) -> str:
    soup = BeautifulSoup(body_html, "lxml")
    for img in soup.find_all("img"):
        src = (img.get("src") or "").strip()
        if not src:
            continue
        absolute = urljoin(base_url, src)
        name = absolute.rsplit("/", 1)[-1]
        if "/emoticon/" in absolute and (EMOTICON_STORE / name).is_file():
            img["src"] = f"/img/emoticon/{name}"
            img["data-recovery"] = "ok"
            stats["emoticon"] += 1
        else:
            img["src"] = phase_f.PLACEHOLDER_REL_URL
            img["data-recovery"] = "failed"
            img["title"] = phase_f.short_title_for_failed(absolute)
            stats["image_placeholder"] += 1
        img["data-original-src"] = absolute
    return soup.body.decode_contents() if soup.body else str(soup)


def merge(post: dict, later, base_url: str, stats: Counter) -> int:
    have = Counter(text_of(c["bodyHtml"]) for c in post["comments"])
    added = []
    for c in later.comments:
        d = c.model_dump(mode="json")
        text = text_of(d["bodyHtml"])
        if have[text] > 0:
            have[text] -= 1
            continue
        d["bodyHtml"] = rewrite_images(d["bodyHtml"], base_url, stats)
        added.append(d)
    post["comments"] += added
    return len(added)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    stats: Counter[str] = Counter()
    entries = [e for p in PLANS if (CDX / p).exists() for e in json.loads((CDX / p).read_text())]
    for e in entries:
        no = e["post_id"].split("~")[0]
        gold = POSTS / e["board"] / f"{no}.json"
        src = CLEAN_W / e["board"] / f"{e['post_id']}.html"
        if not gold.exists() or not src.exists():
            continue
        stats["captures"] += 1
        try:
            later = parse_capture(e, src.read_text(encoding="utf-8"))
        except (zb41._NonPostPage, g4._NonPostPage, g5._NonPostPage, ValueError) as err:
            # permission / deleted / DB-error pages, or a meta line with no date
            stats[f"not_a_post:{err}"] += 1
            continue
        post = json.loads(gold.read_text(encoding="utf-8"))
        n = merge(post, later, e["url"], stats)
        if n:
            stats["posts_changed"] += 1
            stats["comments_added"] += n
            if not args.dry_run:
                gold.write_text(json.dumps(post, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[06-merge] {json.dumps(dict(stats))}", file=sys.stderr)


if __name__ == "__main__":
    main()
