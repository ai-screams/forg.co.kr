#!/usr/bin/env python3
"""ETL Phase E (ADR-0010) — measure image-recovery outcomes.

Aggregates the on-disk results from Phase D + the unrecoverable list from
Phase C into a single recovery report. The numbers feed ADR-0011's
storage decision (git direct vs LFS vs object storage) and surface any
re-evaluation triggers from ADR-0010 §"Re-evaluation triggers".

Inputs (read-only):
    public/img/posts/{board}/{post_id}/.manifest.json    Phase D sidecars
    scripts/etl/image-manifest.jsonl                     Phase B manifest
    scripts/etl/image-download-queue.json                Phase C queue
    scripts/etl/image-unrecoverable.jsonl                Phase C misses

Outputs:
    stdout report (per-board / per-host / per-reason / totals)
    .docs/research/cdx/.image-recovery-report.json       machine-readable
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
IMG_ROOT = PROJECT_ROOT / "public" / "img" / "posts"
MANIFEST_FILE = PROJECT_ROOT / "scripts" / "etl" / "image-manifest.jsonl"
QUEUE_FILE = PROJECT_ROOT / "scripts" / "etl" / "image-download-queue.json"
UNRECOVERABLE_FILE = PROJECT_ROOT / "scripts" / "etl" / "image-unrecoverable.jsonl"
REPORT_FILE = PROJECT_ROOT / ".docs" / "research" / "cdx" / ".image-recovery-report.json"

# ADR-0010 §Decision #8 storage thresholds.
GIT_DIRECT_LIMIT = 200 * 1024 * 1024      # 200 MB
LFS_LIMIT = 1 * 1024 * 1024 * 1024        # 1 GB


def fmt_bytes(n: int) -> str:
    if n >= 1024 ** 3:
        return f"{n / 1024 ** 3:.2f} GB"
    if n >= 1024 ** 2:
        return f"{n / 1024 ** 2:.1f} MB"
    if n >= 1024:
        return f"{n / 1024:.1f} KB"
    return f"{n} B"


def storage_decision(total_bytes: int) -> str:
    if total_bytes < GIT_DIRECT_LIMIT:
        return "git-direct"
    if total_bytes < LFS_LIMIT:
        return "git-lfs"
    return "object-storage"


def load_jsonl(path: Path) -> list[dict]:
    out: list[dict] = []
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="image-recovery measurement (Phase E)")
    parser.add_argument("--write-report", action="store_true",
                        help="write JSON report to .docs/research/cdx/")
    args = parser.parse_args()

    manifest = load_jsonl(MANIFEST_FILE)
    queue = (
        json.loads(QUEUE_FILE.read_text(encoding="utf-8")) if QUEUE_FILE.exists() else []
    )
    unrecoverable = load_jsonl(UNRECOVERABLE_FILE)

    # On-disk inventory + per-board byte tally.
    on_disk_files = 0
    on_disk_bytes = 0
    per_board_files: Counter[str] = Counter()
    per_board_bytes: Counter[str] = Counter()
    sidecar_count = 0
    sidecar_entries = 0
    for sidecar in IMG_ROOT.glob("*/*/.manifest.json"):
        sidecar_count += 1
        try:
            entries = json.loads(sidecar.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        board = sidecar.parent.parent.name
        for e in entries:
            sidecar_entries += 1
            on_disk_files += 1
            sz = int(e.get("sizeBytes") or 0)
            on_disk_bytes += sz
            per_board_files[board] += 1
            per_board_bytes[board] += sz

    # Manifest source-level counters (body vs comment).
    src_per_source: Counter[str] = Counter()
    for ref in manifest:
        src_per_source[ref["source"]] += 1

    # Queue source-level counters.
    queue_per_source: Counter[str] = Counter()
    for q in queue:
        queue_per_source[q["source"]] += 1

    # Unrecoverable host distribution + reasons.
    unrec_hosts: Counter[str] = Counter()
    unrec_reasons: Counter[str] = Counter()
    unrec_per_source: Counter[str] = Counter()
    for u in unrecoverable:
        host = (urlsplit(u["normalized_url"]).hostname or "").lower()
        unrec_hosts[host] += 1
        unrec_reasons[u.get("unrecoverable_reason", "?")] += 1
        unrec_per_source[u.get("source", "?")] += 1

    total_manifest = len(manifest)
    total_queue = len(queue)
    total_unrec = len(unrecoverable)

    # ── Print human report ───────────────────────────────────────────-
    print("=" * 64)
    print("forg.co.kr image recovery — Phase E measurement")
    print("=" * 64)
    print()
    print(f"manifest references     : {total_manifest:>6}")
    print(f"queue (recoverable)     : {total_queue:>6}  "
          f"({total_queue / total_manifest * 100:.1f}%)")
    print(f"unrecoverable           : {total_unrec:>6}  "
          f"({total_unrec / total_manifest * 100:.1f}%)")
    print()
    print(f"recovery by source:")
    for src in ("body", "comment"):
        m = src_per_source.get(src, 0)
        q = queue_per_source.get(src, 0)
        rate = (q / m * 100) if m else 0.0
        print(f"  {src:<10} manifest={m:>5}  queue={q:>5}  rate={rate:5.1f}%")
    print()
    print(f"on-disk inventory       :")
    print(f"  files                 : {on_disk_files:>6}")
    print(f"  per-post sidecars     : {sidecar_count:>6}")
    print(f"  sidecar entries       : {sidecar_entries:>6}")
    print(f"  bytes                 : {on_disk_bytes:>10}  ({fmt_bytes(on_disk_bytes)})")
    print()
    print("per-board inventory:")
    for board in sorted(per_board_files, key=lambda b: -per_board_files[b]):
        print(f"  {board:<15} files={per_board_files[board]:>5}  "
              f"bytes={fmt_bytes(per_board_bytes[board]):>10}")
    print()
    print("unrecoverable reason distribution:")
    for reason, c in unrec_reasons.most_common():
        print(f"  {c:>5}  {reason}")
    print()
    print("unrecoverable by source:")
    for src, c in unrec_per_source.most_common():
        print(f"  {c:>5}  {src}")
    print()
    print("unrecoverable top 15 hosts:")
    for host, c in unrec_hosts.most_common(15):
        print(f"  {c:>5}  {host}")
    print()
    print("=" * 64)
    print("storage decision (ADR-0010 §Decision #8)")
    print("=" * 64)
    decision = storage_decision(on_disk_bytes)
    print(f"  total            : {fmt_bytes(on_disk_bytes)}")
    print(f"  thresholds       : git-direct < 200 MB <= git-lfs < 1 GB <= object-storage")
    print(f"  decision         : {decision}")
    print()
    print("re-evaluation triggers:")
    print(f"  body recovery rate    : "
          f"{queue_per_source.get('body', 0) / src_per_source.get('body', 1) * 100:.1f}%  "
          f"(< 30% would warrant external mirror ADR)")
    print(f"  total bytes vs limit  : "
          f"{on_disk_bytes / GIT_DIRECT_LIMIT * 100:.1f}% of git-direct ceiling")
    print(f"  Korean-ISP hosts      : "
          f"{sum(c for h, c in unrec_hosts.items() if any(k in h for k in ('chollian', 'netian', 'daum', 'hanafos', 'freechal', 'sayclub', 'megapass', 'netian', 'shinhwi', 'introcom')))}"
          f" unrecoverable refs (documented trade-off)")
    print()
    if args.write_report:
        REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
        report = {
            "totals": {
                "manifest": total_manifest,
                "queue": total_queue,
                "unrecoverable": total_unrec,
                "on_disk_files": on_disk_files,
                "on_disk_bytes": on_disk_bytes,
            },
            "per_source": {
                "manifest": dict(src_per_source),
                "queue": dict(queue_per_source),
                "unrecoverable": dict(unrec_per_source),
            },
            "per_board": {
                "files": dict(per_board_files),
                "bytes": dict(per_board_bytes),
            },
            "unrecoverable_reasons": dict(unrec_reasons),
            "unrecoverable_hosts": dict(unrec_hosts.most_common(50)),
            "storage_decision": decision,
            "thresholds": {
                "git_direct_limit_bytes": GIT_DIRECT_LIMIT,
                "lfs_limit_bytes": LFS_LIMIT,
            },
        }
        REPORT_FILE.write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"Report written: {REPORT_FILE.relative_to(PROJECT_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
