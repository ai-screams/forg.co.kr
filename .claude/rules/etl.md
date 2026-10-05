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
- **gold** `src/content/posts/{board}/{post_id}.json` — Pydantic-validated (`schemas.py`). 14,237 posts across 45 boards (2026-10-05). `02` skips the view Zeroboard drew empty for a post that no longer existed (`empty_view`: dated 1970, no comments); the 619 it once kept are in `src/content/empty-views/`, read by nothing. Parsers by engine: `02` Zeroboard 4.1 (incl. the `buzzard` event-calendar skin of `events_date`), `02b` Gnuboard4, `02d` Gnuboard5 (forg.kr), `02e` link/diary skins (L, L2 and the 2001 LZ list pages), `02f` Zeroboard 4.0, `02h` posts kept only in reply forms. `Post.capturedAt` is the real Wayback timestamp (fail-loud if missing); `parsedAt` is parse time.
- **listings** `src/content/listings/` — rows from captured list pages (`02c`, L and L2 merged by post number, newest capture wins), the only trace of many posts. Other captures print lists too — the list under a post view (Zeroboard 4.1, Gnuboard4) and the 2001 Zeroboard 4.0 lists (LZ pages and old-path views); `02c` adds their rows for numbers no list page holds, never replacing one (4,311 posts known from nowhere else, 2026-10-04). A row's guessed year never postdates its capture's Korean date: FunBoard renumbered, so gold neighbours can point years ahead.
- **index** `src/content/boards/{board}/index-{N}.json` — 50 rows/page, the board's own notices first, then `createdAt` desc, by `03-build-index.py` (1,198 chunks on 2026-10-05). `CONTINUES` there + `BoardMeta.continues` in `src/lib/boards.ts` carry an older board's rows under its successor.
- **marks** — a row's notice and reply icons (`list_notice`/`notice_head`/`icon_notice`, `reply_head`/`icon_reply` and the indent before it) become `isNotice` and `replyDepth` in the listing (`02c`). `03` copies them onto the post with that number only when the row is the post (`same_post`: titles agree, or for a notice the author does, as admins rewrote notice titles), since numbers repeat across installs. The listing always writes `isNotice` and writes `replyDepth` only on replies; the index writes each only when set. Rows carried from an older board (`CONTINUES`) drop `isNotice`.
- **site pages** `src/content/pages/{stem}.json` — see `routing-and-pages.md`.

Korean decode: **CP949 first, EUC-KR fallback with `errors="replace"`** — captures labelled `euc-kr` often contain CP949.

## Re-run traps

- Don't re-run a post parser over existing gold (`--force`, or for `02`/`02b` a silver file newer than its post, as after `01-decode.py --force`) — it rewrites the body from the capture and undoes Phase F's image rewrites and, for Zeroboard comments, the emoticon store. Patch fields with a targeted script instead (`05-repair-zeroboard-meta.py` is the model).
- A re-parsed post that lacks `createdAtApprox` also gains the key (the schema now always writes it), a diff on top of any body change. 12,572 of 14,218 gold posts lack it (`grep -L '"createdAtApprox"' -r src/content/posts --include='*.json' | wc -l`, 2026-10-04).
- Changing a post parser: `scripts/etl/tests/` (CI) checks a sample of captures; `scripts/etl/check_parsers.py` compares the change with `HEAD` on every silver capture (local). Run both before committing.
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
