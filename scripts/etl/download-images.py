#!/usr/bin/env python3
"""ETL Phase D (ADR-0010 §Decision #4) — fetch the Wayback-recoverable
images recorded in image-download-queue.json into public/img/posts/.

Inputs:
    scripts/etl/image-download-queue.json     Phase C output (3,528 entries
                                              referencing 2,717 unique paths)

Outputs:
    public/img/posts/{board}/{post_id}/{filename}        the recovered binary
    public/img/posts/{board}/{post_id}/.manifest.json    per-post sidecar:
        [{filename, originalUrl, capturedAt, sizeBytes, sha256}]

Resume / runtime state (gitignored, mirrors download.py layout):
    .docs/research/archive/images/.run.pid
    .docs/research/archive/images/.summary.json
    .docs/research/archive/images/.progress.jsonl   one line per success
    .docs/research/archive/images/.errors.jsonl     one line per failure

Re-running skips paths whose target file is already on disk and non-empty,
so a 5-hour run interrupted at hour 2 resumes cleanly. The polite slot is
shared with download.py via wayback_client.global_polite_slot — even if
both scripts run in parallel, Wayback sees one request at a time.
"""
from __future__ import annotations

import argparse
import contextlib
import base64
import hashlib
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from wayback_client import (  # noqa: E402
    WaybackError,
    WaybackGoneError,
    fetch_with_retry,
    global_polite_slot,
    wayback_url,
)

# ── Paths ──────────────────────────────────────────────────────────────-
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
QUEUE_FILE = PROJECT_ROOT / "scripts" / "etl" / "image-download-queue.json"
OUTPUT_ROOT = PROJECT_ROOT / "public" / "img" / "posts"

RUN_DIR = PROJECT_ROOT / ".docs" / "research" / "archive" / "images"
RUN_PID = RUN_DIR / ".run.pid"
SUMMARY_FILE = RUN_DIR / ".summary.json"
PROGRESS_FILE = RUN_DIR / ".progress.jsonl"
ERRORS_FILE = RUN_DIR / ".errors.jsonl"


# ── Helpers ────────────────────────────────────────────────────────────-


def load_queue() -> list[dict]:
    if not QUEUE_FILE.exists():
        sys.exit(f"FATAL: queue not found: {QUEUE_FILE}")
    raw = json.loads(QUEUE_FILE.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        sys.exit(f"FATAL: queue is not a list: {QUEUE_FILE}")
    return raw


def dedup_by_target(queue: list[dict]) -> list[dict]:
    """Reduce 3,528 manifest references to ~2,717 unique target paths.

    The same comment emoticon URL is referenced in many separate comments
    of one post (e.g. `m_cry_smile.gif` 100×). Phase D needs to fetch each
    unique file once; Phase F's rewrite stage maps every manifest reference
    back to that single saved file, regardless of how many references hit it.
    """
    seen: dict[str, dict] = {}
    for e in queue:
        seen.setdefault(e["target_path"], e)
    return list(seen.values())


def load_progress() -> set[str]:
    """Build the set of (target_path) entries already recorded as ok."""
    done: set[str] = set()
    if not PROGRESS_FILE.exists():
        return done
    for line in PROGRESS_FILE.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        tp = rec.get("target_path")
        if tp:
            done.add(tp)
    return done


def append_jsonl(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")


def update_post_manifest(
    post_dir: Path,
    *,
    filename: str,
    original_url: str,
    captured_at: str,
    size_bytes: int,
    sha256_hex: str,
    digest: str,
) -> None:
    """Append (or update by filename) one entry in the per-post manifest.

    The manifest is `<post_dir>/.manifest.json`, a JSON list of
    `{filename, originalUrl, capturedAt, sizeBytes, sha256, digest}` objects
    (`digest` is Wayback's base32 SHA-1, the key the shared emoticon store
    uses to tell two versions of one filename apart; absent on entries
    written before 2026-09-20). The shared store's manifest has the same shape.
    Re-runs idempotently overwrite the entry for the same filename so a
    hash drift between Wayback captures (rare) doesn't accumulate stale
    rows.
    """
    manifest_path = post_dir / ".manifest.json"
    entries: list[dict] = []
    if manifest_path.exists():
        try:
            entries = json.loads(manifest_path.read_text(encoding="utf-8"))
            if not isinstance(entries, list):
                entries = []
        except json.JSONDecodeError:
            entries = []
    entries = [e for e in entries if e.get("filename") != filename]
    entries.append(
        {
            "filename": filename,
            "originalUrl": original_url,
            "capturedAt": captured_at,
            "sizeBytes": size_bytes,
            "sha256": sha256_hex,
            "digest": digest,
        }
    )
    entries.sort(key=lambda e: e["filename"])
    tmp = manifest_path.with_suffix(manifest_path.suffix + ".tmp")
    tmp.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    tmp.replace(manifest_path)


def write_summary(stats: dict) -> None:
    SUMMARY_FILE.parent.mkdir(parents=True, exist_ok=True)
    elapsed = time.time() - stats["start"]
    rate = stats["done"] / elapsed if elapsed > 0 else 0.0
    SUMMARY_FILE.write_text(
        json.dumps(
            {
                "queue_total": stats["queue_total"],
                "unique_paths": stats["unique_paths"],
                "todo_initial": stats["todo_initial"],
                "done": stats["done"],
                "skipped": stats["skipped"],
                "errors": stats["errors"],
                "bytes_downloaded": stats["bytes"],
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


# ── Per-image pipeline ─────────────────────────────────────────────────-


def wayback_digest(data: bytes) -> str:
    """The CDX `digest` column: base32 of SHA-1, no padding."""
    return base64.b32encode(hashlib.sha1(data).digest()).decode("ascii")


def fetch_one(entry: dict) -> dict:
    """Fetch one image from Wayback and persist target + per-post manifest.

    `entry` keys we use: board, post_id, filename, target_path,
    wayback_ts, wayback_original, post_wayback_ts, cdx_length.
    """
    target = PROJECT_ROOT / entry["target_path"]
    if target.exists() and target.stat().st_size > 0:
        return {"status": "skipped", "target_path": entry["target_path"]}

    wb = wayback_url(entry["wayback_ts"], entry["wayback_original"])
    try:
        with global_polite_slot():
            data = fetch_with_retry(wb)
    except WaybackGoneError as e:
        return {
            "status": "error",
            "target_path": entry["target_path"],
            "wayback_url": wb,
            "error": str(e),
        }
    except WaybackError as e:
        return {
            "status": "error",
            "target_path": entry["target_path"],
            "wayback_url": wb,
            "error": str(e)[:200],
        }

    target.parent.mkdir(parents=True, exist_ok=True)
    sha256_hex = hashlib.sha256(data).hexdigest()
    tmp = target.with_suffix(target.suffix + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(target)

    update_post_manifest(
        target.parent,
        filename=entry["filename"],
        original_url=entry["wayback_original"],
        captured_at=entry["wayback_ts"],
        size_bytes=len(data),
        sha256_hex=sha256_hex,
        digest=wayback_digest(data),
    )

    return {
        "status": "ok",
        "target_path": entry["target_path"],
        "bytes": len(data),
        "sha256": sha256_hex,
        "wayback_ts": entry["wayback_ts"],
        "wayback_original": entry["wayback_original"],
    }


# ── Driver ──────────────────────────────────────────────────────────────


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(__doc__ or "fetch wayback-recoverable images").split("\n", 1)[0]
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="process at most N unique images (0 = all)",
    )
    parser.add_argument(
        "--print-every",
        type=int,
        default=20,
        help="progress cadence (number of attempts between status lines)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="re-fetch even if target already exists",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="enumerate todo without fetching",
    )
    args = parser.parse_args()

    RUN_DIR.mkdir(parents=True, exist_ok=True)
    RUN_PID.write_text(str(__import__("os").getpid()))

    queue = load_queue()
    unique = dedup_by_target(queue)

    done_progress = set() if args.force else load_progress()
    todo: list[dict] = []
    for entry in unique:
        if not args.force:
            target = PROJECT_ROOT / entry["target_path"]
            if target.exists() and target.stat().st_size > 0:
                continue
            if entry["target_path"] in done_progress:
                continue
        todo.append(entry)
    if args.limit:
        todo = todo[: args.limit]

    print(
        f"[download-images] queue={len(queue)} unique_paths={len(unique)} "
        f"todo={len(todo)} skipped={len(unique) - len(todo)} "
        f"output={OUTPUT_ROOT} dry_run={args.dry_run}",
        file=sys.stderr,
    )
    if not todo:
        print("Nothing to do.", file=sys.stderr)
        with contextlib.suppress(OSError):
            RUN_PID.unlink()
        return 0

    if args.dry_run:
        for entry in todo[:10]:
            print(
                f"  would fetch {entry['target_path']} "
                f"<- {entry['wayback_ts']} {entry['wayback_original']}",
                file=sys.stderr,
            )
        if len(todo) > 10:
            print(f"  ... and {len(todo) - 10} more", file=sys.stderr)
        with contextlib.suppress(OSError):
            RUN_PID.unlink()
        return 0

    stats = {
        "queue_total": len(queue),
        "unique_paths": len(unique),
        "todo_initial": len(todo),
        "done": 0,
        "skipped": len(unique) - len(todo),
        "errors": 0,
        "bytes": 0,
        "start": time.time(),
    }
    write_summary(stats)

    last_print = 0
    for i, entry in enumerate(todo, 1):
        try:
            result = fetch_one(entry)
        except Exception as e:  # noqa: BLE001 — outermost guard
            stats["errors"] += 1
            append_jsonl(
                ERRORS_FILE,
                {
                    "target_path": entry["target_path"],
                    "wayback_original": entry["wayback_original"],
                    "wayback_ts": entry["wayback_ts"],
                    "error": f"{type(e).__name__}: {e}"[:200],
                },
            )
            continue

        if result["status"] == "ok":
            stats["done"] += 1
            stats["bytes"] += int(result.get("bytes", 0))
            append_jsonl(PROGRESS_FILE, result)
        elif result["status"] == "skipped":
            stats["skipped"] += 1
        else:  # error
            stats["errors"] += 1
            append_jsonl(ERRORS_FILE, result)

        if i - last_print >= args.print_every or i == len(todo):
            last_print = i
            write_summary(stats)
            elapsed = time.time() - stats["start"]
            rate = stats["done"] / elapsed if elapsed > 0 else 0.0
            eta_min = int((len(todo) - i) / rate / 60) if rate > 0 else -1
            print(
                f"[{i:>5}/{len(todo)}] done={stats['done']} "
                f"err={stats['errors']} skip={stats['skipped']} "
                f"{stats['bytes'] / 1024 / 1024:.1f}MB "
                f"{rate:.2f}/s ETA {eta_min}m",
                file=sys.stderr,
                flush=True,
            )

    write_summary(stats)
    print(
        f"\n[download-images] DONE done={stats['done']} "
        f"err={stats['errors']} skip={stats['skipped']} "
        f"{stats['bytes'] / 1024 / 1024:.1f}MB",
        file=sys.stderr,
    )
    with contextlib.suppress(OSError):
        RUN_PID.unlink()
    return 0


if __name__ == "__main__":
    sys.exit(main())
