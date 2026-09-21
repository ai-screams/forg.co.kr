#!/usr/bin/env python3
"""ETL Stage 2b — Gnuboard4 (webbus2009_basic skin) HTML → Post JSON.

Reads UTF-8 HTML from `.docs/research/archive-clean/A/{board}/{id}.html`
(Stage 1 output, ADR-0007) and emits validated JSON to
`src/content/posts/{board}/{post_id}.json` (ADR-0004, ADR-0008).

Handles forg.co.kr's custom webbus2009_basic Gnuboard4 skin. The canonical
Gnuboard4 selectors (#bo_v_atc, .view_h1, .view_info) are NOT present; this
parser uses the skin-specific selectors documented below.

Helpers (load_wayback_ts_index, sanitise_html, etc.) are copied from
02-parse-zeroboard.py rather than extracted to a shared module — the
duplicate is <60 lines and avoids blast-radius risk while both parsers
are evolving. If a third engine arrives, extract then.

SELECTOR INVENTORY (webbus2009_basic skin):
    Title  : <div style="...font-weight:bold; word-break:break-all;">
              inside the <!-- 게시글 보기 시작 --> block
    Author : <span class="gray6s"><strong>{name}</strong></span>
              immediately after <span class="gray8s">작성자:</span>
    Hits   : <span class="gray8s"><strong>{n}</strong></span>
              inside "조회 :" div
    Body   : <span id="writeContents">…</span>
    Date   : Board listing table (below the post body) — find the <a> whose
              href contains wr_id={post_id}, read the sibling date cell.
              Format: YYYY-MM-DD (time part absent → midnight used).
    Comments: <div id="commentContents"> containing <a name="c_{id}"> anchors.
              Per-comment author in <span class="member">, date in right-side
              <span> as "MM-DD HH:mm". Year derived from Wayback capture ts.
              Body in <td colspan="2" style="padding:5px..."><font class="12font">.
    Attachments: No download.php links found in UoBoard2 sample; attachments=[]
              shipped for Phase A. Pattern would be <a href*="download.php">.

INCLUDE_BOARDS allowlist prevents accidental cross-engine parsing:
    UoBoard2, Reveal, Trash, Console, Shop, Ultima, DF, LoL, Star2, Diablo

USAGE:
    python3 scripts/etl/02b-parse-gnuboard4.py [options]

OPTIONS:
    --limit N          process only the first N files
    --force            overwrite already-parsed JSON
    --dry-run          do not write JSON (still validates)
    --board BOARD      restrict to one board id
    --print-every N    progress cadence (default 50)
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

from bs4 import BeautifulSoup, Tag
from pydantic import ValidationError

# Make schemas.py importable when this script is run directly.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sanitise import sanitise_html  # noqa: E402
from schemas import Attachment, Comment, Post  # noqa: E402

# ── Paths ───────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
INPUT_BASE = PROJECT_ROOT / ".docs" / "research" / "archive-clean"
OUTPUT_DIR = PROJECT_ROOT / "src" / "content" / "posts"
FAILURES_FILE = PROJECT_ROOT / "scripts" / "etl" / ".parse-failures-g4.jsonl"
SUMMARY_FILE = PROJECT_ROOT / "scripts" / "etl" / ".parse-summary-g4.json"

# Wayback timestamp sources (ADR-0010 §Decision #7).
PLAN_FILE = PROJECT_ROOT / ".docs" / "research" / "cdx" / "e-policy-plan.json"
PROGRESS_FILE = PROJECT_ROOT / ".docs" / "research" / "archive" / ".progress.jsonl"

# Boards using the Gnuboard4 webbus2009_basic skin (the only G4 skin this
# parser supports — it relies on the "게시글 보기 시작" landmark comment
# and `gray6s`/`gray8s` meta classes).
#
# Verified by inspecting the skin markers in archive-clean/{A,B}/{board}/*.html:
#   - UoBoard2 (Phase A, 23 files)         — pure webbus2009_basic
#   - Shop     (Phase B, 10 files)          — pure webbus2009_basic
#   - Console  (Phase B, 8 files)           — pure webbus2009_basic
#   - FunBoard (Phase B, 576 files)         — 47 webbus2009_basic mixed
#                                              with 529 zb kritz_normal*
#   - porato   (Phase B, 243 files)         — webbus2009 mix with kritz_normal
#   - Reveal   (Phase B, 33 files)          — webbus2009 mix with kritz_normal
#   - Trash    (Phase B, 207 files)         — 21 webbus2009_Trash mixed
#                                              with 186 zb kritz_trash
#
# `detect_non_post_page` returns `g4_skin_unsupported` for the kritz
# (Zeroboard 4.1) captures inside these boards so this parser writes
# only the webbus2009 G4 posts. The Zeroboard parser (`02-parse-zeroboard.py`)
# handles the kritz captures from the same source files (no output
# collision because each parser checks skin before writing).
#
# Other Phase B boards still deferred:
#   - Ultima (Phase B, 33 files) → forg.co.kr Gnuboard5 (theme/st-basic),
#     ROADMAP P2.3 (forg.co.kr Ultima parser pair to forg.kr g5 parser).
#   - DF / LoL / Star2 / Diablo / Boo → no bronze data; placeholder-only.
INCLUDE_BOARDS: frozenset[str] = frozenset({
    "UoBoard2",  # Phase A
    "Shop", "Console",  # Phase B — pure webbus2009_basic
    "FunBoard", "porato", "Reveal",  # Phase B — webbus2009_basic mixed with kritz_normal
    "Trash",  # Phase B — webbus2009_Trash mixed with kritz_trash
    # Phase B — forg.co.kr `Ultima` is Gnuboard4 webbus (not G5 as originally
    # presumed). 33 files in the case-collided `Ultima/ultima` dir split:
    #   - 19 forg.co.kr posts have `<!-- 게시글 보기 시작 -->` → parsed here
    #   - 5 forg.co.kr posts are "글이 존재하지 않습니다" JS redirects → skipped
    #   - 9 forg.kr `ultima` posts use Gnuboard5 theme/st-basic → routed
    #     to 02d-parse-gnuboard5.py via skin landmark mismatch
    "Ultima",
})

# All G4 boards are post-2011 (Gnuboard4 era, redesign ~2011).
ERA: str = "2014"


# ── Non-post page detection ─────────────────────────────────────────────
_NON_POST_MARKERS: tuple[tuple[str, str], ...] = (
    ("선택하신 게시물이 존재하지 않습니다", "deleted_before_capture"),
    ("DB 접속시 에러가 발생했습니다", "db_error_at_capture"),
    ("사용권한이 없습니다", "permission_denied"),
    ("게시글 보기 시작", ""),  # sentinel — real posts have this marker
)


def detect_non_post_page(html: str) -> str | None:
    """Return a reason string if this is not a real post, else None."""
    if not html.strip():
        return "empty_file"
    for marker, reason in _NON_POST_MARKERS[:-1]:
        if marker in html:
            return reason
    # Real posts contain the skin's landmark comment.
    if "게시글 보기 시작" not in html:
        return "g4_skin_unsupported"
    return None


class _NonPostPage(Exception):
    """Raised when a capture is not a parseable G4 post."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


    sys.exit(1 if (stats.failed_parse + stats.failed_validate) > 0 else 0)


if __name__ == "__main__":
    main()
