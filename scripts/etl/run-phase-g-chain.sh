#!/bin/bash
# Phase G chain orchestrator (ADR-0012).
#
# Runs cdx-image-fallback.py (single-URL probes → local CDX inventory),
# then chains:
#   cdx-image.py --queue-only  (Phase C join over sweeps + probe rows)
#   download-images.py  (Phase D re-run, picks up new queue entries)
#   04-rewrite-image-urls.py  (Phase F re-run, promotes data-recovery="ok")
#   measure-recovery.py --write-report  (Phase E re-measure)
#
# All steps are idempotent — re-runs skip files already present and only
# touch what's new. The chain logs to .docs/research/archive/images/
# for forensic visibility, and writes its own pid file so it can be
# monitored or killed cleanly.

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUN_DIR="$PROJECT_ROOT/.docs/research/archive/images"
PY="$PROJECT_ROOT/.venv/bin/python3"

CHAIN_PID="$RUN_DIR/.chain.run.pid"
CHAIN_LOG="$RUN_DIR/.chain.run.log"

mkdir -p "$RUN_DIR"
echo "$$" > "$CHAIN_PID"

cd "$PROJECT_ROOT"

log() {
  echo "[chain $(date +%FT%T)] $*" >> "$CHAIN_LOG"
}

log "starting chain orchestrator pid=$$"

# ── Stage 1 — Phase G probes, then the join ────────────────────────────-
# Extra arguments to this script go to the probe (e.g. --filter /_zb/data/).
log "stage 1: cdx-image-fallback.py $*"
"$PY" scripts/etl/cdx-image-fallback.py --print-every 50 "$@" \
  >> "$RUN_DIR/.fallback.run.log" 2>&1
log "stage 1: cdx-image.py --queue-only"
"$PY" scripts/etl/cdx-image.py --queue-only \
  >> "$RUN_DIR/.join.run.log" 2>&1
log "stage 1 done"

# ── Stage 2 — Phase D re-run (download newly queued entries) ───────────-
log "stage 2: download-images.py (Phase D re-run)"
"$PY" scripts/etl/download-images.py --print-every 100 \
  >> "$RUN_DIR/.run2.log" 2>&1
log "stage 2 done"

# ── Stage 3 — Phase F re-run (gold-tier rewrite) ───────────────────────-
log "stage 3: 04-rewrite-image-urls.py (Phase F re-run)"
"$PY" scripts/etl/04-rewrite-image-urls.py --print-every 1000 \
  >> "$RUN_DIR/.rewrite2.log" 2>&1
log "stage 3 done"

# ── Stage 4 — Phase E re-measure ───────────────────────────────────────-
log "stage 4: measure-recovery.py --write-report"
"$PY" scripts/etl/measure-recovery.py --write-report \
  >> "$RUN_DIR/.measure2.log" 2>&1
log "stage 4 done"

# ── Stage 5 — chain summary ────────────────────────────────────────────-
log "chain complete"

# Clean up.
rm -f "$CHAIN_PID"
