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
- **gold** `src/content/posts/{board}/{post_id}.json` — Pydantic-validated (`schemas.py`). 14,237 posts across 45 boards (2026-10-05). `02` skips the view Zeroboard drew empty for a post that no longer existed (`empty_view`: dated 1970, no comments); the 619 it once kept are in `src/content/empty-views/`, read by nothing. Parsers by engine: `02` Zeroboard 4.1 (incl. the `buzzard` event-calendar skin of `events_date`), `02b` Gnuboard4, `02d` Gnuboard5 (forg.kr), `02e` skins whose list page is the post (link, diary, the 2001 notice and file-room skins, the 2006 file library; L, L2 and the 2001 LZ list pages — Recall's 2006 captures go to `Recall2006`, a board renumbered under the same id, and the 2001 notice list's Best_UO box gives `Today` two posts), `02f` Zeroboard 4.0, `02h` posts kept only in reply forms, `02i` the polls of `UO_Vote` (each poll a post from its list pages; the two views that survive add votes and comments; all undated, so the list keeps the poll order). `Post.capturedAt` is the real Wayback timestamp (fail-loud if missing); `parsedAt` is parse time.
- **listings** `src/content/listings/` — rows from captured list pages (`02c`, L and L2 merged by post number, newest capture wins), the only trace of many posts. Other captures print lists too — the list under a post view (Zeroboard 4.1, Gnuboard4) and the 2001 Zeroboard 4.0 lists (LZ pages and old-path views); `02c` adds their rows for numbers no list page holds, never replacing one (4,311 posts known from nowhere else, 2026-10-04). The museum's post of a row's number gives the row its date only when it is that post (`is_its_post`: the titles agree, or the row printed the post's own MM/DD and the authors agree or one title, six characters at least, starts the other); a number holding another post puts the row in another install, so the page's order gives the year (`yearApprox`). Boards numbered again from 1 — Sell three times in 2001, most boards in 2005 — are in `RESTARTS`, each with the captures that show it: a row captured on a later day takes no year from an older install's post and no page year before the restart (unless raising it would date the row after its own capture: the page's year then stays, marked `yearApprox`), and when its MM/DD fits only one day between the restart and the first capture showing its number or a higher one, that day. A page's year is walked from its capture's Korean date. A row's guessed year never postdates its capture's Korean date (gold neighbours can point years ahead or behind), and a neighbour's year that would put the row before its lower neighbour or after its upper one gives way to the page's order, marked `yearApprox` (`pin_year`). Last come linked rows: posts a capture names by title outside any list — the front page's latest boxes (`S/_root`), a 2001 list page's latest-posts box (LZ), a 2001 view's Prev/Next. A frame's printed `MM/DD` is dated by the box's order alone (`yearApprox`; gold neighbours mislead on renumbered boards); otherwise `createdAt` is a day the post precedes — the capture's, a view's own post's, or a newer post's beside it whose title matches the museum's (gold or a printed full date, never a guessed year) — marked `datedByCapture` (293 rows, 2026-10-07).
- **index** `src/content/boards/{board}/index-{N}.json` — 50 rows/page, the board's own notices first, then `createdAt` desc, by `03-build-index.py` (1,231 chunks for 66 boards on 2026-10-06). A board known only from its list pages is indexed from its listing alone (`board_names`). `CONTINUES` there + `BoardMeta.continues` in `src/lib/boards.ts` carry an older board's rows under its successor.
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
