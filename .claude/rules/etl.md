---
paths:
  - "scripts/**"
  - "src/content/**"
  - "public/img/**"
---

# ETL pipeline (ADR-0004, ADR-0007, ADR-0010, ADR-0012, ADR-0017, ADR-0018)

## Tiers

Raw tiers live under `.docs/research/` (gitignored); gold ships in git.

- **bronze** `archive/{phase}/{board}/{post_id}.html` — raw Wayback captures (EUC-KR/CP949), immutable. `scripts/etl/download.py --phase X` reads the phase's CDX plan (phase A left `ScreenShot/10481` behind on a since-fixed URL-encoding bug; the next run picks it up). Phases: A, B, C, L (list pages, one capture each), L2 (every other capture of a list page), U, Z, Y, T, V, W (later captures of kept posts), LZ, S (site pages), R (reply forms).
- **silver** `archive-clean/{phase}/…` — UTF-8, Wayback chrome stripped, by `01-decode.py` (atomic writes, idempotent). Captures were fetched with `id_`, so its chrome counters are normally 0; keep the cleanup for `if_`/`fw_` re-downloads.
- **gold** `src/content/posts/{board}/{post_id}.json` — Pydantic-validated (`schemas.py`). 14,837 posts across 45 boards (2026-10-01). Parsers by engine: `02` Zeroboard 4.1 (incl. the `buzzard` event-calendar skin of `events_date`), `02b` Gnuboard4, `02d` Gnuboard5 (forg.kr), `02e` link/diary skins, `02f` Zeroboard 4.0, `02h` posts kept only in reply forms. `Post.capturedAt` is the real Wayback timestamp (fail-loud if missing); `parsedAt` is parse time.
- **listings** `src/content/listings/` — rows from captured list pages (`02c`, L and L2 merged by post number, newest capture wins), the only trace of many posts. A row's guessed year never postdates its capture's Korean date: FunBoard renumbered, so gold neighbours can point years ahead.
- **index** `src/content/boards/{board}/index-{N}.json` — 50 rows/page, `createdAt` desc, by `03-build-index.py` (1,062 chunks on 2026-10-03). `CONTINUES` there + `BoardMeta.continues` in `src/lib/boards.ts` carry an older board's rows under its successor.
- **site pages** `src/content/pages/{stem}.json` — see `routing-and-pages.md`.

Korean decode: **CP949 first, EUC-KR fallback with `errors="replace"`** — captures labelled `euc-kr` often contain CP949.

## Re-run traps

- Don't re-run `02-parse-zeroboard.py` over existing gold — it undoes the image rewrites and the emoticon store; patch fields with a targeted script (`05-repair-zeroboard-meta.py` is the model).
- Don't re-run `extract-image-urls.py` for a few new posts — the manifest drifts; append the entries instead.
- A bad character can be in the capture itself (map coordinates' `?` is a literal 0x3F in every 2001–2007 capture) — check raw bronze bytes before blaming decoding.
- Site captures after 2016-08-31 are a 2023 parking page of a new registrant — ignored by `LAST_TS`.

## Images

Pipeline: `wayback_client.py` (shared polite limiter) → `extract-image-urls.py` (manifest) → `cdx-image.py` (prefix sweeps + canonical-key join) → `download-images.py` (+ per-post `.manifest.json` sidecars) → `04-rewrite-image-urls.py` (src → `/img/posts/…` or `/img/placeholder/missing.svg`, original kept on `data-original-src`) → `measure-recovery.py`. Single-URL probes for what sweeps missed: `cdx-image-fallback.py`, chained by `run-phase-g-chain.sh`.

Result (2026-09-30): 30% of body photos (1,477/4,850). The rest is confirmed absent from Wayback (prefix sweep complete, single-URL probes empty) — don't re-run recovery hoping for more.

Storage (ADR-0018): bytes under `public/img/posts/` are git-ignored and live in R2 `forg-img` (`img.forg.co.kr`); sidecars are tracked. `src/lib/img-base.ts` prefixes `NEXT_PUBLIC_IMG_BASE` at render time (unset → local files). Emoticons (`public/img/emoticon/`) and chrome (`public/img/chrome/`) stay in git.

## Background downloads

Wayback IP-blocks aggressive clients: 1 worker, 4s base delay, jitter, backoff, 1-hour sleep after `BLOCK_THRESHOLD` refusals. One Wayback job at a time; don't raise concurrency. Downloads are resumable and keep state in `.docs/research/archive/` (`.run.pid`, `.summary.json`, `.progress.jsonl`, `.errors.jsonl`).

Waiting on a job: `pgrep -f "download.py"` matches the waiting shell itself — use `[d]ownload.py` or the PID from `.run.pid` with `kill -0`.

## Python environment

```bash
python3 -m venv .venv
.venv/bin/pip install -r scripts/etl/requirements.txt
.venv/bin/python3 scripts/etl/01-decode.py [--limit N] [--force] [--dry-run]
```
