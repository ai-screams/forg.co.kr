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

import nh3
from bs4 import BeautifulSoup, Tag
from pydantic import ValidationError

# Make schemas.py importable when this script is run directly.
sys.path.insert(0, str(Path(__file__).resolve().parent))
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


# ── nh3 sanitiser config (same whitelist as Zeroboard parser, ADR-0008 §5) ──
_SANITISER_TAGS = {
    "p", "br", "b", "i", "u", "strong", "em", "a", "img", "span",
    "div", "table", "tr", "td", "th", "tbody", "thead", "tfoot",
    "ul", "ol", "li", "blockquote", "font", "center", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6", "pre", "code",
}  # fmt: skip
_SANITISER_ATTRS: dict[str, set[str]] = {
    "a": {"href", "title"},
    "img": {
        "src", "alt", "width", "height", "border", "title",
        "data-recovery", "data-original-src",
    },  # fmt: skip
    "td": {"colspan", "rowspan", "align", "valign", "bgcolor", "width", "height"},
    "th": {"colspan", "rowspan", "align", "valign", "bgcolor", "width", "height"},
    "table": {"border", "cellpadding", "cellspacing", "width", "bgcolor"},
    "font": {"color", "size", "face"},
    "*": {"style", "class"},
}
_SANITISER_URL_SCHEMES = {"http", "https", "mailto"}


def sanitise_html(html: str) -> str:
    return nh3.clean(
        html,
        tags=_SANITISER_TAGS,
        attributes=_SANITISER_ATTRS,
        url_schemes=_SANITISER_URL_SCHEMES,
        link_rel=None,
    )


# ── Korean date parser (shared pattern from Zeroboard parser) ───────────
_KOREAN_DATETIME_RE = re.compile(
    r"(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2})시\s*(\d{1,2})분\s*(\d{1,2})초"
)
_DATE_ONLY_RE = re.compile(r"(\d{4})/(\d{1,2})/(\d{1,2})")
_DATE_DASH_RE = re.compile(r"(\d{4})-(\d{1,2})-(\d{1,2})")
_MONTHDAY_TIME_RE = re.compile(r"(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})")


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


def parse_dash_date(text: str) -> datetime | None:
    """Parse YYYY-MM-DD style date string."""
    m = _DATE_DASH_RE.search(text)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return datetime(y, mo, d)
    return None


def parse_comment_date(text: str, captured_at: str) -> datetime | None:
    """Parse G4 comment date 'MM-DD HH:mm', deriving year from Wayback ts.

    G4 skin only renders month-day for comments. We derive the year from the
    Wayback capture timestamp: if the comment's month-day is <= the capture
    month-day we use the capture year, otherwise year-1 (comment was before
    the capture rolled into the next year). A comment cannot postdate the
    capture that contains it.
    """
    m = _MONTHDAY_TIME_RE.search(text)
    if not m:
        return None
    mo, d, h, mi = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
    capture_year = int(captured_at[:4])
    capture_month_day = (int(captured_at[4:6]), int(captured_at[6:8]))
    year = capture_year if (mo, d) <= capture_month_day else capture_year - 1
    try:
        return datetime(year, mo, d, h, mi)
    except ValueError:
        return None


# ── Category prefix (same logic as Zeroboard parser) ────────────────────
_CATEGORY_PREFIX_RE = re.compile(r"^\s*\[\s*([^\[\]]{1,12})\s*\]\s*(.*)$", re.S)


def split_category_prefix(raw_title: str) -> tuple[str | None, str]:
    m = _CATEGORY_PREFIX_RE.match(raw_title)
    if not m:
        return None, raw_title.strip()
    label = m.group(1).strip()
    rest = m.group(2).strip()
    if not label or not rest:
        return None, raw_title.strip()
    return label, rest


# ── Wayback timestamp index (ADR-0010 §Decision #7) ────────────────────
def load_wayback_ts_index() -> dict[tuple[str, str], str]:
    """Build a `(board, post_id) -> wayback ts` lookup."""
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
            index.setdefault(key, ts)

    return index


# ── G4 webbus2009_basic selectors ───────────────────────────────────────

def find_post_region_start(soup: BeautifulSoup) -> Tag | None:
    """Find the outer table that wraps the post view (after 게시글 보기 시작)."""
    for comment in soup.find_all(string=lambda t: isinstance(t, str) and "게시글 보기 시작" in t):
        nxt = comment.find_next("table")
        if isinstance(nxt, Tag):
            return nxt
    return None


def find_title(soup: BeautifulSoup) -> str | None:
    """Title: <div style="...font-weight:bold; word-break:break-all;">."""
    for div in soup.find_all("div"):
        if not isinstance(div, Tag):
            continue
        style = div.get("style", "")
        if not isinstance(style, str):
            continue
        if "font-weight:bold" in style and "word-break:break-all" in style:
            text = div.get_text(strip=True)
            if text:
                return text
    return None


def find_author(soup: BeautifulSoup) -> str | None:
    """Author: <span class="gray6s"><strong>name</strong></span> after 작성자: span."""
    for span in soup.find_all("span", class_="gray8s"):
        if not isinstance(span, Tag):
            continue
        if "작성자" not in span.get_text():
            continue
        # The author span immediately follows in the parent div
        parent = span.parent
        if not isinstance(parent, Tag):
            continue
        author_span = parent.find("span", class_="gray6s")
        if isinstance(author_span, Tag):
            strong = author_span.find("strong")
            if isinstance(strong, Tag):
                return strong.get_text(strip=True)
    return None


def find_hits(soup: BeautifulSoup) -> int | None:
    """Hits: 조회 : <span class="gray8s"><strong>N</strong></span>."""
    for div in soup.find_all("div", class_="gray6s"):
        if not isinstance(div, Tag):
            continue
        text = div.get_text()
        if "조회" not in text:
            continue
        span = div.find("span", class_="gray8s")
        if isinstance(span, Tag):
            strong = span.find("strong")
            if isinstance(strong, Tag):
                try:
                    return int(strong.get_text(strip=True).replace(",", ""))
                except ValueError:
                    pass
    return None


def find_body(soup: BeautifulSoup) -> str:
    """Body: <span id="writeContents">…</span>."""
    span = soup.find("span", id="writeContents")
    if isinstance(span, Tag):
        return span.decode_contents()
    return ""


def find_created_at(soup: BeautifulSoup, post_id: str) -> datetime | None:
    """Date from board listing table: find the row with wr_id={post_id}.

    The post-view page embeds the board listing below the post body.
    Each row contains an <a href="...wr_id=NNN"> and a date cell
    <td class="gray8s" width="65"><span style="...color:#888888;">YYYY-MM-DD</span>.
    We match by post_id and read the adjacent date span.
    """
    target_href_fragment = f"wr_id={post_id}"
    # Walk all <a> tags whose href contains the post id
    for a in soup.find_all("a", href=True):
        if not isinstance(a, Tag):
            continue
        href = a.get("href", "")
        if not isinstance(href, str):
            continue
        if target_href_fragment not in href:
            continue
        # Go up to the <tr> that contains this link
        tr = a.find_parent("tr")
        if not isinstance(tr, Tag):
            continue
        # Find a date span: color:#888888 with YYYY-MM-DD text
        for span in tr.find_all("span"):
            if not isinstance(span, Tag):
                continue
            style = span.get("style", "")
            if not isinstance(style, str):
                continue
            if "888888" not in style:
                continue
            text = span.get_text(strip=True)
            dt = parse_dash_date(text)
            if dt is not None:
                return dt
    return None


def find_comments(soup: BeautifulSoup, captured_at: str) -> list[Comment]:
    """Extract comments from <div id="commentContents">."""
    container = soup.find("div", id="commentContents")
    if not isinstance(container, Tag):
        return []

    comments: list[Comment] = []
    # Each comment starts with <a name="c_{id}">
    for anchor in container.find_all("a", attrs={"name": re.compile(r"^c_\d+")}):
        if not isinstance(anchor, Tag):
            continue
        # The comment's table is a sibling
        comment_table = anchor.find_next_sibling("table")
        if not isinstance(comment_table, Tag):
            # anchor may not have sibling; walk up and find the enclosing table
            comment_table = anchor.find_next("table")
        if not isinstance(comment_table, Tag):
            continue

        # Author: <span class="member"> in the left-side header cell
        author_span = comment_table.find("span", class_="member")
        author = author_span.get_text(strip=True) if isinstance(author_span, Tag) else "anonymous"
        if not author:
            author = "anonymous"

        # Date: right-side header cell, <span> with "MM-DD HH:mm"
        created_at: datetime = datetime(1970, 1, 1)
        right_td = comment_table.find("td", attrs={"align": "right", "bgcolor": "#cbd1d4"})
        if isinstance(right_td, Tag):
            # The date span is the last <span> in this td (not the edit/reply hidden spans)
            date_spans = [
                s for s in right_td.find_all("span")
                if isinstance(s, Tag)
                and not s.get("id")  # skip edit_NNN / reply_NNN spans
            ]
            if date_spans:
                date_text = date_spans[-1].get_text(strip=True)
                parsed = parse_comment_date(date_text, captured_at)
                if parsed:
                    created_at = parsed

        # Body: <td colspan="2" style="padding:5px..."><font class="12font">
        body_td = comment_table.find(
            "td",
            attrs={"colspan": "2", "style": re.compile(r"padding:5px", re.I)},
        )
        body_html = ""
        if isinstance(body_td, Tag):
            inner_font = body_td.find("font", class_="12font")
            target = inner_font if isinstance(inner_font, Tag) else body_td
            body_html = sanitise_html(target.decode_contents())

        comments.append(
            Comment(
                author=author,
                authorMemberNo=None,
                createdAt=created_at,
                bodyHtml=body_html,
            )
        )

    return comments


_ATTACH_HREF_RE = re.compile(r"download\.php", re.I)
_FILE_SIZE_RE = re.compile(r"\(\s*([\d.,]+)\s*(KB|MB|GB|B)\s*\)\s*$", re.I)


def find_attachments(soup: BeautifulSoup) -> list[dict[str, object]]:
    """Extract file attachments from download.php links (same as Zeroboard parser)."""
    from urllib.parse import parse_qs, urlparse

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


# ── Per-file pipeline ───────────────────────────────────────────────────

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

    raw_title = find_title(soup) or ""
    category_label, title = split_category_prefix(raw_title)

    author = find_author(soup) or "anonymous"
    hits = find_hits(soup)

    body_html_raw = find_body(soup)
    body_html = sanitise_html(body_html_raw)
    body_text_soup = BeautifulSoup(body_html, "lxml")
    body_text = body_text_soup.get_text(separator=" ", strip=True)

    comments = find_comments(soup, captured_at)
    attachments = [Attachment(**a) for a in find_attachments(soup)]

    # The skin prints the post date only in the listing below the post; once
    # the listing has scrolled past it the page holds no post date at all.
    # The earliest comment is then the tightest bound the capture offers.
    # Without comments the date is unknown and takes the 1970 sentinel the
    # Zeroboard parser also uses (rendered as "작성일 미상" + capture date);
    # the post itself is kept. wr_id neighbours were measured as a further
    # bound and span 3–11 years on these boards — not a date anyone can claim.
    created_at = find_created_at(soup, post_id)
    created_at_approx = False
    if created_at is None:
        dated = [c.createdAt for c in comments if c.createdAt.year > 1990]
        if dated:
            created_at = min(dated)
            created_at_approx = True
        else:
            created_at = datetime(1970, 1, 1)

    # boardKr: match the registration in src/lib/boards.ts (P1.3 placeholder)
    board_kr = board

    return Post(
        board=board,
        boardKr=board_kr,
        postId=post_id,
        title=title or "(제목 없음)",
        categoryLabel=category_label,
        bodyHtml=body_html,
        bodyText=body_text or " ",
        author=author,
        authorMemberNo=None,
        authorHomepage=None,
        createdAt=created_at,
        createdAtApprox=created_at_approx,
        hits=hits,
        recommend=None,
        attachments=attachments,
        comments=comments,
        era=ERA,
        capturedAt=captured_at,
        parsedAt=parsed_at,
        originalUrl=f"http://forg.co.kr/bbs/board.php?bo_table={board}&wr_id={post_id}",
        sourceEngine="gnuboard4",
    )


# ── Stats / reporting ───────────────────────────────────────────────────

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


# ── Driver ──────────────────────────────────────────────────────────────

def iter_input_files(board_filter: str | None) -> list[tuple[str, str, Path]]:
    """Walk `INPUT_BASE/{A,B}/{board}/*.html` for Gnuboard4 boards only.

    INCLUDE_BOARDS gates the engine selection: anything outside the
    allowlist (Zeroboard or Gnuboard5 boards) is silently skipped so a
    cross-engine misroute can't produce garbage gold-tier JSON.
    """
    files: list[tuple[str, str, Path]] = []
    found_any_phase = False
    for phase in ("A", "B"):
        root = INPUT_BASE / phase
        if not root.is_dir():
            continue
        found_any_phase = True
        for board_dir in sorted(root.iterdir()):
            if not board_dir.is_dir():
                continue
            if board_dir.name not in INCLUDE_BOARDS:
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
    parser = argparse.ArgumentParser(description="ETL Stage 2b: Gnuboard4 parser")
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
        f"[02b-parse-g4] planned={len(inputs)} todo={len(todo)} skipped={skipped} "
        f"input={INPUT_BASE}/{{A,B}} output={OUTPUT_DIR} dry_run={args.dry_run}",
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
                # Skin guard: case-collided dirs (e.g. forg.co.kr `Ultima`
                # mixed with forg.kr `ultima` Gnuboard5) bring in files
                # whose plan entry uses a different case. Skip silently
                # if the file is obviously not a webbus2009 capture —
                # 02d-parse-gnuboard5.py owns those instead. Preserve
                # ADR-0010 fail-loud for in-engine posts missing a ts.
                if "게시글 보기 시작" not in html:
                    raise _NonPostPage("skin_mismatch_no_ts")
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
            # Trailing newline keeps the file prettier-compatible.
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
        f"\n[02b-parse-g4] DONE total={stats.total} ok={stats.success} "
        f"parse_err={stats.failed_parse} valid_err={stats.failed_validate} "
        f"skipped_no_content={stats.skipped_no_content} ({dict(stats.skipped_reasons)})",
        file=sys.stderr,
    )
    sys.exit(1 if (stats.failed_parse + stats.failed_validate) > 0 else 0)


if __name__ == "__main__":
    main()
