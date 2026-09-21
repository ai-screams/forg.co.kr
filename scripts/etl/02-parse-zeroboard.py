#!/usr/bin/env python3
"""ETL Stage 2 — Zeroboard 4.1pl4 (kritz_normal skin) HTML → Post JSON.

Reads UTF-8 HTML from `.docs/research/archive-clean/A/{board}/{id}.html`
(Stage 1 output, ADR-0007) and emits validated JSON to
`src/content/posts/{board}/{post_id}.json` (ADR-0004, ADR-0008).

Implements the selectors documented in ADR-0008 §4. nh3 sanitises the
body and comments using the vintage-friendly whitelist (font/center kept
on purpose). Pydantic v2 validates every record before it touches disk.

USAGE:
    python3 scripts/etl/02-parse-zeroboard.py [options]

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
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import cast
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup, Tag
from pydantic import ValidationError

# Make schemas.py importable when this script is run directly.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sanitise import sanitise_html  # noqa: E402
from schemas import Attachment, Comment, Post  # noqa: E402

# ── Paths ───────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
# INPUT_BASE walks both archive-clean/A (Phase A) and archive-clean/B
# (Phase B, downloaded after the initial 11k pass) so a single --force
# run regenerates every Zeroboard board's gold tier in one pass.
INPUT_BASE = PROJECT_ROOT / ".docs" / "research" / "archive-clean"
OUTPUT_DIR = PROJECT_ROOT / "src" / "content" / "posts"
FAILURES_FILE = PROJECT_ROOT / "scripts" / "etl" / ".parse-failures.jsonl"
SUMMARY_FILE = PROJECT_ROOT / "scripts" / "etl" / ".parse-summary.json"

# Wayback timestamp sources (ADR-0010 §Decision #7).
# 1차: the canonical CDX plan we downloaded from. 2차: the downloader's
# per-file progress log — fills any gap left by manual plan edits.
PLAN_FILE = PROJECT_ROOT / ".docs" / "research" / "cdx" / "e-policy-plan.json"
PROGRESS_FILE = PROJECT_ROOT / ".docs" / "research" / "archive" / ".progress.jsonl"

# Boards parsed by a different engine. Listed explicitly so wrong-engine
# captures never reach the Zeroboard selectors silently.
#
# UoBoard2 / Console: Gnuboard4 webbus2009_basic — `02b` parser.
# Shop is NOT excluded: 8 of its 10 captures are webbus2009 (`02b`), but
# `Shop/180` is a kritz_normal2 Member-Trade page and lost its only parser
# here (collection audit 2026-09-19, G4). Skin detection routes it.
# Ultima (capitalised): Gnuboard5 theme/st-basic — ROADMAP P2.3 (not the
# forg.kr lowercase `ultima`, which is a different g5 board on the
# forg.kr successor site).
# Boo / DF / LoL / Star2 / Diablo: zero bronze files; placeholder-only.
#
# FunBoard / porato / Reveal / Trash are NOT excluded — they use Zeroboard
# 4.1's kritz_normal / kritz_normal2 / kritz_trash skins which share the
# same `title_bg.jpg` table + `write by`/`comment by` meta fonts as the
# default A-tier skin. The 47 + 21 webbus2009_basic captures mixed into
# those boards skip via `_skin_other` in `detect_non_post_page` and route
# to `02b` via its INCLUDE_BOARDS instead.
EXCLUDE_BOARDS: frozenset[str] = frozenset({
    # Gnuboard4 (P2.2 — handled by 02b parser)
    "UoBoard2", "Console",
    # No bronze data (placeholder-only)
    "Boo", "Diablo", "DF", "LoL", "Star2",
    # Gnuboard5 — forg.co.kr Ultima board
    "Ultima",
    # Gnuboard5 — forg.kr successor site (P2.3)
    # NOTE: case-sensitive — `ultima` (lowercase) is forg.kr,
    # `Ultima` (capitalised) is forg.co.kr.
    "aseeee", "dataaa", "free", "gonggg", "humorrr",
    "notice", "qnaaa", "screee", "trtrtr", "ultima",
})

# ── Era assignment ──────────────────────────────────────────────────────
# Posts authored before 2011 lived under the frameset/Zeroboard era;
# posts from 2011 onwards under the Gnuboard4 redesign.
ERA_BREAKPOINT = datetime(2011, 1, 1)


# ── Non-post page detection ────────────────────────────────────────────-
# Some Wayback captures landed on Zeroboard pages that were never the
# requested post: the post had been deleted before capture time, the server
# was returning a DB error, the URL was a plugin redirect, or the capture
# only contains the Zeroboard licence boilerplate. None of these contain
# extractable content; the parser classifies them as `skipped_no_content`
# rather than treating them as parse failures.
_NON_POST_MARKERS: tuple[tuple[str, str], ...] = (
    ("선택하신 게시물이 존재하지 않습니다", "deleted_before_capture"),
    ("DB 접속시 에러가 발생했습니다", "db_error_at_capture"),
    ("사용권한이 없습니다", "permission_denied"),
    ("plugin_download", "plugin_redirect"),
)

# Wrong-engine skin markers — these route to a different parser, not us.
# Each captures the substring that uniquely identifies the foreign skin.
_FOREIGN_SKIN_MARKERS: tuple[tuple[str, str], ...] = (
    # Gnuboard4 webbus2009_basic / webbus2009_Trash — `02b-parse-gnuboard4.py`
    ("webbus2009_basic", "skin_gnuboard4_webbus"),
    ("webbus2009_Trash", "skin_gnuboard4_webbus"),
    # Gnuboard5 theme — ROADMAP P2.3
    ("theme/st-basic", "skin_gnuboard5"),
)

# Buzzard skin — calendar-style Zeroboard skin used by `events_date`. Posts are
# dated calendar entries with no explicit title or author (write-time only had
# a date subject and anonymous body). Routed to `parse_buzzard_post` below.
_BUZZARD_SKIN_MARKER: str = "skin/buzzard/"


def detect_non_post_page(html: str) -> str | None:
    """Return a reason string if this is not a real post, else None."""
    for marker, reason in _NON_POST_MARKERS:
        if marker in html:
            return reason
    for marker, reason in _FOREIGN_SKIN_MARKERS:
        if marker in html:
            return reason
    # Last-ditch: a capture that is essentially only the Zeroboard licence
    # comment plus a stub <html> body. Real posts are >> 2 KB after cleanup
    # and contain a `title_bg.jpg` table.
    if len(html) < 4000 and "title_bg.jpg" not in html:
        return "license_only_stub"
    return None


class _NonPostPage(Exception):
    """Raised when a capture is structurally a Zeroboard page but not a post."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


# ── Korean date parser ──────────────────────────────────────────────────
_KOREAN_DATETIME_RE = re.compile(
    r"(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2})시\s*(\d{1,2})분\s*(\d{1,2})초"
)
_DATE_ONLY_RE = re.compile(r"(\d{4})/(\d{1,2})/(\d{1,2})")


def parse_korean_datetime(text: str) -> datetime | None:
    """Prefer the second-precision title text, fall back to the visible date."""
    m = _KOREAN_DATETIME_RE.search(text)
    if m:
        y, mo, d, h, mi, s = (int(x) for x in m.groups())
        return datetime(y, mo, d, h, mi, s)
    m2 = _DATE_ONLY_RE.search(text)
    if m2:
        y, mo, d = (int(x) for x in m2.groups())
        return datetime(y, mo, d)
    return None


    sys.exit(1 if (stats.failed_parse + stats.failed_validate) > 0 else 0)


if __name__ == "__main__":
    main()
