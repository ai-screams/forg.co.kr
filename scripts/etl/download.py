#!/usr/bin/env python3
"""Forg.co.kr Wayback downloader — parallel, resumable, polite.

Reads e-policy-plan.json, downloads chosen captures via Wayback's id_ modifier
(raw archived bytes, no Wayback chrome injection).

Filesystem layout:
  archive/{phase}/{board}/{post_id}.html      final saved file
  archive/.progress.jsonl                     one line per completion (resume key)
  archive/.errors.jsonl                       one line per failure
  archive/.summary.json                       running summary

Resume: re-running the script skips any post_id that already has a non-empty
file or is recorded in .progress.jsonl.

Concurrency: ThreadPoolExecutor with WORKERS workers. Each thread sleeps
DELAY_BETWEEN seconds after a request to spread load on Wayback.

Failures: 3 retries with exponential backoff (1s/3s/9s). 429/503 => long sleep.
"""
import argparse
import json
import random
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path("/Users/hanyul/Works/AiScream/forg/.docs/research")
PLAN_FILE = ROOT / "cdx" / "e-policy-plan.json"
ARCHIVE = ROOT / "archive"
PROGRESS_FILE = ARCHIVE / ".progress.jsonl"
ERRORS_FILE = ARCHIVE / ".errors.jsonl"
SUMMARY_FILE = ARCHIVE / ".summary.json"

WORKERS = 1               # single thread — Wayback rate limits per-IP
DELAY_BETWEEN = 4.0       # base delay between requests (≤15 RPM target)
JITTER = (0.0, 2.0)       # extra random sleep range
MAX_RETRIES = 4
RETRY_BACKOFF = [10, 60, 300, 1800]   # 10s → 1m → 5m → 30m
BLOCK_THRESHOLD = 5        # N consecutive connection-refused → long sleep
BLOCK_SLEEP = 3600         # 1 hour
USER_AGENT = "forg-archive/1.0 (hanyul.ryu@gmail.com; Korean MMORPG community preservation)"
TIMEOUT = 60

_lock = threading.Lock()
_stats = {"done": 0, "skipped": 0, "errors": 0, "bytes": 0, "start": time.time()}
_consecutive_block = 0   # tracks consecutive "Connection refused" to detect IP block


def safe_board(name: str) -> str:
    """Sanitize board name for filesystem."""
    return "".join(c if c.isalnum() or c in "-_." else "_" for c in name)


def post_path(entry: dict) -> Path:
    return ARCHIVE / entry["phase"] / safe_board(entry["board"]) / f"{entry['post_id']}.html"


def wayback_url(ts: str, original: str) -> str:
    """Build raw-content Wayback URL using id_ modifier."""
    return f"https://web.archive.org/web/{ts}id_/{original}"


def append_jsonl(path: Path, obj: dict) -> None:
    line = json.dumps(obj, ensure_ascii=False)
    with _lock:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a") as f:
            f.write(line + "\n")


def write_summary() -> None:
    with _lock:
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
    """Resume support: read existing progress file and existing files."""
    done = set()
    if PROGRESS_FILE.exists():
        for line in PROGRESS_FILE.read_text().splitlines():
            try:
                rec = json.loads(line)
                done.add((rec["phase"], rec["board"], rec["post_id"]))
            except (json.JSONDecodeError, KeyError):
                continue
    return done


def fetch(entry: dict) -> dict:
    """Download one capture. Returns result dict for logging."""
    url = wayback_url(entry["ts"], entry["url"])
    out = post_path(entry)

    # Skip if already saved
    if out.exists() and out.stat().st_size > 0:
        with _lock:
            _stats["skipped"] += 1
        return {"status": "skipped", "phase": entry["phase"], "board": entry["board"],
                "post_id": entry["post_id"], "path": str(out)}

    out.parent.mkdir(parents=True, exist_ok=True)

    global _consecutive_block
    last_err = None
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                data = resp.read()
                tmp = out.with_suffix(out.suffix + ".tmp")
                tmp.write_bytes(data)
                tmp.replace(out)
                with _lock:
                    _stats["done"] += 1
                    _stats["bytes"] += len(data)
                    _consecutive_block = 0   # reset on success
                time.sleep(DELAY_BETWEEN + random.uniform(*JITTER))
                return {"status": "ok", "phase": entry["phase"], "board": entry["board"],
                        "post_id": entry["post_id"], "bytes": len(data),
                        "ts": entry["ts"]}
        except urllib.error.HTTPError as e:
            last_err = f"HTTP {e.code}"
            if e.code == 429 or e.code == 503:
                # Honor Retry-After header if present, else use long backoff
                retry_after = int(e.headers.get("Retry-After", "0") or 0)
                wait = max(retry_after, RETRY_BACKOFF[min(attempt, len(RETRY_BACKOFF)-1)])
                with _lock:
                    print(f"  [rate-limited] HTTP {e.code}, sleeping {wait}s",
                          file=sys.stderr, flush=True)
                time.sleep(wait)
            elif e.code in (404, 410):
                break
            else:
                time.sleep(RETRY_BACKOFF[min(attempt, len(RETRY_BACKOFF)-1)])
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last_err = str(e)[:200]
            # Detect IP block: many consecutive Connection refused
            is_refused = "Connection refused" in last_err or "Errno 61" in last_err
            if is_refused:
                with _lock:
                    _consecutive_block += 1
                    blocked = _consecutive_block >= BLOCK_THRESHOLD
                if blocked:
                    with _lock:
                        print(f"  [BLOCK DETECTED] {_consecutive_block} consecutive "
                              f"refusals — sleeping {BLOCK_SLEEP}s (1h)",
                              file=sys.stderr, flush=True)
                        _consecutive_block = 0
                    time.sleep(BLOCK_SLEEP)
                    continue
            time.sleep(RETRY_BACKOFF[min(attempt, len(RETRY_BACKOFF)-1)])
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"[:200]
            time.sleep(RETRY_BACKOFF[min(attempt, len(RETRY_BACKOFF)-1)])

    with _lock:
        _stats["errors"] += 1
    return {"status": "error", "phase": entry["phase"], "board": entry["board"],
            "post_id": entry["post_id"], "error": last_err, "url": url}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", default="A", help="A / B / C (filter)")
    parser.add_argument("--workers", type=int, default=WORKERS)
    parser.add_argument("--limit", type=int, default=0, help="0 = no limit")
    parser.add_argument("--print-every", type=int, default=50)
    args = parser.parse_args()

    plan = json.loads(PLAN_FILE.read_text())
    plan = [e for e in plan if e["phase"] == args.phase]
    if args.limit:
        plan = plan[: args.limit]

    done_ids = load_done_ids()
    todo = [e for e in plan
            if (e["phase"], e["board"], e["post_id"]) not in done_ids
            and not (post_path(e).exists() and post_path(e).stat().st_size > 0)]

    print(f"Phase {args.phase}: {len(plan)} planned, {len(plan) - len(todo)} already done, "
          f"{len(todo)} to fetch", file=sys.stderr)
    print(f"Workers: {args.workers}, Delay: {DELAY_BETWEEN}s, Output: {ARCHIVE}/", file=sys.stderr)
    if not todo:
        print("Nothing to do.", file=sys.stderr)
        return

    ARCHIVE.mkdir(parents=True, exist_ok=True)
    write_summary()

    last_print = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(fetch, e): e for e in todo}
        for i, fut in enumerate(as_completed(futures), 1):
            try:
                result = fut.result()
            except Exception as e:
                with _lock:
                    _stats["errors"] += 1
                append_jsonl(ERRORS_FILE, {"error": str(e)[:200]})
                continue

            if result["status"] == "ok":
                append_jsonl(PROGRESS_FILE, result)
            elif result["status"] == "error":
                append_jsonl(ERRORS_FILE, result)

            if i - last_print >= args.print_every or i == len(todo):
                last_print = i
                write_summary()
                with _lock:
                    elapsed = time.time() - _stats["start"]
                    rate = _stats["done"] / elapsed if elapsed > 0 else 0
                    eta = (len(todo) - i) / rate if rate > 0 else -1
                    print(f"[{i:>5}/{len(todo)}] done={_stats['done']} "
                          f"skip={_stats['skipped']} err={_stats['errors']} "
                          f"{_stats['bytes']/1024/1024:.1f}MB "
                          f"{rate:.2f}/s ETA {int(eta/60)}m", file=sys.stderr, flush=True)

    write_summary()
    print(f"\nDone. {_stats['done']} fetched, {_stats['skipped']} skipped, "
          f"{_stats['errors']} errors, {_stats['bytes']/1024/1024:.1f} MB",
          file=sys.stderr)


if __name__ == "__main__":
    main()
