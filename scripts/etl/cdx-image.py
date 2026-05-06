#!/usr/bin/env python3
"""ETL Phase C (ADR-0010 §Decision #3) — CDX prefix queries + manifest join.

For each of the 12 prefix targets in `PREFIX_LIST`, query the Wayback CDX
server with `matchType=prefix` and stash every returned row as one line of
`.docs/research/cdx/image-{slug}.jsonl`. The query phase is idempotent —
re-running skips prefixes whose jsonl already exists unless `--force` is
passed. CDX state files survive interruption so a half-finished prefix
resumes from the last `showResumeKey`.

Once all prefixes are on disk, build a `Dict[canonical_key, List[row]]`
multimap, walk the Phase B `image-manifest.jsonl`, and use `pick_cdx_row`
to pick the closest valid image row to each manifest entry's
`post_wayback_ts` (= the parser's truthful `Post.capturedAt`).

Outputs:
    scripts/etl/image-download-queue.json     entries Phase D will fetch
    scripts/etl/image-unrecoverable.jsonl     manifest entries with no hit
    scripts/etl/.image-cdx-summary.json       stats sidecar (gitignored)

Wayback politeness:
    Every CDX fetch goes through `wayback_client.global_polite_slot()`
    (fcntl.flock strict 1-worker). Two ETL stages running in parallel
    still emit one in-flight Wayback request total.
"""
from __future__ import annotations

import argparse
import contextlib
import json
import re
import sys
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Iterator
from urllib.parse import quote, unquote, urlencode, urlsplit

# Local module — extracted in Phase A1.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from wayback_client import (  # noqa: E402
    WaybackError,
    WaybackGoneError,
    fetch_with_retry,
    global_polite_slot,
)

# ── Paths ──────────────────────────────────────────────────────────────-
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
CDX_DIR = PROJECT_ROOT / ".docs" / "research" / "cdx"
MANIFEST_FILE = PROJECT_ROOT / "scripts" / "etl" / "image-manifest.jsonl"
QUEUE_FILE = PROJECT_ROOT / "scripts" / "etl" / "image-download-queue.json"
UNRECOVERABLE_FILE = PROJECT_ROOT / "scripts" / "etl" / "image-unrecoverable.jsonl"
SUMMARY_FILE = PROJECT_ROOT / "scripts" / "etl" / ".image-cdx-summary.json"
RUN_LOG = CDX_DIR / ".cdx-image.run.log"
RUN_PID = CDX_DIR / ".cdx-image.run.pid"

# ── 12 prefix targets (ADR-0010 §Decision #3, Iteration 2 lock-in) ─────-
# (slug, prefix). Slug is filename-safe; prefix is what we send to Wayback.
PREFIX_LIST: list[tuple[str, str]] = [
    # [1] Zeroboard assets — post URL `_zb/zboard.php` base
    ("forg-zb-data",     "forg.co.kr/_zb/data/"),
    ("forg-zb-emoticon", "forg.co.kr/_zb/emoticon/"),
    ("forg-zb-images",   "forg.co.kr/_zb/images/"),
    ("forg-zb-skin",     "forg.co.kr/_zb/skin/"),
    # [2] Gnuboard4 assets — post URL `bbs/board.php` base
    ("forg-bbs-data",    "forg.co.kr/bbs/data/"),
    ("forg-data",        "forg.co.kr/data/"),
    # [3] Site-wide chrome — post URL independent
    ("forg-images",      "forg.co.kr/images/"),
    ("forg-skin",        "forg.co.kr/skin/"),
    # [4] Sister / external — UO official + fansites + uospace group
    ("uospace",          "forg.uospace.net/"),
    ("uo-com",           "uo.com/"),
    ("uo-stratics",      "uo.stratics.com/"),
    ("sirl-uospace",     "sirl.uospace.net/"),
]

# ── Time range — limit to forg's active years to keep responses small ─-
DEFAULT_FROM = "19990101000000"  # forg founded 1999
DEFAULT_TO = "20151231235959"   # site went dark mid-2015

# ── CDX server config ──────────────────────────────────────────────────-
CDX_ENDPOINT = "https://web.archive.org/cdx/search/cdx"
CDX_PAGE_SIZE = 15000  # max rows per request; Wayback supports up to 150k

# ── Helpers ─────────────────────────────────────────────────────────────


def slugify_prefix_name(slug: str) -> Path:
    return CDX_DIR / f"image-{slug}.jsonl"


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


_PERCENT_SAFE = "/-._~!$&'()*+,;=:@"


def canonical_key(url: str) -> str:
    """Stable join key — host preserved, port normalized, path percent-encoding
    normalized to upper-case hex (matches Wayback CDX convention).

    ADR-0010 Iteration 2: do NOT strip `www.`. Wayback may capture
    `www.host` and `host` as separate URLs. Host variants live in the
    manifest's candidates list, not in the key.
    """
    p = urlsplit(url)
    scheme = (p.scheme or "http").lower()
    host = (p.hostname or "").lower()
    port = "" if p.port in (None, 80, 443) else f":{p.port}"
    try:
        path = quote(unquote(p.path), safe=_PERCENT_SAFE)
    except (ValueError, UnicodeDecodeError):
        path = p.path
    base = f"{scheme}://{host}{port}{path}"
    return f"{base}?{p.query}" if p.query else base


def pick_cdx_row(rows: list[dict], anchor_ts: str) -> dict | None:
    """Pick the valid image row closest in time to `anchor_ts`.

    - `anchor_ts` is `manifest.post_wayback_ts` (= truthful Post.capturedAt
      after Phase A2). Empty value violates the A2 contract → fail loud
      (Iteration 6: defense in depth, no silent fallback).
    - `valid_image_row` filter (status 200 + image/* + length > 0).
    - Distance computed in seconds (Iteration 4: CDX has second precision).
    - Prefer rows within ±30 days of the post capture; fall back to nearest
      valid row globally if the window is empty.
    """
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


# ── CDX fetch (paginated, polite) ───────────────────────────────────────


def _build_cdx_url(
    prefix: str,
    *,
    from_ts: str,
    to_ts: str,
    limit: int,
    resume_key: str | None = None,
    show_resume_key: bool = True,
) -> str:
    params: dict[str, str] = {
        "url": prefix,
        "matchType": "prefix",
        "output": "json",
        "from": from_ts,
        "to": to_ts,
        "limit": str(limit),
    }
    if show_resume_key:
        params["showResumeKey"] = "true"
    if resume_key:
        params["resumeKey"] = resume_key
    return f"{CDX_ENDPOINT}?{urlencode(params)}"


def _parse_cdx_chunk(raw: bytes) -> tuple[list[dict], str | None]:
    """Parse one CDX JSON response into `(rows, resume_key_or_None)`.

    The Wayback CDX server uses a column-header convention: first array
    is `[urlkey, timestamp, original, mimetype, statuscode, digest, length]`,
    every following array is one row. With `showResumeKey=true`, the last
    line (after a blank one) carries the next resume key.
    """
    try:
        data = json.loads(raw.decode("utf-8") or "[]")
    except json.JSONDecodeError:
        return [], None
    if not data:
        return [], None
    header, *rest = data
    cols = {name: i for i, name in enumerate(header)}

    resume_key: str | None = None
    # Pattern: [..., [], [resumeKey]]
    if rest and rest[-1] and len(rest[-1]) == 1 and (not rest[-2] if len(rest) >= 2 else False):
        resume_key = rest[-1][0]
        rest = rest[:-2]

    rows: list[dict] = []
    for r in rest:
        if not r or len(r) < len(header):
            continue
        rows.append(
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
    return rows, resume_key


def fetch_prefix(
    prefix: str,
    out_path: Path,
    *,
    from_ts: str,
    to_ts: str,
    limit_per_request: int,
    max_total_rows: int | None,
    log: Path,
) -> int:
    """Fetch one prefix end-to-end with pagination, return total row count.

    Writes a `.tmp` file first and renames atomically on success. Stays
    idempotent: caller skips when the final jsonl already exists.
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = out_path.with_suffix(out_path.suffix + ".tmp")
    if tmp.exists():
        tmp.unlink()

    total = 0
    resume_key: str | None = None
    chunk_idx = 0
    with tmp.open("w", encoding="utf-8") as out_handle:
        while True:
            url = _build_cdx_url(
                prefix,
                from_ts=from_ts,
                to_ts=to_ts,
                limit=limit_per_request,
                resume_key=resume_key,
            )
            chunk_idx += 1
            with global_polite_slot():
                try:
                    raw = fetch_with_retry(url)
                except WaybackGoneError as e:
                    _append_log(log, f"[{prefix}] gone: {e}")
                    break
                except WaybackError as e:
                    _append_log(log, f"[{prefix}] error: {e}")
                    raise
            rows, next_resume = _parse_cdx_chunk(raw)
            for row in rows:
                out_handle.write(json.dumps(row, ensure_ascii=False) + "\n")
            total += len(rows)
            _append_log(
                log,
                f"[{prefix}] chunk {chunk_idx} rows={len(rows)} cumulative={total} "
                f"resume_key={'yes' if next_resume else 'no'}",
            )
            if max_total_rows and total >= max_total_rows:
                _append_log(log, f"[{prefix}] hit max_total_rows={max_total_rows}, stop")
                break
            if not next_resume:
                break
            resume_key = next_resume

    tmp.replace(out_path)
    return total


def _append_log(log: Path, line: str) -> None:
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("a", encoding="utf-8") as f:
        f.write(f"{datetime.now().isoformat(timespec='seconds')} {line}\n")


# ── Multimap + manifest join ────────────────────────────────────────────


def load_cdx_index(slugs: list[str]) -> tuple[dict[str, list[dict]], int]:
    """Build `Dict[canonical_key, List[row]]` across all available prefix jsonl files."""
    cdx_index: dict[str, list[dict]] = defaultdict(list)
    total_rows = 0
    for slug in slugs:
        path = slugify_prefix_name(slug)
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            cdx_index[canonical_key(row["original"])].append(row)
            total_rows += 1
    return cdx_index, total_rows


# Strip only filesystem-dangerous characters. Preserve Unicode (Korean
# filenames are intentional — the museum value is in faithful preservation,
# and modern macOS / Linux / static-export hosts all handle UTF-8 fine).
_FILENAME_BAD_CHARS = re.compile(r'[\x00-\x1f/\\:*?"<>|]+')


def safe_filename(url: str, *, fallback: str) -> str:
    """Derive a filesystem-safe filename from a URL path.

    Preserves non-ASCII (Korean filenames stay intact) so that posts with
    multiple Korean basenames don't collapse into colliding `jpg` / `JPG`
    stubs. Strips only chars that break common filesystems and trims length
    to 180 chars (HFS+ / APFS / ext4 / NTFS all permit ≥ 255 bytes; 180 keeps
    headroom for sha-prefix collision handling later).

    Falls back to `fallback` only when the basename is genuinely empty
    (URL ending in `/` with no trailing segment).
    """
    path = urlsplit(url).path
    base = path.rsplit("/", 1)[-1]
    base = unquote(base)
    base = _FILENAME_BAD_CHARS.sub("_", base).strip("._- ")
    if not base:
        return fallback
    if len(base) > 180:
        base = base[:180]
    return base


def join_manifest_to_queue(
    manifest_path: Path,
    cdx_index: dict[str, list[dict]],
) -> tuple[list[dict], list[dict]]:
    queue: list[dict] = []
    unrecoverable: list[dict] = []

    for raw_line in manifest_path.read_text(encoding="utf-8").splitlines():
        if not raw_line.strip():
            continue
        entry = json.loads(raw_line)
        anchor_ts = entry["post_wayback_ts"]

        picked: dict | None = None
        matched: str | None = None
        any_in_index = False
        for cand in entry["candidates"]:
            rows = cdx_index.get(canonical_key(cand))
            if not rows:
                continue
            any_in_index = True
            hit = pick_cdx_row(rows, anchor_ts)
            if hit:
                picked = hit
                matched = cand
                break

        if picked:
            anchor = datetime.strptime(anchor_ts, "%Y%m%d%H%M%S")
            cap = datetime.strptime(picked["timestamp"], "%Y%m%d%H%M%S")
            distance_seconds = int(abs((cap - anchor).total_seconds()))
            filename = safe_filename(
                picked["original"], fallback=f"{picked['digest']}.bin"
            )
            target_path = (
                f"public/img/posts/{entry['board']}/{entry['post_id']}/{filename}"
            )
            queue.append(
                {
                    "board": entry["board"],
                    "post_id": entry["post_id"],
                    "source": entry["source"],
                    "comment_index": entry["comment_index"],
                    "raw_src": entry["raw_src"],
                    "normalized_url": entry["normalized_url"],
                    "matched_candidate": matched,
                    "wayback_ts": picked["timestamp"],
                    "wayback_original": picked["original"],
                    "post_wayback_ts": anchor_ts,
                    "distance_seconds": distance_seconds,
                    "cdx_digest": picked["digest"],
                    "cdx_length": parse_int_or_none(picked["length"]),
                    "cdx_mimetype": picked["mimetype"],
                    "target_path": target_path,
                    "filename": filename,
                }
            )
        else:
            reason = "no_canonical_match" if not any_in_index else "no_valid_image_row"
            unrecoverable.append(
                {
                    **entry,
                    "unrecoverable_reason": reason,
                }
            )

    return queue, unrecoverable


# ── Driver ──────────────────────────────────────────────────────────────


def iter_prefixes(prefix_only: int | None) -> Iterator[tuple[str, str]]:
    if prefix_only and prefix_only > 0:
        yield from PREFIX_LIST[:prefix_only]
    else:
        yield from PREFIX_LIST


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(__doc__ or "CDX prefix queries + manifest join").split("\n", 1)[0]
    )
    parser.add_argument("--from", dest="from_ts", default=DEFAULT_FROM)
    parser.add_argument("--to", dest="to_ts", default=DEFAULT_TO)
    parser.add_argument(
        "--prefix-only",
        type=int,
        default=0,
        help="run only the first N prefixes (for smoke testing)",
    )
    parser.add_argument(
        "--limit-per-prefix",
        type=int,
        default=0,
        help="cap total rows per prefix (0 = no cap, full coverage)",
    )
    parser.add_argument(
        "--limit-per-request",
        type=int,
        default=CDX_PAGE_SIZE,
        help=f"rows per CDX request (default {CDX_PAGE_SIZE})",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="overwrite existing per-prefix jsonl",
    )
    parser.add_argument(
        "--queue-only",
        action="store_true",
        help="skip CDX fetch — assume jsonl files already exist, only build queue",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="parse + summarise; do not write any output file",
    )
    parser.add_argument(
        "--print-every",
        type=int,
        default=1,
        help="progress cadence (per prefix)",
    )
    args = parser.parse_args()

    CDX_DIR.mkdir(parents=True, exist_ok=True)
    if not MANIFEST_FILE.exists():
        sys.exit(f"FATAL: manifest not found: {MANIFEST_FILE}")

    # Record run pid for resume / kill workflow.
    if not args.dry_run:
        RUN_PID.write_text(str(__import__("os").getpid()))

    # ── Step 1: fetch CDX (per-prefix, idempotent) ──────────────────────-
    fetched_summary: dict[str, dict[str, int | str]] = {}
    if not args.queue_only:
        prefixes = list(iter_prefixes(args.prefix_only or None))
        for i, (slug, prefix) in enumerate(prefixes, 1):
            out = slugify_prefix_name(slug)
            if out.exists() and not args.force:
                size = sum(1 for _ in out.read_text(encoding="utf-8").splitlines() if _.strip())
                fetched_summary[slug] = {"rows": size, "status": "cached"}
                print(
                    f"[{i}/{len(prefixes)}] {slug:<20} rows={size} (cached)",
                    file=sys.stderr,
                )
                continue
            if args.dry_run:
                fetched_summary[slug] = {"rows": 0, "status": "dry-run-skipped"}
                print(f"[{i}/{len(prefixes)}] {slug:<20} (dry-run skipped)", file=sys.stderr)
                continue
            t0 = time.time()
            try:
                count = fetch_prefix(
                    prefix,
                    out,
                    from_ts=args.from_ts,
                    to_ts=args.to_ts,
                    limit_per_request=args.limit_per_request,
                    max_total_rows=args.limit_per_prefix or None,
                    log=RUN_LOG,
                )
            except WaybackError as e:
                fetched_summary[slug] = {"rows": 0, "status": f"error: {e}"}
                print(f"[{i}/{len(prefixes)}] {slug:<20} ERROR {e}", file=sys.stderr)
                continue
            fetched_summary[slug] = {
                "rows": count,
                "status": "ok",
                "elapsed_s": int(time.time() - t0),
            }
            print(
                f"[{i}/{len(prefixes)}] {slug:<20} rows={count} "
                f"elapsed={int(time.time() - t0)}s",
                file=sys.stderr,
            )

    # ── Step 2: build multimap from disk ────────────────────────────────-
    slugs = [s for s, _ in PREFIX_LIST]
    cdx_index, cdx_total = load_cdx_index(slugs)
    print(
        f"[index] canonical_keys={len(cdx_index)} total_rows={cdx_total}",
        file=sys.stderr,
    )

    # ── Step 3: join manifest → queue / unrecoverable ───────────────────-
    queue, unrecoverable = join_manifest_to_queue(MANIFEST_FILE, cdx_index)
    print(
        f"[join] queue={len(queue)} unrecoverable={len(unrecoverable)} "
        f"total_manifest={len(queue) + len(unrecoverable)}",
        file=sys.stderr,
    )

    # ── Step 4: write outputs ───────────────────────────────────────────-
    if not args.dry_run:
        with contextlib.ExitStack() as stack:
            qf = stack.enter_context(QUEUE_FILE.with_suffix(".tmp").open("w", encoding="utf-8"))
            qf.write(json.dumps(queue, ensure_ascii=False, indent=1) + "\n")
        QUEUE_FILE.with_suffix(".tmp").replace(QUEUE_FILE)

        with UNRECOVERABLE_FILE.with_suffix(".tmp").open("w", encoding="utf-8") as uf:
            for entry in unrecoverable:
                uf.write(json.dumps(entry, ensure_ascii=False) + "\n")
        UNRECOVERABLE_FILE.with_suffix(".tmp").replace(UNRECOVERABLE_FILE)

    # ── Step 5: summary ─────────────────────────────────────────────────-
    reason_counter: dict[str, int] = defaultdict(int)
    for entry in unrecoverable:
        reason_counter[entry["unrecoverable_reason"]] += 1
    summary = {
        "manifest_total": len(queue) + len(unrecoverable),
        "queue": len(queue),
        "unrecoverable": len(unrecoverable),
        "unrecoverable_reasons": dict(reason_counter),
        "cdx_canonical_keys": len(cdx_index),
        "cdx_total_rows": cdx_total,
        "per_prefix": fetched_summary,
        "dry_run": args.dry_run,
        "ts": int(time.time()),
    }
    SUMMARY_FILE.write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(
        f"\n[cdx-image] DONE manifest={len(queue) + len(unrecoverable)} "
        f"queue={len(queue)} unrecoverable={len(unrecoverable)} "
        f"reasons={dict(reason_counter)}",
        file=sys.stderr,
    )

    if RUN_PID.exists():
        with contextlib.suppress(OSError):
            RUN_PID.unlink()
    return 0


if __name__ == "__main__":
    sys.exit(main())
