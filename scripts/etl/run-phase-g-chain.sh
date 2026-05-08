#!/bin/bash
# Phase G chain orchestrator (ADR-0012).
#
# Waits for cdx-image-fallback.py to finish (the script is already running),
# then chains:
#   download-images.py  (Phase D re-run, picks up new queue entries)
#   04-rewrite-image-urls.py  (Phase F re-run, promotes data-recovery="ok")
#   measure-recovery.py --write-report  (Phase E re-measure)
#
# All steps are idempotent — re-runs skip files already present and only
# touch what's new. The chain logs to .docs/research/archive/images/
# for forensic visibility, and writes its own pid file so it can be
# monitored or killed cleanly.

set -e

PROJECT_ROOT="/Users/hanyul/Works/AiScream/forg"
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

# ── Stage 1 — wait for fallback to finish ──────────────────────────────-
FALLBACK_PID_FILE="$RUN_DIR/.fallback.run.pid"
if [[ -f "$FALLBACK_PID_FILE" ]]; then
  FALLBACK_PID=$(cat "$FALLBACK_PID_FILE")
  log "waiting for fallback pid=$FALLBACK_PID"
  while ps -p "$FALLBACK_PID" > /dev/null 2>&1; do
    sleep 120
  done
  log "fallback finished"
else
  log "no fallback pid file — assuming already done"
fi

# Brief grace period to let final atomic writes settle.
sleep 5

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
