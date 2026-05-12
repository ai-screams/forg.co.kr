#!/usr/bin/env python3
"""ETL Stage 1 — EUC-KR decode + Wayback chrome removal.

Reads raw Wayback captures from `.docs/research/archive/A/{board}/{id}.html`
and writes cleaned UTF-8 HTML to `.docs/research/archive-clean/A/{board}/{id}.html`.

Implements ADR-0007. Preservation is the absolute priority — see Safety Guards.

USAGE:
    python3 scripts/etl/01-decode.py [options]

OPTIONS:
    --limit N          process only the first N files
    --force            overwrite already-converted output
    --dry-run          do not write, just report
    --keep-wayback     skip Wayback removal (encoding only — debug)
    --board BOARD      restrict to one board id
    --print-every N    progress cadence (default 50)

EXIT CODES:
    0 — all success
    1 — some encoding/parse errors (continued, recorded in .errors.jsonl)
    2 — fatal (input dir missing, etc.)
"""
from __future__ import annotations

import argparse
import codecs
import json
import os
import re
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup, Comment

# ── Paths (ADR-0007 §3) ─────────────────────────────────────────────────
ROOT = Path("/Users/hanyul/Works/AiScream/forg/.docs/research")
INPUT_DIR = ROOT / "archive"
OUTPUT_DIR = ROOT / "archive-clean"
ERRORS_FILE = OUTPUT_DIR / ".errors.jsonl"
PROGRESS_FILE = OUTPUT_DIR / ".progress.jsonl"
SUMMARY_FILE = OUTPUT_DIR / ".summary.json"

# ── Wayback patterns (ADR-0007 §4) ──────────────────────────────────────
WAYBACK_DOMAINS = re.compile(r"web(?:-static)?\.archive\.org", re.I)

# Internal link rewriter — undo Wayback's URL rewriting.
# Examples it matches:
#   /web/20030611155224/http://forg.co.kr/_zb/zboard.php?id=X&no=1
#   /web/20071010234957im_/http://forg.co.kr/images/foo.gif
#   https://web.archive.org/web/20141218154018cs_/http://forg.co.kr/style.css
WAYBACK_URL_RE = re.compile(
    r"""
    (?:https?://web\.archive\.org)?     # optional absolute prefix
    /web/                                # Wayback marker
    \d{14}                               # 14-digit timestamp
    (?:[a-z]{2}_)?                       # optional flag (id_, im_, cs_, js_, fw_, oe_)
    /(?P<rest>.+)                        # original URL or path
    """,
    re.VERBOSE | re.I,
)

# Inline scripts that are wholly Wayback noise (kept exact — case-sensitive)
WAYBACK_INLINE_MARKERS = (
    "__wm.init",
    "__wm.wombat",
    "RufflePlayer",
    "window.RufflePlayer",
)

# Trailer comment markers
WAYBACK_COMMENT_MARKERS = (
    "End Wayback Rewrite JS Include",
    "Begin Wayback Rewrite",
    "FILE ARCHIVED ON",
    "playback timings",
    "ARCHIVED ON",
    "RETRIEVED FROM THE",
    "INTERNET ARCHIVE",
)

# ── Stats ───────────────────────────────────────────────────────────────


@dataclass
class Stats:
    total: int = 0
    converted: int = 0
    skipped: int = 0
    errors: int = 0
    bytes_in: int = 0
    bytes_out: int = 0
    wayback_scripts_removed: int = 0
    wayback_links_removed: int = 0
    wayback_comments_removed: int = 0
    wayback_urls_rewritten: int = 0
    encoding_warnings: int = 0
    body_preserved_pct_sum: float = 0.0
    body_preserved_pct_count: int = 0
    start_ts: float = field(default_factory=time.time)

    def avg_body_preserved(self) -> float:
        if self.body_preserved_pct_count == 0:
            return 100.0
        return self.body_preserved_pct_sum / self.body_preserved_pct_count


_lock = threading.Lock()


def append_jsonl(path: Path, obj: dict) -> None:
    line = json.dumps(obj, ensure_ascii=False)
    with _lock:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a") as f:
            f.write(line + "\n")


def write_summary(stats: Stats) -> None:
    elapsed = time.time() - stats.start_ts
    SUMMARY_FILE.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY_FILE.write_text(
        json.dumps(
            {
                "total": stats.total,
                "converted": stats.converted,
                "skipped": stats.skipped,
                "errors": stats.errors,
                "bytes_in": stats.bytes_in,
                "bytes_out": stats.bytes_out,
                "wayback_scripts_removed": stats.wayback_scripts_removed,
                "wayback_links_removed": stats.wayback_links_removed,
                "wayback_comments_removed": stats.wayback_comments_removed,
                "wayback_urls_rewritten": stats.wayback_urls_rewritten,
                "encoding_warnings": stats.encoding_warnings,
                "avg_body_preserved_pct": round(stats.avg_body_preserved(), 2),
                "elapsed_s": int(elapsed),
                "ts": int(time.time()),
            },
            indent=2,
            ensure_ascii=False,
        )
    )


# ── Core ────────────────────────────────────────────────────────────────


def decode_bytes(raw: bytes) -> tuple[str, int]:
    """Decode raw bytes to text. Returns (text, error_count).

    Most forg.co.kr captures are CP949 (Wayback often labels them
    euc-kr while content is the CP949 superset). The forg.kr successor
    and the Gnuboard5 era (forg.co.kr Ultima Phase B, P2.3) are
    already UTF-8 — decoding those as CP949 silently produces garbled
    Korean (about half the multi-byte codepoints become `�`
    replacement chars). Detect UTF-8 first by strict-decoding; only
    fall back to CP949 / EUC-KR on UnicodeDecodeError.
    """
    try:
        return codecs.decode(raw, "utf-8", errors="strict"), 0
    except UnicodeDecodeError:
        pass
    try:
        return codecs.decode(raw, "cp949", errors="strict"), 0
    except UnicodeDecodeError:
        text, err = codecs.decode(raw, "cp949", errors="replace"), 1
        return text, err


def remove_wayback_chrome(soup: BeautifulSoup, stats: Stats) -> None:
    """Remove Wayback-specific scripts, links, and comments. Mutates soup."""
    # 1) <script src="...web.archive.org..."> or "...web-static.archive.org..."
    for s in list(soup.find_all("script", src=True)):
        src = s.get("src", "")
        if WAYBACK_DOMAINS.search(src):
            s.decompose()
            stats.wayback_scripts_removed += 1

    # 2) <link href="...web-static.archive.org..."> (Wayback CSS)
    for link in list(soup.find_all("link", href=True)):
        href = link.get("href", "")
        if WAYBACK_DOMAINS.search(href):
            link.decompose()
            stats.wayback_links_removed += 1

    # 3) Inline scripts containing __wm.init / RufflePlayer / etc.
    for s in list(soup.find_all("script")):
        if s.get("src"):
            continue
        body = s.string or s.get_text() or ""
        if any(marker in body for marker in WAYBACK_INLINE_MARKERS):
            s.decompose()
            stats.wayback_scripts_removed += 1

    # 4) HTML comments — Wayback trailers + "Begin/End Wayback" marker
    for comment in list(soup.find_all(string=lambda x: isinstance(x, Comment))):
        text = str(comment)
        if any(marker in text for marker in WAYBACK_COMMENT_MARKERS):
            comment.extract()
            stats.wayback_comments_removed += 1


def rewrite_wayback_urls(soup: BeautifulSoup, stats: Stats) -> None:
    """Undo Wayback URL rewriting in href/src/action/background attributes."""
    URL_ATTRS = ("href", "src", "action", "background", "poster", "cite")

    def maybe_rewrite(value: str) -> Optional[str]:
        if not value:
            return None
        m = WAYBACK_URL_RE.fullmatch(value.strip())
        if not m:
            return None
        rest = m.group("rest")
        # rest can be:
        #   http://forg.co.kr/path?q=1
        #   forg.co.kr/path
        #   /path
        # Strip http(s)://host to leave path-only references for relative handling.
        rest = re.sub(r"^https?://[^/]+", "", rest)
        if not rest.startswith("/"):
            rest = "/" + rest
        return rest

    for tag in soup.find_all(True):
        for attr in URL_ATTRS:
            value = tag.get(attr)
            if not isinstance(value, str):
                continue
            new_value = maybe_rewrite(value)
            if new_value and new_value != value:
                tag[attr] = new_value
                stats.wayback_urls_rewritten += 1


def normalize_charset(soup: BeautifulSoup) -> None:
    """Update <meta charset> to utf-8 so the file is self-describing."""
    found = False
    for meta in soup.find_all("meta"):
        if meta.get("charset"):
            meta["charset"] = "utf-8"
            found = True
        http_equiv = meta.get("http-equiv", "")
        if isinstance(http_equiv, str) and http_equiv.lower() == "content-type":
            content = meta.get("content", "")
            if isinstance(content, str):
                meta["content"] = re.sub(
                    r"charset=[^;\s]+", "charset=utf-8", content, flags=re.I
                )
                found = True
    if not found:
        head = soup.find("head")
        if head:
            new_meta = soup.new_tag("meta", charset="utf-8")
            head.insert(0, new_meta)


_CONTENT_CHARS_RE = re.compile(r"[가-힣a-zA-Z0-9]")
"""Korean syllables (가–힣) + ASCII alphanumerics — the bytes that carry meaning.

Whitespace, HTML markup, and CSS/JS code change shape during BS4 re-serialisation
(attribute order, quoting, indentation) without altering meaning. By counting only
content characters, we measure preservation of *what readers actually see*.
"""


def validate_preservation(raw_text: str, clean_text: str) -> float:
    """Return the percent of meaningful content characters preserved.

    Counts Korean syllables and ASCII alphanumerics on both sides. BS4
    re-serialisation may shift whitespace and attribute order — those changes
    don't affect content. After also dropping Wayback chrome from the raw
    text (so we compare like-for-like), the ratio should be very close to
    100% on a successful conversion.
    """

    def content_count(s: str) -> int:
        # Drop Wayback chrome from raw side so it doesn't inflate the count.
        for marker in WAYBACK_COMMENT_MARKERS:
            s = re.sub(rf"<!--.*?{re.escape(marker)}.*?-->", "", s, flags=re.S | re.I)
        s = re.sub(r"https?://web(?:-static)?\.archive\.org\S*", "", s)
        s = re.sub(r"/web/\d{14}(?:[a-z]{2}_)?/", "/", s)
        return len(_CONTENT_CHARS_RE.findall(s))

    raw_n = content_count(raw_text)
    if raw_n == 0:
        return 100.0
    clean_n = content_count(clean_text)
    # Cap at 100%: conversion may add a couple of characters (utf-8 meta tag),
    # but never adds meaningful content.
    return min(clean_n / raw_n * 100.0, 100.0)


def parse_html(text: str) -> BeautifulSoup:
    """Try lxml first, fall back to html5lib for severely broken HTML."""
    try:
        return BeautifulSoup(text, "lxml")
    except Exception:
        return BeautifulSoup(text, "html5lib")


def serialize(soup: BeautifulSoup) -> str:
    """Return UTF-8 string. Preserve doctype if present."""
    return str(soup)


def process_file(
    input_path: Path, output_path: Path, *, keep_wayback: bool, dry_run: bool, stats: Stats
) -> dict:
    """Process one file. Returns a result dict suitable for JSONL logging."""
    raw_bytes = input_path.read_bytes()
    stats.bytes_in += len(raw_bytes)

    # Decode
    text, encoding_errors = decode_bytes(raw_bytes)
    if encoding_errors:
        stats.encoding_warnings += 1

    # Parse
    soup = parse_html(text)

    # Clean
    if not keep_wayback:
        remove_wayback_chrome(soup, stats)
        rewrite_wayback_urls(soup, stats)
        normalize_charset(soup)

    cleaned = serialize(soup)
    stats.bytes_out += len(cleaned.encode("utf-8"))

    # Validate preservation
    preserved_pct = validate_preservation(text, cleaned)
    stats.body_preserved_pct_sum += preserved_pct
    stats.body_preserved_pct_count += 1

    # Write atomically
    if not dry_run:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = output_path.with_suffix(output_path.suffix + ".tmp")
        tmp.write_text(cleaned, encoding="utf-8")
        os.replace(tmp, output_path)

    return {
        "ok": True,
        "input": str(input_path.relative_to(ROOT)),
        "output": str(output_path.relative_to(ROOT)),
        "bytes_in": len(raw_bytes),
        "bytes_out": len(cleaned.encode("utf-8")),
        "preserved_pct": round(preserved_pct, 2),
        "encoding_errors": encoding_errors,
    }


# ── Main ────────────────────────────────────────────────────────────────


# Boards skipped in Phase B decode. Empty now that P2.3 (Gnuboard5
# parser) is online — forg.kr g5 boards (`aseeee` … `ultima`) and the
# forg.co.kr Ultima G5 board are decoded alongside the rest. The
# decoder's UTF-8 detection picks up their charset automatically.
_PHASE_B_G5_SKIP: frozenset[str] = frozenset()


def iter_input_files(board_filter: Optional[str]) -> list[Path]:
    """Walk archive/{A,B}/* and yield HTML files. Stable order for resumable runs.

    Phase A and Phase B both ship under `INPUT_DIR/{phase}/{board}/*.html`;
    the output mirror in `OUTPUT_DIR/{phase}/{board}/*.html` is preserved by
    `derive_output_path` using `relative_to(INPUT_DIR)`. forg.kr g5 boards
    (case-sensitive ids — note `ultima` vs `Ultima` are different engines)
    skip decode until P2.3 introduces the g5 parser.
    """
    files: list[Path] = []
    for phase in ("A", "B"):
        root = INPUT_DIR / phase
        if not root.is_dir():
            continue
        for board_dir in sorted(root.iterdir()):
            if not board_dir.is_dir():
                continue
            if phase == "B" and board_dir.name in _PHASE_B_G5_SKIP:
                continue
            if board_filter and board_dir.name != board_filter:
                continue
            for f in sorted(board_dir.glob("*.html")):
                files.append(f)
    if not files:
        sys.exit(f"FATAL: no input HTML found under {INPUT_DIR}/{{A,B}}/")
    return files


def derive_output_path(input_path: Path) -> Path:
    rel = input_path.relative_to(INPUT_DIR)
    return OUTPUT_DIR / rel


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
    parser = argparse.ArgumentParser(description="ETL Stage 1: decode + clean")
    parser.add_argument("--limit", type=int, default=0, help="process only first N (0 = all)")
    parser.add_argument("--force", action="store_true", help="overwrite existing output")
    parser.add_argument("--dry-run", action="store_true", help="do not write")
    parser.add_argument("--keep-wayback", action="store_true", help="encoding only (debug)")
    parser.add_argument("--board", default=None, help="restrict to one board id")
    parser.add_argument("--print-every", type=int, default=50)
    args = parser.parse_args()

    files = iter_input_files(args.board)
    if args.limit:
        files = files[: args.limit]

    todo = [(f, derive_output_path(f)) for f in files]
    todo = [(i, o) for (i, o) in todo if needs_processing(i, o, args.force)]
    skipped_count = len(files) - len(todo)

    print(
        f"[01-decode] planned={len(files)} todo={len(todo)} skipped={skipped_count} "
        f"input={INPUT_DIR}/{{A,B}} output={OUTPUT_DIR}/{{A,B}} "
        f"dry_run={args.dry_run} keep_wayback={args.keep_wayback}",
        file=sys.stderr,
    )
    if not todo:
        print("Nothing to do.", file=sys.stderr)
        return

    stats = Stats(total=len(todo), skipped=skipped_count)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    write_summary(stats)

    last_print = 0
    for i, (input_path, output_path) in enumerate(todo, 1):
        try:
            result = process_file(
                input_path,
                output_path,
                keep_wayback=args.keep_wayback,
                dry_run=args.dry_run,
                stats=stats,
            )
            stats.converted += 1
            if not args.dry_run:
                append_jsonl(PROGRESS_FILE, result)
        except Exception as e:
            stats.errors += 1
            err_record = {
                "ok": False,
                "input": str(input_path.relative_to(ROOT)),
                "error": f"{type(e).__name__}: {e}"[:300],
            }
            append_jsonl(ERRORS_FILE, err_record)

        if i - last_print >= args.print_every or i == len(todo):
            last_print = i
            write_summary(stats)
            elapsed = time.time() - stats.start_ts
            rate = stats.converted / elapsed if elapsed > 0 else 0
            chrome_total = (
                stats.wayback_scripts_removed
                + stats.wayback_links_removed
                + stats.wayback_comments_removed
                + stats.wayback_urls_rewritten
            )
            chrome_str = (
                ""
                if chrome_total == 0
                else (
                    f" chrome=[scripts:{stats.wayback_scripts_removed} "
                    f"links:{stats.wayback_links_removed} "
                    f"comments:{stats.wayback_comments_removed} "
                    f"urls:{stats.wayback_urls_rewritten}]"
                )
            )
            print(
                f"[{i:>5}/{len(todo)}] converted={stats.converted} err={stats.errors} "
                f"in={stats.bytes_in / 1_048_576:.1f}MB out={stats.bytes_out / 1_048_576:.1f}MB "
                f"preserved={stats.avg_body_preserved():.1f}%{chrome_str} "
                f"{rate:.1f}/s",
                file=sys.stderr,
                flush=True,
            )

    write_summary(stats)
    print(
        f"\n[01-decode] DONE converted={stats.converted}/{stats.total} "
        f"errors={stats.errors} encoding_warnings={stats.encoding_warnings} "
        f"avg_body_preserved={stats.avg_body_preserved():.1f}%",
        file=sys.stderr,
    )
    sys.exit(1 if stats.errors > 0 else 0)


if __name__ == "__main__":
    main()
