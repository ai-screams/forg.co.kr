#!/usr/bin/env python3
"""ETL Stage 2d — Gnuboard5 `st-basic` skin HTML → Post JSON.

Handles:
  - forg.co.kr `Ultima` board (G5 era, 24 posts in plan)
  - forg.kr 10 successor-site boards: `ultima` · `aseeee` · `dataaa`
    `free` · `gonggg` · `humorrr` · `notice` · `qnaaa` · `screee`
    · `trtrtr`  (66 posts total in plan)

Both sites use the **st-basic** theme, NOT the documented `bo_v_atc`
basic skin. Anchors:
  - `<section id="st-view">` wraps the post
  - `h4.subject` carries the title (+ `[N]` comment-count suffix)
  - `div.desc strong:nth-of-type(1..4)` is the meta line:
       [author, "YYYY-MM-DD HH:MM:SS", hits, comments_count]
  - `article.text` is the post body
  - `<section id="st-comment"> article[id^="c_"]` are comments

Origin disambiguation: APFS is case-insensitive so the forg.co.kr
`Ultima` and forg.kr `ultima` bronze files share one inode. The
`e-policy-plan.json` `board` field preserves the original case, so
we look each post up by `post_id` to decide the gold-tier board id.

forg.kr boards land at `src/content/posts/kr_{board}/{post}.json` to
avoid case collisions with forg.co.kr's Notice/Ultima. forg.co.kr
Ultima keeps `Ultima/` (no other case variant exists for it).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import cast

from bs4 import BeautifulSoup, Tag
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sanitise import sanitise_html  # noqa: E402
from schemas import Attachment, Comment, Post  # noqa: E402

# ── Paths ───────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
INPUT_BASE = PROJECT_ROOT / ".docs" / "research" / "archive-clean"
OUTPUT_DIR = PROJECT_ROOT / "src" / "content" / "posts"
FAILURES_FILE = PROJECT_ROOT / "scripts" / "etl" / ".parse-failures-g5.jsonl"
SUMMARY_FILE = PROJECT_ROOT / "scripts" / "etl" / ".parse-summary-g5.json"

PLAN_FILE = PROJECT_ROOT / ".docs" / "research" / "cdx" / "e-policy-plan.json"
PROGRESS_FILE = PROJECT_ROOT / ".docs" / "research" / "archive" / ".progress.jsonl"

# Case-insensitive directory names this parser walks. The plan resolves
# original case (forg.co.kr `Ultima` vs forg.kr `ultima`).
INCLUDE_BOARDS_CI: frozenset[str] = frozenset({
    "ultima",  # case-collides with forg.co.kr Ultima
    "aseeee", "dataaa", "free", "gonggg", "humorrr",
    "notice",  # case-collides with forg.co.kr Notice
    "qnaaa", "screee", "trtrtr",
})

# All G5 captures are from 2019+ → post-2011 → 2014 era.
ERA: str = "2014"


# ── Plan-based origin disambiguation ────────────────────────────────────
def load_plan_lookup() -> dict[tuple[str, str], str]:
    """Return `(board_ci, post_id) -> original_plan_board`.

    The plan keeps the exact case forg.co.kr / forg.kr used. We key
    by lowercase board name so the case-collided pairs share the same
    bucket and we can look up the right origin per post.
    """
    if not PLAN_FILE.exists():
        sys.exit(f"FATAL: plan file not found: {PLAN_FILE}")
    plan = json.loads(PLAN_FILE.read_text(encoding="utf-8"))
    lookup: dict[tuple[str, str], str] = {}
    for entry in plan:
        board = entry.get("board")
        post_id = entry.get("post_id")
        if not (isinstance(board, str) and isinstance(post_id, str)):
            continue
        lookup[(board.lower(), post_id)] = board
    return lookup


def load_capture_lookup() -> dict[tuple[str, str], str]:
    """Return `(board_ci, post_id) -> wayback_ts` from plan + progress."""
    lookup: dict[tuple[str, str], str] = {}
    if PLAN_FILE.exists():
        plan = json.loads(PLAN_FILE.read_text(encoding="utf-8"))
        for entry in plan:
            b, p, ts = entry.get("board"), entry.get("post_id"), entry.get("ts")
            if isinstance(b, str) and isinstance(p, str) and isinstance(ts, str):
                lookup[(b.lower(), p)] = ts
    if PROGRESS_FILE.exists():
        with PROGRESS_FILE.open() as f:
            for line in f:
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                b = entry.get("board")
                p = entry.get("post_id")
                ts = entry.get("ts")
                if isinstance(b, str) and isinstance(p, str) and isinstance(ts, str):
                    lookup.setdefault((b.lower(), p), ts)
    return lookup


def map_output_board(plan_board: str) -> str:
    """Map a plan-board name to a gold-tier directory id.

    forg.co.kr Ultima keeps its name. Every other entry comes from
    forg.kr and gets a `kr_` prefix so case-insensitive APFS can't
    collide its content with forg.co.kr posts.
    """
    if plan_board == "Ultima":
        return "Ultima"
    return f"kr_{plan_board}"


# ── Non-post page detection ─────────────────────────────────────────────
_NON_POST_MARKERS: tuple[tuple[str, str], ...] = (
    ("선택하신 게시물이 존재하지 않습니다", "deleted_before_capture"),
    ("글이 존재하지 않습니다", "deleted_before_capture"),
    ("글이 삭제되었거나 이동된 경우입니다", "deleted_before_capture"),
    ("접근 권한이 없으므로 글읽기가 불가합니다", "permission_denied"),
    ("글을 읽을 권한이 없습니다", "permission_denied"),
    ("목록을 볼 권한이 없습니다", "permission_denied"),
    ("존재하지 않는 게시판입니다", "board_not_found"),
    ("비회원은 이 게시판에 접근할 권한이 없습니다", "members_only"),
)


def detect_non_post_page(soup: BeautifulSoup, html: str) -> str | None:
    for marker, reason in _NON_POST_MARKERS:
        if marker in html:
            return reason
    if soup.find(id="st-view") is None:
        return "g5_skin_unsupported"
    return None


class _NonPostPage(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason




if __name__ == "__main__":
    main()
