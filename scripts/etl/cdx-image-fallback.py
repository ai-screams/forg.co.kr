#!/usr/bin/env python3
"""ETL Phase G (ADR-0012) — single-URL CDX probes for images the sweeps missed.

The Phase C prefix sweeps miss captures that an exact-match query finds
(P2.4's chrome recovery: 68/73 via single-URL probes after the prefix
query returned nothing). This probes every distinct URL still listed in
`image-unrecoverable.jsonl` **once** and appends what Wayback answers to
the local CDX inventory, where `cdx-image.py --queue-only` joins it like
any sweep. The probe knows nothing about posts, filenames or the emoticon
store — the join owns those.

Before 2026-09-20 this script probed per post entry and per candidate
variant (a 5,800-reference emoticon set would have cost thousands of
requests for 20 URLs) and wrote its own queue entries. Its output is now
rows, and one URL costs one request.

Inputs:
    scripts/etl/image-unrecoverable.jsonl   distinct `normalized_url`s

Outputs:
    .docs/research/cdx/image-probe.jsonl    rows in the sweep format, appended
    .docs/research/cdx/.probe-misses.jsonl  URLs Wayback had nothing for,
                                            so a re-run does not ask again
                                            (`--retry-misses` to ask anyway)

Then:
    cdx-image.py --queue-only → download-images.py → 04-rewrite-image-urls.py

Polite policy: the shared fcntl slot — one in-flight Wayback request.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode

sys.path.insert(0, str(Path(__file__).resolve().parent))
from wayback_client import (  # noqa: E402
    WaybackError,
    WaybackGoneError,
    canonical_key,
    fetch_with_retry,
    global_polite_slot,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
UNRECOVERABLE_FILE = PROJECT_ROOT / "scripts" / "etl" / "image-unrecoverable.jsonl"
CDX_DIR = PROJECT_ROOT / ".docs" / "research" / "cdx"
PROBE_FILE = CDX_DIR / "image-probe.jsonl"
MISSES_FILE = CDX_DIR / ".probe-misses.jsonl"

CDX_ENDPOINT = "https://web.archive.org/cdx/search/cdx"
DEFAULT_FROM = "19990101000000"
DEFAULT_TO = "20151231235959"
COLUMNS = ("urlkey", "timestamp", "original", "mimetype", "statuscode", "digest", "length")
OUTAGE_WAITS = 8       # re-ask the same URL this many times across an outage
OUTAGE_SLEEP = 1800    # seconds between those re-asks
# Session-bound dynamic handlers Wayback never captured as images (collection
# audit 2026-09-19, "시도하지 말 것"). A probe costs a request for a known answer.
NEVER_CAPTURED = ("editor.fileguri.com/editor/GetFile.asp", "daum.net/_c21_/pds_down", "img.srch.yahoo.co.kr")


def cdx_probe(url: str, *, from_ts: str, to_ts: str) -> list[dict]:
    """Exact-match CDX rows for `url` in the window. Wayback's urlkey folds
    `www.` and `:80`, so one probe covers the candidate variants."""
    params = {"url": url, "output": "json", "from": from_ts, "to": to_ts, "limit": "50"}
    with global_polite_slot():
        raw = fetch_with_retry(f"{CDX_ENDPOINT}?{urlencode(params)}")
    data = json.loads(raw.decode("utf-8") or "[]")
    if not data:
        return []
    header, *rows = data
    cols = {name: i for i, name in enumerate(header)}
    return [{c: r[cols[c]] for c in COLUMNS} for r in rows if r and len(r) >= len(header)]


def append_jsonl(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")


def load_known(path: Path, field: str) -> set[str]:
    if not path.exists():
        return set()
    keys: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            keys.add(canonical_key(json.loads(line)[field]))
    return keys


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n", 1)[0])
    parser.add_argument("--filter", default="", help="only URLs containing this substring")
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        help="skip URLs containing this substring (repeatable) — e.g. a prefix whose sweep is complete",
    )
    parser.add_argument("--limit", type=int, default=0, help="probe at most N URLs (0 = all)")
    parser.add_argument(
        "--unrecoverable",
        type=Path,
        default=UNRECOVERABLE_FILE,
        help="list to probe: the posts' (default) or scripts/etl/site-image-unrecoverable.jsonl",
    )
    parser.add_argument("--from", dest="from_ts", default=DEFAULT_FROM)
    parser.add_argument("--to", dest="to_ts", default=DEFAULT_TO)
    parser.add_argument("--retry-misses", action="store_true")
    parser.add_argument("--print-every", type=int, default=10)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.unrecoverable.exists():
        sys.exit(f"FATAL: {args.unrecoverable} not found — run cdx-image.py first")

    # Distinct URLs, most-referenced first so a --limit run buys the most.
    refs: dict[str, int] = {}
    urls: dict[str, str] = {}
    for line in args.unrecoverable.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        e = json.loads(line)
        # posts list `normalized_url`; the static pages' list (site-image-queue) `url`
        url = e.get("normalized_url") or e["url"]
        if args.filter and args.filter not in url:
            continue
        if any(marker in url for marker in NEVER_CAPTURED):
            continue
        if any(marker in url for marker in args.exclude):
            continue
        key = canonical_key(url)
        refs[key] = refs.get(key, 0) + 1
        urls.setdefault(key, url)

    probed = load_known(PROBE_FILE, "original")
    misses = set() if args.retry_misses else load_known(MISSES_FILE, "url")
    todo = [k for k in sorted(refs, key=refs.get, reverse=True) if k not in probed and k not in misses]
    if args.limit:
        todo = todo[: args.limit]
    print(
        f"[probe] distinct={len(refs)} already_probed={len(probed & set(refs))} "
        f"known_miss={len(misses & set(refs))} todo={len(todo)} "
        f"refs_covered={sum(refs[k] for k in todo)} window={args.from_ts[:8]}..{args.to_ts[:8]} "
        f"dry_run={args.dry_run}",
        file=sys.stderr,
    )
    if args.dry_run:
        for k in todo[:20]:
            print(f"  would probe {urls[k]}  (refs={refs[k]})", file=sys.stderr)
        return 0

    stats = {"hit": 0, "miss": 0, "error": 0, "rows": 0}
    t0 = time.time()
    for i, key in enumerate(todo, 1):
        url = urls[key]
        rows = None
        # An exhausted probe during a Wayback outage is not an answer about
        # this URL. Wait and ask the same URL again rather than burning the
        # retry ladder on the next one too (2026-09-21: five hours of 503s).
        for outage_wait in range(OUTAGE_WAITS + 1):
            try:
                rows = cdx_probe(url, from_ts=args.from_ts, to_ts=args.to_ts)
                break
            except WaybackGoneError:
                rows = []
                break
            except (WaybackError, json.JSONDecodeError) as e:
                if outage_wait == OUTAGE_WAITS:
                    stats["error"] += 1
                    print(f"  [error] {url}: {str(e)[:120]}", file=sys.stderr, flush=True)
                    break
                print(
                    f"  [outage] probe exhausted for {url[:80]} — waiting {OUTAGE_SLEEP}s "
                    f"({outage_wait + 1}/{OUTAGE_WAITS})",
                    file=sys.stderr,
                    flush=True,
                )
                time.sleep(OUTAGE_SLEEP)
        if rows is None:
            continue
        if rows:
            for r in rows:
                append_jsonl(PROBE_FILE, r)
            stats["hit"] += 1
            stats["rows"] += len(rows)
        else:
            append_jsonl(
                MISSES_FILE,
                {"url": url, "from": args.from_ts, "to": args.to_ts,
                 "ts": datetime.now().isoformat(timespec="seconds")},
            )
            stats["miss"] += 1
        if i % args.print_every == 0 or i == len(todo):
            print(
                f"[{i:>4}/{len(todo)}] hit={stats['hit']} miss={stats['miss']} "
                f"err={stats['error']} rows={stats['rows']} elapsed={int(time.time() - t0)}s",
                file=sys.stderr,
                flush=True,
            )

    print(
        f"\n[probe] DONE hit={stats['hit']} miss={stats['miss']} err={stats['error']} "
        f"rows={stats['rows']} → {PROBE_FILE.relative_to(PROJECT_ROOT)}; "
        f"next: cdx-image.py --queue-only",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
