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


# ── nh3 sanitiser (ADR-0008 §5) — one config in `sanitise.py` ──────────
from sanitise import sanitise_html  # noqa: E402


# ── Selectors ──────────────────────────────────────────────────────────-


def find_title(soup: BeautifulSoup) -> str | None:
    """Title sits in a <table> whose style references title_bg.jpg."""
    for table in soup.find_all("table"):
        if not isinstance(table, Tag):
            continue
        style = table.get("style", "")
        if isinstance(style, str) and "title_bg.jpg" in style:
            for td in table.find_all("td"):
                if not isinstance(td, Tag):
                    continue
                if td.get("align") == "left":
                    bold = td.find("b")
                    if bold:
                        return bold.get_text(strip=True)
                    return td.get_text(strip=True)
    return None


_CATEGORY_PREFIX_RE = re.compile(r"^\s*\[\s*([^\[\]]{1,12})\s*\]\s*(.*)$", re.S)


def split_category_prefix(raw_title: str) -> tuple[str | None, str]:
    """Extract a leading `[xxx]` category marker from a Zeroboard title.

    Zeroboard posters routinely prepend a Korean tag like `[질문]`, `[자료]`,
    `[공지]`, `[울온외]` to surface the post's intent in board listings.
    Capture it as a separate field so listings can render it as a badge
    while the canonical `title` stays clean. Inner content is bounded
    to 12 chars so we don't accidentally swallow something that just
    happens to start with `[` (long English bracketed phrases, etc.).

    Returns `(category_label_or_None, stripped_title)`.
    """
    m = _CATEGORY_PREFIX_RE.match(raw_title)
    if not m:
        return None, raw_title.strip()
    label = m.group(1).strip()
    rest = m.group(2).strip()
    if not label or not rest:
        # `[xxx]` with no body, or empty bracket — keep title as-is.
        return None, raw_title.strip()
    return label, rest


def find_meta_font(soup: BeautifulSoup) -> Tag | None:
    """The post's meta line lives in a Verdana 10px <font> containing 'write by'."""
    for font in soup.find_all("font"):
        if not isinstance(font, Tag):
            continue
        style = font.get("style", "")
        if not (isinstance(style, str) and "Verdana" in style and "10px" in style):
            continue
        text = font.get_text(separator=" ", strip=True)
        if text.startswith("write by"):
            return font
    return None


def find_comment_fonts(soup: BeautifulSoup) -> list[Tag]:
    """Comment meta lines look like the post meta but start with 'comment by'."""
    out: list[Tag] = []
    for font in soup.find_all("font"):
        if not isinstance(font, Tag):
            continue
        style = font.get("style", "")
        if not (isinstance(style, str) and "Verdana" in style and "10px" in style):
            continue
        text = font.get_text(separator=" ", strip=True)
        if text.startswith("comment by"):
            out.append(font)
    return out


def extract_meta(font: Tag) -> dict[str, str | None]:
    """Pull author, member_no, homepage, and timestamp out of a meta <font>."""
    text = font.get_text(separator=" ", strip=True)
    text = unicodedata.normalize("NFKC", text)

    author = None
    member_no = None
    # A member's meta line carries an empty `<a class="cmt"></a>` before the
    # `<a class="cmt" href="view_info.php…">name</a>`, so the first anchor
    # is taken only if it has text (46,972 comments were "anonymous").
    anchors = font.find_all("a", class_="cmt") + font.find_all("a", href=re.compile(r"view_info\.php"))
    cmt_anchor = next((a for a in anchors if isinstance(a, Tag) and a.get_text(strip=True)), None)
    if isinstance(cmt_anchor, Tag):
        author = cmt_anchor.get_text(strip=True)
        href = cmt_anchor.get("href", "")
        if isinstance(href, str):
            qs = parse_qs(urlparse(href).query)
            mn = qs.get("member_no") or []
            if mn:
                member_no = mn[0]
    else:
        # kritz_trash skin: `<font class="ver11px">PseudoName</font>` with no
        # member_no link (Trash board lets non-members post under aliases).
        # Fallback so the post still has a usable author field instead of
        # collapsing to the "anonymous" default downstream.
        ver11 = font.find("font", class_="ver11px")
        if isinstance(ver11, Tag):
            ver11_text = ver11.get_text(strip=True)
            if ver11_text:
                author = ver11_text

    homepage = None
    for a in font.find_all("a"):
        if not isinstance(a, Tag):
            continue
        href = a.get("href")
        if not isinstance(href, str):
            continue
        if "view_info.php" in href:
            continue
        if href.strip() in {"http://", "https://", ""}:
            continue
        homepage = href.strip()
        break

    created_at = None
    span = font.find("span", title=True)
    if isinstance(span, Tag):
        title_attr = span.get("title", "")
        if isinstance(title_attr, str):
            created_at = parse_korean_datetime(title_attr)
    if not created_at:
        created_at = parse_korean_datetime(text)

    return {
        "author": author,
        "member_no": member_no,
        "homepage": homepage,
        "created_at": created_at.isoformat() if created_at else None,
    }


def find_post_body_td(soup: BeautifulSoup, meta_font: Tag | None) -> Tag | None:
    """The first body-td appears AFTER the meta font."""
    if meta_font is None:
        return None
    found_meta = False
    for td in soup.find_all("td"):
        if not isinstance(td, Tag):
            continue
        if not found_meta:
            if meta_font in td.descendants:
                found_meta = True
            continue
        bgcolor = td.get("bgcolor", "")
        style = td.get("style", "")
        if (
            isinstance(bgcolor, str)
            and bgcolor.lower() == "#ffffff"
            and isinstance(style, str)
            and "padding:10px" in style
        ):
            return td
    return None


def find_comment_body_td(comment_font: Tag) -> Tag | None:
    """Comment body lives in <td class="t140"> immediately after the comment meta."""
    pivot: Tag | None = comment_font
    while pivot is not None:
        nxt = pivot.find_next("td", class_="t140")
        if isinstance(nxt, Tag):
            return nxt
        pivot = pivot.parent if isinstance(pivot.parent, Tag) else None
    return None


_ATTACH_HREF_RE = re.compile(r"download\.php", re.I)
_FILE_SIZE_RE = re.compile(
    r"\(\s*([\d.,]+)\s*(KB|MB|GB|B)\s*\)\s*$",
    re.I,
)


def find_attachments(soup: BeautifulSoup) -> list[dict[str, object]]:
    out: list[dict[str, object]] = []
    seen: set[int] = set()
    for a in soup.find_all("a", href=_ATTACH_HREF_RE):
        if not isinstance(a, Tag):
            continue
        href = a.get("href", "")
        if not isinstance(href, str):
            continue
        qs = parse_qs(urlparse(href).query)
        filenum_raw = qs.get("filenum") or []
        if not filenum_raw:
            continue
        try:
            filenum = int(filenum_raw[0])
        except ValueError:
            continue
        if filenum in seen:
            continue
        seen.add(filenum)

        full_text = a.get_text(strip=True)
        m = _FILE_SIZE_RE.search(full_text)
        size_bytes: int | None = None
        if m:
            try:
                value = float(m.group(1).replace(",", ""))
                unit = m.group(2).upper()
                multiplier = {"B": 1, "KB": 1024, "MB": 1024**2, "GB": 1024**3}[unit]
                size_bytes = int(value * multiplier)
            except ValueError:
                size_bytes = None
            name = full_text[: m.start()].strip()
        else:
            name = full_text

        out.append({"name": name or f"file_{filenum}", "fileNum": filenum, "sizeBytes": size_bytes})
    return out


# ── Wayback timestamp index (ADR-0010 §Decision #7) ────────────────────-
# `Post.capturedAt` MUST be a real Wayback ts so it can anchor downstream
# stages (image recovery, etc.). The previous `derive_captured_at(file_mtime)`
# conflated parse time with capture time — Notice/1 reported 20260502190627
# (today) instead of 20030902080926 (the 2003 capture). Phase A2 of ADR-0010
# corrects this by sourcing the ts from the canonical CDX plan.


def load_wayback_ts_index() -> dict[tuple[str, str], str]:
    """Build a `(board, post_id) -> wayback ts` lookup.

    Source priority:
      1차: e-policy-plan.json — the CDX plan we downloaded against.
      2차: .progress.jsonl — the downloader's record of what it actually
           fetched (downloader uses the same ts as the plan, so this is
           a sanity safety net for partial replays / manual plan edits).

    Both sources should agree. The dual lookup catches edge cases without
    hiding them — if a post is in neither, the parser fails loud (caller
    raises ValueError) rather than silently faking a timestamp.
    """
    index: dict[tuple[str, str], str] = {}

    if PLAN_FILE.exists():
        plan = json.loads(PLAN_FILE.read_text(encoding="utf-8"))
        for entry in plan:
            board = entry.get("board")
            post_id = entry.get("post_id")
            ts = entry.get("ts")
            if board and post_id and ts:
                index[(board, str(post_id))] = ts

    if PROGRESS_FILE.exists():
        for raw_line in PROGRESS_FILE.read_text(encoding="utf-8").splitlines():
            try:
                rec = json.loads(raw_line)
            except json.JSONDecodeError:
                continue
            board = rec.get("board")
            post_id = rec.get("post_id")
            ts = rec.get("ts")
            if not (board and post_id and ts):
                continue
            key = (board, str(post_id))
            # Only fill gaps left by the plan; do not overwrite the canonical
            # plan ts with the downloader's record.
            index.setdefault(key, ts)

    return index


# ── Per-file pipeline ──────────────────────────────────────────────────-


def _parse_buzzard_date(text: str) -> datetime | None:
    """Parse buzzard skin date 'YYYY/M/D' (no time component) → datetime."""
    m = re.match(r"^\s*(\d{4})/(\d{1,2})/(\d{1,2})\s*$", text)
    if not m:
        return None
    return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))


def parse_buzzard_post(
    soup: BeautifulSoup,
    *,
    board: str,
    post_id: str,
    captured_at: str,
    parsed_at: datetime,
) -> Post:
    """Parse a buzzard-skin Zeroboard post (calendar event entry).

    The buzzard skin (used by `events_date`) has no explicit title or author
    field — the date itself is the subject and posts are anonymous. We
    synthesise `title = "YYYY-MM-DD"` and `author = "익명"` to satisfy the
    schema's min_length=1 invariant while preserving the original data shape.
    """
    created_at: datetime | None = None
    hits: int | None = None
    for b in soup.find_all("b"):
        label = b.get_text(strip=True).replace(" ", "")  # "날 짜 :" → "날짜:"
        td = b.find_parent("td") if hasattr(b, "find_parent") else None
        if not isinstance(td, Tag):
            continue
        next_td = td.find_next_sibling("td")
        if not isinstance(next_td, Tag):
            continue
        val = next_td.get_text(strip=True)
        if label.startswith("날짜"):
            created_at = _parse_buzzard_date(val)
        elif label.startswith("조회"):
            try:
                hits = int(val.replace(",", ""))
            except ValueError:
                hits = None

    if created_at is None:
        raise ValueError("missing date in buzzard skin meta")

    body_td = soup.find("td", style=re.compile(r"word-break:break-all.*padding:10px"))
    body_html_raw = ""
    if isinstance(body_td, Tag):
        inner = body_td.find("span", style=re.compile(r"line-height", re.I))
        target = inner if isinstance(inner, Tag) else body_td
        body_html_raw = target.decode_contents()
    body_html = sanitise_html(body_html_raw)
    body_text_soup = BeautifulSoup(body_html, "lxml")
    body_text = body_text_soup.get_text(separator=" ", strip=True)

    era = "2014" if created_at >= ERA_BREAKPOINT else "2003"

    return Post(
        board=board,
        boardKr=board,
        postId=post_id,
        title=created_at.strftime("%Y-%m-%d"),
        categoryLabel=None,
        bodyHtml=body_html,
        bodyText=body_text or " ",
        author="익명",
        authorMemberNo=None,
        authorHomepage=None,
        createdAt=created_at,
        hits=hits,
        recommend=None,
        attachments=[],
        comments=[],
        era=era,
        capturedAt=captured_at,
        parsedAt=parsed_at,
        originalUrl=f"http://forg.co.kr/_zb/zboard.php?id={board}&no={post_id}",
        sourceEngine="zeroboard",
    )


def parse_one(
    html: str,
    *,
    board: str,
    post_id: str,
    captured_at: str,
    parsed_at: datetime,
) -> Post:
    reason = detect_non_post_page(html)
    if reason is not None:
        raise _NonPostPage(reason)

    soup = BeautifulSoup(html, "lxml")

    # Buzzard skin (calendar-style — `events_date`) — divergent layout, no
    # meta-font / title-row pattern. Route to dedicated parser before the
    # standard meta-font path runs and fails on missing createdAt.
    if _BUZZARD_SKIN_MARKER in html:
        return parse_buzzard_post(
            soup,
            board=board, post_id=post_id,
            captured_at=captured_at, parsed_at=parsed_at,
        )

    raw_title = find_title(soup) or ""
    category_label, title = split_category_prefix(raw_title)
    meta_font = find_meta_font(soup)
    meta = extract_meta(meta_font) if meta_font else {
        "author": None, "member_no": None, "homepage": None, "created_at": None,
    }  # fmt: skip

    body_td = find_post_body_td(soup, meta_font)
    body_html_raw = ""
    if isinstance(body_td, Tag):
        inner = body_td.find("span", style=re.compile(r"line-height", re.I))
        target = inner if isinstance(inner, Tag) else body_td
        body_html_raw = target.decode_contents()
    body_html = sanitise_html(body_html_raw)
    body_text_soup = BeautifulSoup(body_html, "lxml")
    body_text = body_text_soup.get_text(separator=" ", strip=True)

    comments: list[Comment] = []
    for cfont in find_comment_fonts(soup):
        cmeta = extract_meta(cfont)
        cbody = find_comment_body_td(cfont)
        chtml = sanitise_html(cbody.decode_contents()) if isinstance(cbody, Tag) else ""
        comments.append(
            Comment(
                author=cmeta["author"] or "anonymous",
                authorMemberNo=cmeta["member_no"],
                # `extract_meta` returns ISO text; the Korean-date parser read it
                # back as nothing and every comment fell to the 1970 sentinel.
                createdAt=datetime.fromisoformat(cmeta["created_at"])
                if cmeta["created_at"]
                else datetime(1970, 1, 1),
                bodyHtml=chtml,
            )
        )

    attachments = [Attachment(**a) for a in find_attachments(soup)]

    created_at_iso = meta["created_at"]
    if not created_at_iso:
        raise ValueError("missing createdAt in meta line")
    created_at = datetime.fromisoformat(created_at_iso)

    era = "2014" if created_at >= ERA_BREAKPOINT else "2003"

    return Post(
        board=board,
        boardKr=board,  # P1.3 will replace with localised name from src/lib/boards.ts
        postId=post_id,
        title=title or "(제목 없음)",
        categoryLabel=category_label,
        bodyHtml=body_html,
        bodyText=body_text or " ",
        author=meta["author"] or "anonymous",
        authorMemberNo=meta["member_no"],
        authorHomepage=meta["homepage"],
        createdAt=created_at,
        hits=None,
        recommend=None,
        attachments=attachments,
        comments=comments,
        era=era,
        capturedAt=captured_at,
        parsedAt=parsed_at,
        originalUrl=f"http://forg.co.kr/_zb/zboard.php?id={board}&no={post_id}",
        sourceEngine="zeroboard",
    )


# ── Stats / reporting ──────────────────────────────────────────────────-


@dataclass
class Stats:
    total: int = 0
    success: int = 0
    skipped: int = 0
    failed_parse: int = 0
    failed_validate: int = 0
    skipped_no_content: int = 0
    skipped_reasons: Counter = field(default_factory=Counter)
    body_chars: int = 0
    posts_with_comments: int = 0
    posts_with_attachments: int = 0
    per_board: Counter = field(default_factory=Counter)
    per_board_failed: Counter = field(default_factory=Counter)
    per_board_skipped: Counter = field(default_factory=Counter)
    start_ts: float = field(default_factory=time.time)


def _append_failure(rec: dict[str, object]) -> None:
    FAILURES_FILE.parent.mkdir(parents=True, exist_ok=True)
    with FAILURES_FILE.open("a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def _write_summary(stats: Stats) -> None:
    SUMMARY_FILE.write_text(
        json.dumps(
            {
                "total": stats.total,
                "success": stats.success,
                "skipped": stats.skipped,
                "skipped_no_content": stats.skipped_no_content,
                "skipped_reasons": dict(stats.skipped_reasons),
                "failed_parse": stats.failed_parse,
                "failed_validate": stats.failed_validate,
                "avg_body_chars": (
                    stats.body_chars // stats.success if stats.success else 0
                ),
                "posts_with_comments": stats.posts_with_comments,
                "posts_with_attachments": stats.posts_with_attachments,
                "per_board": dict(stats.per_board),
                "per_board_failed": dict(stats.per_board_failed),
                "per_board_skipped": dict(stats.per_board_skipped),
                "elapsed_s": int(time.time() - stats.start_ts),
                "ts": int(time.time()),
            },
            indent=2,
            ensure_ascii=False,
        )
    )


# ── Driver ─────────────────────────────────────────────────────────────-


def iter_input_files(board_filter: str | None) -> list[tuple[str, str, Path]]:
    """Walk `INPUT_BASE/{A,B,C,V}/{board}/*.html` and yield `(board, post_id, path)`.

    Phase A and Phase B share the same Zeroboard parser, so we collapse
    them here. Each (board, post_id) pair is unique across phases — the
    downloader writes to distinct archive subdirs. EXCLUDE_BOARDS guards
    the wrong-engine skip; `--board` further narrows for ad-hoc reruns.
    """
    files: list[tuple[str, str, Path]] = []
    found_any_phase = False
    # V: `/_zb/view.php` captures — the same `/_zb/` install reached through
    # Zeroboard's direct-view script, so the default origin still holds.
    for phase in ("A", "B", "C", "V"):
        root = INPUT_BASE / phase
        if not root.is_dir():
            continue
        found_any_phase = True
        for board_dir in sorted(root.iterdir()):
            if not board_dir.is_dir():
                continue
            if board_dir.name in EXCLUDE_BOARDS:
                continue
            if board_filter and board_dir.name != board_filter:
                continue
            for f in sorted(board_dir.glob("*.html")):
                post_id = f.stem
                files.append((board_dir.name, post_id, f))
    if not found_any_phase:
        sys.exit(f"FATAL: no phase subdirs under {INPUT_BASE}")
    return files


def derive_output_path(board: str, post_id: str) -> Path:
    return OUTPUT_DIR / board / f"{post_id}.json"


def needs_processing(input_path: Path, output_path: Path, force: bool) -> bool:
    if force:
        return True
    if not output_path.exists():
        return True
    if output_path.stat().st_size == 0:
        return True
    if input_path.stat().st_mtime > output_path.stat().st_mtime:
        return True
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="ETL Stage 2: Zeroboard parser")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--board", default=None)
    parser.add_argument("--print-every", type=int, default=50)
    args = parser.parse_args()

    inputs = iter_input_files(args.board)
    todo: list[tuple[str, str, Path]] = []
    skipped = 0
    for board, post_id, f in inputs:
        out = derive_output_path(board, post_id)
        if needs_processing(f, out, args.force):
            todo.append((board, post_id, f))
        else:
            skipped += 1
    if args.limit:
        todo = todo[: args.limit]

    print(
        f"[02-parse] planned={len(inputs)} todo={len(todo)} skipped={skipped} "
        f"input={INPUT_BASE}/{{A,B,C,V}} output={OUTPUT_DIR} dry_run={args.dry_run}",
        file=sys.stderr,
    )
    if not todo:
        print("Nothing to do.", file=sys.stderr)
        return

    ts_index = load_wayback_ts_index()
    if not ts_index:
        sys.exit(
            "FATAL: empty wayback ts index. Neither e-policy-plan.json nor "
            ".progress.jsonl yielded any (board, post_id) -> ts entries. "
            "Cannot stamp Post.capturedAt — refusing to write fake values."
        )

    stats = Stats(total=len(todo), skipped=skipped)
    last_print = 0
    parsed_at = datetime.now()
    for i, (board, post_id, in_path) in enumerate(todo, 1):
        out_path = derive_output_path(board, post_id)
        try:
            html = in_path.read_text("utf-8")
            captured_at = ts_index.get((board, post_id))
            if not captured_at:
                raise ValueError(
                    f"missing Wayback ts for ({board}, {post_id}) — neither "
                    "e-policy-plan.json nor .progress.jsonl has it. ADR-0010 "
                    "fail-loud: refusing to silently fake Post.capturedAt."
                )
            post = parse_one(
                html,
                board=board,
                post_id=post_id,
                captured_at=captured_at,
                parsed_at=parsed_at,
            )
        except _NonPostPage as e:
            stats.skipped_no_content += 1
            stats.skipped_reasons[e.reason] += 1
            stats.per_board_skipped[board] += 1
            _append_failure(
                {"input": str(in_path), "error": e.reason, "stage": "skipped_no_content"}
            )
            continue
        except ValidationError as e:
            stats.failed_validate += 1
            stats.per_board_failed[board] += 1
            _append_failure({"input": str(in_path), "error": str(e)[:500], "stage": "validate"})
            continue
        except Exception as e:
            stats.failed_parse += 1
            stats.per_board_failed[board] += 1
            _append_failure(
                {"input": str(in_path), "error": f"{type(e).__name__}: {e}"[:500], "stage": "parse"}
            )
            continue

        stats.success += 1
        stats.per_board[board] += 1
        stats.body_chars += len(post.bodyText)
        if post.comments:
            stats.posts_with_comments += 1
        if post.attachments:
            stats.posts_with_attachments += 1

        if not args.dry_run:
            out_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = out_path.with_suffix(out_path.suffix + ".tmp")
            # Trailing newline keeps the file prettier-compatible — without it
            # `pnpm format:check` reports every gold-tier JSON as a style miss.
            tmp.write_text(post.model_dump_json(indent=2) + "\n", encoding="utf-8")
            tmp.replace(out_path)

        if i - last_print >= args.print_every or i == len(todo):
            last_print = i
            _write_summary(stats)
            elapsed = time.time() - stats.start_ts
            rate = stats.success / elapsed if elapsed else 0
            print(
                f"[{i:>5}/{len(todo)}] ok={stats.success} parse_err={stats.failed_parse} "
                f"valid_err={stats.failed_validate} skipped={stats.skipped_no_content} "
                f"comments={stats.posts_with_comments} attach={stats.posts_with_attachments} "
                f"{rate:.1f}/s",
                file=sys.stderr,
                flush=True,
            )

    _write_summary(stats)
    print(
        f"\n[02-parse] DONE total={stats.total} ok={stats.success} "
        f"parse_err={stats.failed_parse} valid_err={stats.failed_validate} "
        f"skipped_no_content={stats.skipped_no_content} ({dict(stats.skipped_reasons)})",
        file=sys.stderr,
    )
    sys.exit(1 if (stats.failed_parse + stats.failed_validate) > 0 else 0)


if __name__ == "__main__":
    main()
