#!/usr/bin/env python3
"""ETL Phase G (ADR-0012) — single-URL CDX fallback for image-unrecoverable.

ADR-0010 Phase C's prefix CDX query returned 0 rows for several
forg.co.kr/images/ prefixes; P2.4's chrome recovery proved single-URL
probes find captures that prefix matchType misses (68/73 = 93% recovery).
This script applies the same pattern to body image manifest entries
that ended up in `no_canonical_match` — every candidate gets a
single-URL CDX probe, and any valid image row promotes the entry
into the download queue.

Inputs (read-only — original artifacts):
    scripts/etl/image-unrecoverable.jsonl   Phase C unrecoverable list
    scripts/etl/image-download-queue.json   existing queue (dedup key)
    scripts/etl/image-manifest.jsonl        only consulted for ts/source fields

Outputs (atomic rewrite):
    scripts/etl/image-download-queue.json   extended with promoted entries
    scripts/etl/image-unrecoverable.jsonl   reduced — fallback misses only

Resume / runtime state (gitignored):
    .docs/research/archive/images/.fallback.progress.jsonl   one line per attempt
    .docs/research/archive/images/.fallback.run.log          stderr trail
    .docs/research/archive/images/.fallback.summary.json     stats sidecar

Polite policy: same fcntl.flock global slot as Phases C/D and chrome
recovery — Wayback sees one in-flight request total even with multiple
ETL stages running.

Re-runs are idempotent. Entries already in the queue (matched on
(board, post_id, raw_src)) skip the CDX probe entirely. Entries
already attempted (recorded in .fallback.progress.jsonl with status
"miss") also skip — set --retry-misses to re-probe them later.
"""
from __future__ import annotations

import argparse
import contextlib
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote, urlencode, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))
from wayback_client import (  # noqa: E402
    WaybackError,
    WaybackGoneError,
    fetch_with_retry,
    global_polite_slot,
)

# ── Paths ──────────────────────────────────────────────────────────────-
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
QUEUE_FILE = PROJECT_ROOT / "scripts" / "etl" / "image-download-queue.json"
UNRECOVERABLE_FILE = PROJECT_ROOT / "scripts" / "etl" / "image-unrecoverable.jsonl"

RUN_DIR = PROJECT_ROOT / ".docs" / "research" / "archive" / "images"
PROGRESS_FILE = RUN_DIR / ".fallback.progress.jsonl"
SUMMARY_FILE = RUN_DIR / ".fallback.summary.json"
RUN_PID = RUN_DIR / ".fallback.run.pid"

# ── CDX server config ──────────────────────────────────────────────────-
CDX_ENDPOINT = "https://web.archive.org/cdx/search/cdx"
DEFAULT_FROM = "19990101000000"
DEFAULT_TO = "20151231235959"


# ── Helpers (mirrored from cdx-image.py / recover-chrome.py) ───────────-


def parse_int_or_none(s: str | None) -> int | None:
    if not s or s.strip() in ("-", ""):
        return None
    try:
        return int(s)
    except ValueError:
        return None


def valid_image_row(row: dict) -> bool:
    length = parse_int_or_none(row.get("length"))
    return (
        row.get("statuscode") == "200"
        and row.get("mimetype", "").lower().startswith("image/")
        and length is not None
        and length > 0
    )


def pick_cdx_row(rows: list[dict], anchor_ts: str) -> dict | None:
    if not anchor_ts:
        raise ValueError(
            "pick_cdx_row received empty anchor_ts — Phase A2 fail-loud "
            "contract violated. manifest.post_wayback_ts must be set."
        )
    valid = [r for r in rows if valid_image_row(r)]
    if not valid:
        return None
    anchor = datetime.strptime(anchor_ts, "%Y%m%d%H%M%S")

    def dist_seconds(r: dict) -> float:
        t = datetime.strptime(r["timestamp"], "%Y%m%d%H%M%S")
        return abs((t - anchor).total_seconds())

    window_s = 30 * 86400  # ±30 days
    window = [r for r in valid if dist_seconds(r) <= window_s]
    return min(window or valid, key=dist_seconds)


_FILENAME_BAD_CHARS = re.compile(r'[\x00-\x1f/\\:*?"<>|]+')


def safe_filename(url: str, *, fallback: str) -> str:
    path = urlsplit(url).path
    base = path.rsplit("/", 1)[-1]
    base = unquote(base)
    base = _FILENAME_BAD_CHARS.sub("_", base).strip("._- ")
    if not base:
        return fallback
    if len(base) > 180:
        base = base[:180]
    return base


# ── Single-URL CDX probe (mirrors recover-chrome.py.cdx_probe) ─────────-


def cdx_probe(url: str, *, from_ts: str, to_ts: str) -> list[dict]:
    """Run a single-URL exact-match CDX query, return parsed valid rows.

    Strips query strings is NOT done here — Wayback indexes by full URL.
    """
    params = {
        "url": url,
        "output": "json",
        "from": from_ts,
        "to": to_ts,
        "limit": "20",
        # No matchType — defaults to exact.
    }
    cdx_url = f"{CDX_ENDPOINT}?{urlencode(params)}"
    try:
        with global_polite_slot():
            raw = fetch_with_retry(cdx_url)
    except (WaybackGoneError, WaybackError):
        return []
    try:
        data = json.loads(raw.decode("utf-8") or "[]")
    except json.JSONDecodeError:
        return []
    if not data:
        return []
    header, *rows = data
    cols = {name: i for i, name in enumerate(header)}
    out: list[dict] = []
    for r in rows:
        if not r or len(r) < len(header):
            continue
        out.append(
            {
                "urlkey": r[cols["urlkey"]],
                "timestamp": r[cols["timestamp"]],
                "original": r[cols["original"]],
                "mimetype": r[cols["mimetype"]],
                "statuscode": r[cols["statuscode"]],
                "digest": r[cols["digest"]],
                "length": r[cols["length"]],
            }
        )
    return out


# ── Resume helpers ──────────────────────────────────────────────────────


def load_existing_queue() -> tuple[list[dict], set[tuple[str, str, str]]]:
    """Return `(queue_entries, dedup_keys)` where dedup_keys is the set of
    (board, post_id, raw_src) tuples already represented in the queue."""
    if not QUEUE_FILE.exists():
        return [], set()
    queue = json.loads(QUEUE_FILE.read_text(encoding="utf-8"))
    if not isinstance(queue, list):
        return [], set()
    dedup = {(e["board"], e["post_id"], e["raw_src"]) for e in queue}
    return queue, dedup


def load_progress() -> dict[tuple[str, str, str], str]:
    """Return `(board, post_id, raw_src) -> status` from the progress jsonl.
    status is "hit" / "miss" / "error" — used to skip already-attempted entries."""
    out: dict[tuple[str, str, str], str] = {}
    if not PROGRESS_FILE.exists():
        return out
    for line in PROGRESS_FILE.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        key = (rec.get("board"), rec.get("post_id"), rec.get("raw_src"))
        if all(k is not None for k in key):
            out[key] = rec.get("status", "miss")
    return out


def append_progress(rec: dict) -> None:
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with PROGRESS_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def write_summary(stats: dict) -> None:
    SUMMARY_FILE.parent.mkdir(parents=True, exist_ok=True)
    elapsed = time.time() - stats["start"]
    rate = stats["attempts"] / elapsed if elapsed > 0 else 0.0
    SUMMARY_FILE.write_text(
        json.dumps(
            {
                "candidates": stats["candidates"],
                "attempts": stats["attempts"],
                "promoted": stats["promoted"],
                "still_missing": stats["still_missing"],
                "errors": stats["errors"],
                "skipped_already_in_queue": stats["skipped_in_queue"],
                "skipped_already_attempted": stats["skipped_attempted"],
                "elapsed_s": int(elapsed),
                "rate_per_s": round(rate, 3),
                "ts": int(time.time()),
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )


# ── Promote one entry to a queue row ────────────────────────────────────


def build_queue_entry(unrec: dict, picked: dict, matched_candidate: str) -> dict:
    """Construct a queue entry from a single-URL probe hit. Mirrors the
    shape `cdx-image.py.join_manifest_to_queue` produces so Phase D /
    Phase F handle these entries identically to prefix-CDX hits."""
    anchor = datetime.strptime(unrec["post_wayback_ts"], "%Y%m%d%H%M%S")
    cap = datetime.strptime(picked["timestamp"], "%Y%m%d%H%M%S")
    distance_seconds = int(abs((cap - anchor).total_seconds()))
    filename = safe_filename(picked["original"], fallback=f"{picked['digest']}.bin")
    target_path = (
        f"public/img/posts/{unrec['board']}/{unrec['post_id']}/{filename}"
    )
    return {
        "board": unrec["board"],
        "post_id": unrec["post_id"],
        "source": unrec["source"],
        "comment_index": unrec.get("comment_index"),
        "raw_src": unrec["raw_src"],
        "normalized_url": unrec["normalized_url"],
        "matched_candidate": matched_candidate,
        "wayback_ts": picked["timestamp"],
        "wayback_original": picked["original"],
        "post_wayback_ts": unrec["post_wayback_ts"],
        "distance_seconds": distance_seconds,
        "cdx_digest": picked["digest"],
        "cdx_length": parse_int_or_none(picked["length"]),
        "cdx_mimetype": picked["mimetype"],
        "target_path": target_path,
        "filename": filename,
        # Provenance — distinguishes prefix-CDX hits from fallback hits.
        "discovery": "single_url_fallback",
    }


# ── Driver ──────────────────────────────────────────────────────────────


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(__doc__ or "single-URL CDX fallback").split("\n", 1)[0]
    )
    parser.add_argument("--limit", type=int, default=0,
                        help="process at most N unrecoverable entries (0 = all)")
    parser.add_argument("--print-every", type=int, default=25)
    parser.add_argument("--retry-misses", action="store_true",
                        help="re-probe entries previously recorded as 'miss'")
    parser.add_argument("--from", dest="from_ts", default=DEFAULT_FROM)
    parser.add_argument("--to", dest="to_ts", default=DEFAULT_TO)
    parser.add_argument("--dry-run", action="store_true",
                        help="enumerate candidates, do not probe Wayback")
    args = parser.parse_args()

    if not UNRECOVERABLE_FILE.exists():
        sys.exit(f"FATAL: unrecoverable file not found: {UNRECOVERABLE_FILE}")

    queue, dedup_keys = load_existing_queue()
    progress = load_progress()

    # ── Filter unrecoverable to no_canonical_match candidates ───────────-
    unrec_lines = UNRECOVERABLE_FILE.read_text(encoding="utf-8").splitlines()
    unrec_entries: list[dict] = []
    other_entries: list[dict] = []  # keep no_valid_image_row + others verbatim
    for line in unrec_lines:
        if not line.strip():
            continue
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if e.get("unrecoverable_reason") == "no_canonical_match":
            unrec_entries.append(e)
        else:
            other_entries.append(e)

    candidates: list[dict] = []
    for e in unrec_entries:
        key = (e["board"], e["post_id"], e["raw_src"])
        if key in dedup_keys:
            # Already recovered earlier (idempotent skip).
            continue
        prev = progress.get(key)
        if prev == "hit":
            continue
        if prev in ("miss", "error") and not args.retry_misses:
            continue
        candidates.append(e)

    if args.limit:
        candidates = candidates[: args.limit]

    print(
        f"[fallback] no_canonical_match={len(unrec_entries)} "
        f"queue_pre={len(queue)} candidates={len(candidates)} "
        f"already_attempted_skip={sum(1 for e in unrec_entries if (e['board'], e['post_id'], e['raw_src']) in progress) - 0} "
        f"dry_run={args.dry_run}",
        file=sys.stderr,
    )

    if not candidates:
        print("Nothing to do.", file=sys.stderr)
        return 0

    if args.dry_run:
        for e in candidates[:10]:
            print(
                f"  would probe {e['board']}/{e['post_id']} {e['raw_src'][:80]}",
                file=sys.stderr,
            )
        if len(candidates) > 10:
            print(f"  ... and {len(candidates) - 10} more", file=sys.stderr)
        return 0

    RUN_DIR.mkdir(parents=True, exist_ok=True)
    RUN_PID.write_text(str(__import__("os").getpid()))

    stats = {
        "candidates": len(candidates),
        "attempts": 0,
        "promoted": 0,
        "still_missing": 0,
        "errors": 0,
        "skipped_in_queue": len(unrec_entries) - len(candidates),
        "skipped_attempted": 0,
        "start": time.time(),
    }
    promoted: list[dict] = []
    last_print = 0

    for i, entry in enumerate(candidates, 1):
        stats["attempts"] += 1
        key = (entry["board"], entry["post_id"], entry["raw_src"])

        picked: dict | None = None
        matched_candidate: str | None = None
        try:
            for cand in entry["candidates"]:
                rows = cdx_probe(cand, from_ts=args.from_ts, to_ts=args.to_ts)
                if not rows:
                    continue
                hit = pick_cdx_row(rows, entry["post_wayback_ts"])
                if hit:
                    picked = hit
                    matched_candidate = cand
                    break
        except Exception as e:  # noqa: BLE001
            stats["errors"] += 1
            append_progress(
                {
                    "board": entry["board"],
                    "post_id": entry["post_id"],
                    "raw_src": entry["raw_src"],
                    "status": "error",
                    "error": f"{type(e).__name__}: {e}"[:200],
                }
            )
            continue

        if picked and matched_candidate is not None:
            queue_entry = build_queue_entry(entry, picked, matched_candidate)
            promoted.append(queue_entry)
            queue.append(queue_entry)
            dedup_keys.add(key)
            stats["promoted"] += 1
            append_progress(
                {
                    "board": entry["board"],
                    "post_id": entry["post_id"],
                    "raw_src": entry["raw_src"],
                    "status": "hit",
                    "wayback_ts": picked["timestamp"],
                    "wayback_original": picked["original"],
                    "matched_candidate": matched_candidate,
                }
            )
        else:
            stats["still_missing"] += 1
            append_progress(
                {
                    "board": entry["board"],
                    "post_id": entry["post_id"],
                    "raw_src": entry["raw_src"],
                    "status": "miss",
                }
            )

        if i - last_print >= args.print_every or i == len(candidates):
            last_print = i
            write_summary(stats)
            elapsed = time.time() - stats["start"]
            rate = stats["attempts"] / elapsed if elapsed > 0 else 0.0
            eta_min = (
                int((len(candidates) - i) / rate / 60) if rate > 0 else -1
            )
            print(
                f"[{i:>5}/{len(candidates)}] promoted={stats['promoted']} "
                f"miss={stats['still_missing']} err={stats['errors']} "
                f"{rate:.2f}/s ETA {eta_min}m",
                file=sys.stderr,
                flush=True,
            )

    # ── Atomic rewrites ─────────────────────────────────────────────────-
    tmp_q = QUEUE_FILE.with_suffix(".tmp")
    tmp_q.write_text(
        json.dumps(queue, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    tmp_q.replace(QUEUE_FILE)

    promoted_keys = {(p["board"], p["post_id"], p["raw_src"]) for p in promoted}
    new_unrecoverable = [
        e
        for e in unrec_entries
        if (e["board"], e["post_id"], e["raw_src"]) not in promoted_keys
    ]
    # Re-tag truly missing entries with single_url_also_missing
    for e in new_unrecoverable:
        if e.get("unrecoverable_reason") == "no_canonical_match":
            key = (e["board"], e["post_id"], e["raw_src"])
            if progress.get(key) == "miss" or stats["promoted"] > 0:
                e["unrecoverable_reason"] = "single_url_also_missing"

    # Combine no_valid_image_row (untouched) + updated no_canonical_match.
    final_unrec = other_entries + new_unrecoverable

    tmp_u = UNRECOVERABLE_FILE.with_suffix(".tmp")
    with tmp_u.open("w", encoding="utf-8") as f:
        for e in final_unrec:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")
    tmp_u.replace(UNRECOVERABLE_FILE)

    write_summary(stats)
    print(
        f"\n[fallback] DONE candidates={stats['candidates']} "
        f"promoted={stats['promoted']} still_missing={stats['still_missing']} "
        f"err={stats['errors']}",
        file=sys.stderr,
    )
    print(
        f"  queue: {len(queue) - stats['promoted']} → {len(queue)} "
        f"(+{stats['promoted']})",
        file=sys.stderr,
    )
    print(
        f"  unrecoverable: {len(unrec_entries) + len(other_entries)} → "
        f"{len(final_unrec)} ({stats['still_missing']} of which still single_url miss)",
        file=sys.stderr,
    )

    with contextlib.suppress(OSError):
        RUN_PID.unlink()
    return 0


if __name__ == "__main__":
    sys.exit(main())
