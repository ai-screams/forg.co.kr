#!/usr/bin/env python3
"""Repair comment (and post) authors and dates in Zeroboard 4.1 gold posts.

`02-parse-zeroboard.py` had two faults, fixed there:
  - a member's meta line starts with an empty `<a class="cmt"></a>` before the
    one holding the name, and the parser took the first → "anonymous";
  - comment times came back from `extract_meta` as ISO text and were read
    again with the Korean-date parser, which found nothing → every comment
    got the 1970 "작성일 미상" sentinel.

Re-parsing from scratch would undo later stages that edited the same files
(image-address rewrites, the emoticon store). This re-reads each post's
capture with the fixed `find_comment_fonts` / `extract_meta` and changes only
comment `author`, `authorMemberNo` and `createdAt`, plus the post's own
`author` / `authorMemberNo` where it is still "anonymous". A post whose
capture shows a different number of comments than the gold file is left
alone and reported.

Posts in scope: gold files whose `originalUrl` is a `/_zb/` view (the 02
parser's) and whose capture is in `archive-clean/{A,B,C,V}/`. Gnuboard4 posts
(`/bbs/board.php`, 02b) get the same comment-author repair: the
webbus2009_Trash skin prints the commenter without the `span.member` 02b read.

USAGE
    python3 scripts/etl/05-repair-zeroboard-meta.py [--dry-run]
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from collections import Counter
from pathlib import Path

from bs4 import BeautifulSoup

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
POSTS = PROJECT_ROOT / "src" / "content" / "posts"
CLEAN = PROJECT_ROOT / ".docs" / "research" / "archive-clean"
PHASES = ("A", "B", "C", "V")

sys.path.insert(0, str(HERE))
_spec = importlib.util.spec_from_file_location("zb41", HERE / "02-parse-zeroboard.py")
assert _spec and _spec.loader
zb41 = importlib.util.module_from_spec(_spec)
sys.modules["zb41"] = zb41
_spec.loader.exec_module(zb41)
_spec4 = importlib.util.spec_from_file_location("g4", HERE / "02b-parse-gnuboard4.py")
assert _spec4 and _spec4.loader
g4 = importlib.util.module_from_spec(_spec4)
sys.modules["g4"] = g4
_spec4.loader.exec_module(g4)


def capture_of(board: str, post_id: str) -> Path | None:
    for phase in PHASES:
        f = CLEAN / phase / board / f"{post_id}.html"
        if f.exists():
            return f
    return None


def repair(post: dict, html: str, stats: Counter) -> bool:
    """Update `post` in place; True when anything changed."""
    soup = BeautifulSoup(html, "lxml")
    changed = False
    metas = [zb41.extract_meta(f) for f in zb41.find_comment_fonts(soup)]
    comments = post["comments"]
    if len(metas) != len(comments):
        stats["comment_count_mismatch"] += 1
    else:
        for c, m in zip(comments, metas):
            if m["author"] and c["author"] == "anonymous":
                c["author"] = m["author"]
                changed = True
                stats["comment_author"] += 1
            if m["member_no"] and not c.get("authorMemberNo"):
                c["authorMemberNo"] = m["member_no"]
                changed = True
            if m["created_at"] and c["createdAt"].startswith("1970"):
                c["createdAt"] = m["created_at"]
                changed = True
                stats["comment_date"] += 1
    if post["author"] == "anonymous":
        meta_font = zb41.find_meta_font(soup)
        m = zb41.extract_meta(meta_font) if meta_font else {}
        if m.get("author"):
            post["author"] = m["author"]
            if m.get("member_no") and not post.get("authorMemberNo"):
                post["authorMemberNo"] = m["member_no"]
            changed = True
            stats["post_author"] += 1
    return changed


def repair_g4(post: dict, html: str, stats: Counter) -> bool:
    fresh = g4.find_comments(BeautifulSoup(html, "lxml"), post["capturedAt"])
    comments = post["comments"]
    if len(fresh) != len(comments):
        stats["g4_comment_count_mismatch"] += 1
        return False
    changed = False
    for c, f in zip(comments, fresh):
        if c["author"] == "anonymous" and f.author != "anonymous":
            c["author"] = f.author
            changed = True
            stats["g4_comment_author"] += 1
    return changed


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    stats: Counter[str] = Counter()
    for f in sorted(POSTS.glob("*/*.json")):
        raw = f.read_text(encoding="utf-8")
        post = json.loads(raw)
        engine, url = post.get("sourceEngine"), post.get("originalUrl", "")
        if engine == "zeroboard" and "/_zb/" in url:
            fix = repair
        elif engine == "gnuboard4" and "/bbs/board.php" in url:
            fix = repair_g4
        else:
            continue
        cap = capture_of(post["board"], post["postId"])
        if cap is None:
            stats["no_capture"] += 1
            continue
        stats["posts"] += 1
        if fix(post, cap.read_text(encoding="utf-8"), stats):
            stats["files_changed"] += 1
            if not args.dry_run:
                f.write_text(json.dumps(post, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[05-repair] {json.dumps(dict(stats))}", file=sys.stderr)


if __name__ == "__main__":
    main()
