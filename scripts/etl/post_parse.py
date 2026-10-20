"""What the post parsers share: `02` (Zeroboard 4.1), `02b` (Gnuboard4) and
`02d` (Gnuboard5), with `02f` (Zeroboard 4.0) and `02h` (reply forms)
borrowing the Zeroboard pieces. `same_title` — whether a list row with a
post's number is that post — is also what `02c` dates a row by and `03`
marks one by (`02c`'s linked rows use their own `cut_title_matches`).

Each parser keeps its own selectors and its own driver — they walk different
phases and key captures differently — and imports these. The parsers keep the
old names (`zb41.split_category_prefix`, `g4._NonPostPage`, …) for the scripts
that load them through `importlib`.
"""
from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup, Tag

from etl_io import append_jsonl, write_atomic
from schemas import Post

# ── Paths ───────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
INPUT_BASE = PROJECT_ROOT / ".docs" / "research" / "archive-clean"
OUTPUT_DIR = PROJECT_ROOT / "src" / "content" / "posts"
ETL_DIR = PROJECT_ROOT / "scripts" / "etl"

# Wayback timestamp sources (ADR-0010 §Decision #7).
# 1차: the canonical CDX plan we downloaded from. 2차: the downloader's
# per-file progress log — fills any gap left by manual plan edits.
PLAN_FILE = PROJECT_ROOT / ".docs" / "research" / "cdx" / "e-policy-plan.json"
PROGRESS_FILE = PROJECT_ROOT / ".docs" / "research" / "archive" / ".progress.jsonl"


class NonPostPage(Exception):
    """A capture that is not a post the parser reads — deleted before capture,
    refused, another engine's skin. Counted as skipped, not as a failure."""

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


# ── Title category ──────────────────────────────────────────────────────
_CATEGORY_PREFIX_RE = re.compile(r"^\s*\[\s*([^\[\]]{1,12})\s*\]\s*(.*)$", re.S)


def split_category_prefix(raw_title: str) -> tuple[str | None, str]:
    """Extract a leading `[xxx]` category marker from a title.

    Posters routinely prepend a Korean tag like `[질문]`, `[자료]`, `[공지]`,
    `[울온외]` to surface the post's intent in board listings. Capture it as a
    separate field so listings can render it as a badge while the canonical
    `title` stays clean. Inner content is bounded to 12 chars so we don't
    accidentally swallow something that just happens to start with `[` (long
    English bracketed phrases, etc.).

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


_RE_PREFIX = re.compile(r"^\[re\]", re.I)


def title_key(text: str) -> str:
    """Case, width and spacing folded: a list's link text puts a space where
    its markup broke the title (`Load Oaks [일쉐나챔피언]` for the post's
    `Load Oaks[일쉐나챔피언]`)."""
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", text)).casefold()


def same_title(title: str, row_title: str) -> bool:
    """Whether a list row's title is the post's: equal once folded
    (`title_key`), allowing for a list that cut it short with `..` and a 2001
    reply's `[RE]`. Both titles come with their category split off."""
    title, row_title = _RE_PREFIX.sub("", title_key(title)), _RE_PREFIX.sub("", title_key(row_title))
    if title == row_title:
        return True
    cut = row_title.rstrip(".")  # NFKC has made `…` three dots
    return row_title.endswith("..") and bool(cut) and title.startswith(cut)


# ── Attachments (`download.php?…&filenum=N`, Zeroboard and Gnuboard4) ─────
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


def plain_text(html: str) -> str:
    """The text of sanitised HTML, words joined by single spaces."""
    return BeautifulSoup(html, "lxml").get_text(separator=" ", strip=True)


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


# ── Run bookkeeping ─────────────────────────────────────────────────────
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


def append_failure(path: Path, rec: dict[str, object]) -> None:
    """Add a skipped or failed capture to the parser's failure log."""
    append_jsonl(path, rec)


def write_summary(path: Path, stats: Stats) -> None:
    write_atomic(
        path,
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
        + "\n",
    )


# ── Inputs and outputs ──────────────────────────────────────────────────
def walk_captures(
    phases: tuple[str, ...],
    keep_board: Callable[[str], bool],
    board_filter: str | None,
) -> list[tuple[str, str, Path]]:
    """`(board, post_id, path)` for every `INPUT_BASE/{phase}/{board}/*.html`
    whose board `keep_board` accepts (and `--board` names, when given).

    Each (board, post_id) pair is unique across phases — the downloader writes
    to distinct archive subdirs.
    """
    files: list[tuple[str, str, Path]] = []
    found_any_phase = False
    for phase in phases:
        root = INPUT_BASE / phase
        if not root.is_dir():
            continue
        found_any_phase = True
        for board_dir in sorted(root.iterdir()):
            if not board_dir.is_dir():
                continue
            if not keep_board(board_dir.name):
                continue
            if board_filter and board_dir.name != board_filter:
                continue
            for f in sorted(board_dir.glob("*.html")):
                files.append((board_dir.name, f.stem, f))
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


def write_post(path: Path, post: Post) -> None:
    """Write a validated post. The trailing newline keeps the file
    prettier-compatible — without it `pnpm format:check` reports every
    gold-tier JSON as a style miss."""
    write_atomic(path, post.model_dump_json(indent=2) + "\n")
