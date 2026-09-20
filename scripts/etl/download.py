#!/usr/bin/env python3
"""Forg.co.kr Wayback downloader — resumable, polite, single-worker.

Reads `e-policy-plan.json`, downloads chosen captures via Wayback's `id_`
modifier (raw archived bytes, no Wayback chrome injection).

Filesystem layout:
  archive/{phase}/{board}/{post_id}.html      final saved file
  archive/.progress.jsonl                     one line per completion (resume key)
  archive/.errors.jsonl                       one line per failure
  archive/.summary.json                       running summary

Resume: re-running the script skips any post_id that already has a non-empty
file or is recorded in .progress.jsonl.

Concurrency: cross-process strict 1-worker via `wayback_client.global_polite_slot`
— even if `download.py` and `download-images.py` run simultaneously, Wayback
sees exactly one in-flight request from this archive.

The retry / backoff / IP-block detection / URL encoding lives in
`scripts/etl/wayback_client.py`. This script is responsible for the post
capture pipeline (plan → bronze tier path) only.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from wayback_client import (
    WaybackError,
    WaybackGoneError,
    fetch_with_retry,
    global_polite_slot,
    wayback_url,
)

ROOT = Path(__file__).resolve().parent.parent.parent / ".docs" / "research"
PLAN_FILE = ROOT / "cdx" / "e-policy-plan.json"
ARCHIVE = ROOT / "archive"
PROGRESS_FILE = ARCHIVE / ".progress.jsonl"
ERRORS_FILE = ARCHIVE / ".errors.jsonl"
SUMMARY_FILE = ARCHIVE / ".summary.json"

_stats = {"done": 0, "skipped": 0, "errors": 0, "bytes": 0, "start": time.time()}


def safe_board(name: str) -> str:
    """Sanitize board name for filesystem."""
    return "".join(c if c.isalnum() or c in "-_." else "_" for c in name)


def post_path(entry: dict) -> Path:
    return ARCHIVE / entry["phase"] / safe_board(entry["board"]) / f"{entry['post_id']}.html"


def append_jsonl(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")


def write_summary() -> None:
    elapsed = time.time() - _stats["start"]
    rate = _stats["done"] / elapsed if elapsed > 0 else 0
    SUMMARY_FILE.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY_FILE.write_text(json.dumps({
        "done": _stats["done"],
        "skipped": _stats["skipped"],
        "errors": _stats["errors"],
        "bytes_downloaded": _stats["bytes"],
        "elapsed_s": int(elapsed),
        "rate_per_s": round(rate, 2),
        "ts": int(time.time()),
    }, indent=2))


def load_done_ids() -> set:
    """Resume support: read existing progress file."""
    done = set()
    if PROGRESS_FILE.exists():
        for line in PROGRESS_FILE.read_text().splitlines():
            try:
                rec = json.loads(line)
                done.add((rec["phase"], rec["board"], rec["post_id"]))
            except (json.JSONDecodeError, KeyError):
                continue
    return done


def fetch_one(entry: dict) -> dict:
    """Fetch a single post capture and write it to disk.

    Returns a result dict for logging. Skip-on-disk happens before acquiring
    the polite slot so resumed runs cost nothing.
    """
    out = post_path(entry)
    if out.exists() and out.stat().st_size > 0:
        _stats["skipped"] += 1
        return {
            "status": "skipped",
            "phase": entry["phase"],
            "board": entry["board"],
            "post_id": entry["post_id"],
            "path": str(out),
        }

    out.parent.mkdir(parents=True, exist_ok=True)
    url = wayback_url(entry["ts"], entry["url"])

    try:
        with global_polite_slot():
            data = fetch_with_retry(url)
    except WaybackGoneError as e:
        _stats["errors"] += 1
        return {
            "status": "error",
            "phase": entry["phase"],
            "board": entry["board"],
            "post_id": entry["post_id"],
            "error": str(e),
            "url": url,
        }
    except WaybackError as e:
        _stats["errors"] += 1
        return {
            "status": "error",
            "phase": entry["phase"],
            "board": entry["board"],
            "post_id": entry["post_id"],
            "error": str(e)[:200],
            "url": url,
        }

    tmp = out.with_suffix(out.suffix + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(out)
    _stats["done"] += 1
    _stats["bytes"] += len(data)
    return {
        "status": "ok",
        "phase": entry["phase"],
        "board": entry["board"],
        "post_id": entry["post_id"],
        "bytes": len(data),
        "ts": entry["ts"],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", default="A", help="A / B / C / L (filter)")
    parser.add_argument(
        "--plan",
        type=Path,
        default=PLAN_FILE,
        help="plan JSON (default: e-policy-plan.json; listings-plan.json for phase L)",
    )
    parser.add_argument("--limit", type=int, default=0, help="0 = no limit")
    parser.add_argument("--print-every", type=int, default=50)
    args = parser.parse_args()

    plan = json.loads(args.plan.read_text())
    plan = [e for e in plan if e["phase"] == args.phase]
    if args.limit:
        plan = plan[: args.limit]

    done_ids = load_done_ids()
    todo = [
        e
        for e in plan
        if (e["phase"], e["board"], e["post_id"]) not in done_ids
        and not (post_path(e).exists() and post_path(e).stat().st_size > 0)
    ]

    print(
        f"Phase {args.phase}: {len(plan)} planned, "
        f"{len(plan) - len(todo)} already done, {len(todo)} to fetch",
        file=sys.stderr,
    )
    print(
        f"Strict 1-worker (cross-process), Output: {ARCHIVE}/",
        file=sys.stderr,
    )
    if not todo:
        print("Nothing to do.", file=sys.stderr)
        return

    ARCHIVE.mkdir(parents=True, exist_ok=True)
    write_summary()

    last_print = 0
    for i, entry in enumerate(todo, 1):
        try:
            result = fetch_one(entry)
        except Exception as e:  # noqa: BLE001 — outermost guard, log + continue
            _stats["errors"] += 1
            append_jsonl(ERRORS_FILE, {"error": str(e)[:200], "entry": entry})
            continue

        if result["status"] == "ok":
            append_jsonl(PROGRESS_FILE, result)
        elif result["status"] == "error":
            append_jsonl(ERRORS_FILE, result)

        if i - last_print >= args.print_every or i == len(todo):
            last_print = i
            write_summary()
            elapsed = time.time() - _stats["start"]
            rate = _stats["done"] / elapsed if elapsed > 0 else 0
            eta = (len(todo) - i) / rate if rate > 0 else -1
            print(
                f"[{i:>5}/{len(todo)}] done={_stats['done']} "
                f"skip={_stats['skipped']} err={_stats['errors']} "
                f"{_stats['bytes'] / 1024 / 1024:.1f}MB "
                f"{rate:.2f}/s ETA {int(eta / 60)}m",
                file=sys.stderr,
                flush=True,
            )

    write_summary()
    print(
        f"\nDone. {_stats['done']} fetched, {_stats['skipped']} skipped, "
        f"{_stats['errors']} errors, {_stats['bytes'] / 1024 / 1024:.1f} MB",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
