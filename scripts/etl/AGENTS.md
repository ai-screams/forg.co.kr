<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-01 | Updated: 2026-10-01 -->

# scripts/etl

## Purpose

Python pipeline that turns raw Wayback Machine captures of forg.co.kr into
the gold-tier JSON the Next.js site reads (`src/content/posts/`,
`src/content/boards/`, `src/content/listings/`, `src/content/pages/`), plus
the image-recovery sub-pipeline that fetches recoverable body/chrome images
from Wayback into `public/img/`.

Tiers (bronze/silver/gold), re-run traps, Wayback politeness rules, and the
image-storage decision are documented in `.claude/rules/etl.md` — read that
first and don't duplicate it here.

## Key Files

| File                             | Description                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `analyze_cdx.py`                 | One-off CDX dedup helper — picks the best (latest, longest) capture per post, writes a download plan                     |
| `cdx-site.py`                    | CDX sweep for static pages outside the boards (writes `site-plan.json`, phase S)                                         |
| `cdx-inventory-to-jsonl.py`      | Converts a hand-saved CDX JSON array into the sweep's jsonl line format                                                  |
| `wayback_client.py`              | Shared polite Wayback client — cross-process `fcntl` rate-limit slot, retry/backoff, URL helpers                         |
| `download.py`                    | Phase A/B/C/L/S/… downloader — plan to bronze tier (`archive/{phase}/{board}/{post_id}.html`)                            |
| `01-decode.py`                   | Stage 1 — EUC-KR/CP949 decode + Wayback chrome strip, bronze to silver                                                   |
| `02-parse-zeroboard.py`          | Stage 2 — Zeroboard 4.1pl4 (`kritz_normal` skin) HTML to Post JSON                                                       |
| `02b-parse-gnuboard4.py`         | Stage 2b — Gnuboard4 (`webbus2009_basic` skin) HTML to Post JSON                                                         |
| `02c-parse-listing.py`           | Stage 2c — captured board list pages to `src/content/listings/{board}.json`                                              |
| `02d-parse-gnuboard5.py`         | Stage 2d — Gnuboard5 `st-basic` skin (forg.co.kr Ultima + forg.kr successor boards)                                      |
| `02e-parse-link-diary.py`        | Stage 2e — Zeroboard "link"/"diary" skins where the list page is the whole post                                          |
| `02f-parse-zeroboard40.py`       | Stage 2f — Zeroboard 4.0 posts from forg's pre-`/_zb/` board paths (phases Z/Y/U/T)                                      |
| `02g-parse-site.py`              | Stage 2g — static guide/map/frameset pages to `src/content/pages/{stem}.json`                                            |
| `02h-parse-reply-forms.py`       | Stage 2h — posts recovered only from a captured Zeroboard reply form                                                     |
| `03-build-index.py`              | Stage 3 — aggregates gold posts + listings into paginated `src/content/boards/{board}/index-{N}.json`                    |
| `04-rewrite-image-urls.py`       | Phase F — rewrites gold `<img src>` to recovered path or placeholder                                                     |
| `05-repair-zeroboard-meta.py`    | Targeted repair of comment/post author and date fields in existing Zeroboard gold posts                                  |
| `sanitise.py`                    | Shared nh3 HTML sanitiser config used by every parser                                                                    |
| `schemas.py`                     | Pydantic models mirroring `src/types/post.ts` — keep both in sync                                                        |
| `extract-image-urls.py`          | Phase B — builds `image-manifest.jsonl` from every `<img>` in gold posts                                                 |
| `cdx-image.py`                   | Phase C — CDX prefix sweeps + manifest join, writes the download queue and unrecoverable list                            |
| `cdx-image-fallback.py`          | Phase G — single-URL CDX probes for images the prefix sweeps missed                                                      |
| `download-images.py`             | Phase D — fetches queued images to `public/img/posts/{board}/{post_id}/` with `.manifest.json` sidecars                  |
| `measure-recovery.py`            | Phase E — aggregates recovery outcomes into a report                                                                     |
| `migrate-emoticon-store.py`      | One-off — moves duplicated comment emoticons into the shared `public/img/emoticon/` store                                |
| `recover-chrome.py`              | Single-URL probes for site chrome assets (`public/img/chrome/`), supports `--era 2003`/`--era 2014`                      |
| `site-image-queue.py`            | Joins `02g`'s `site-image-refs.jsonl` against CDX sweeps into `site-image-queue.json`                                    |
| `site-image-borrow.py`           | Fills missing site images from byte-identical copies: seven shared frame images, and folders copied whole (`uohistory`)  |
| `run-phase-g-chain.sh`           | Orchestrates the Phase G chain: fallback probe to join to download to rewrite to re-measure                              |
| `requirements.txt`               | Pinned deps: `beautifulsoup4>=4.13.0`, `lxml>=5.3.0`, `html5lib>=1.1`, `nh3>=0.2.0`, `pydantic>=2.10.0`, `pytest>=8.4.0` |
| `image-manifest.jsonl`           | Phase B output — one line per `<img>` reference across all gold posts                                                    |
| `image-unrecoverable.jsonl`      | Phase C output — manifest entries with no CDX hit                                                                        |
| `image-download-queue.json`      | Phase C output — entries Phase D fetches                                                                                 |
| `site-image-queue.json`          | Phase D queue for images on static pages (parallel to `image-download-queue.json`)                                       |
| `site-image-refs.jsonl`          | `02g` output — every forg image a static page references                                                                 |
| `site-image-unrecoverable.jsonl` | `site-image-queue.py` misses for static-page images                                                                      |

## For AI Agents

### Working In This Directory

- Run everything through the project venv: `.venv/bin/python3 scripts/etl/<script>.py`. Create it first if missing (`python3 -m venv .venv && .venv/bin/pip install -r scripts/etl/requirements.txt`), per the root `CLAUDE.md`.
- Most stage scripts (`01`, `02*`, `03`, `04`) take `--board`, `--limit`, `--force`, `--print-every`; check each file's own `--help` before assuming a flag exists (e.g. `02c`/`02e`/`02g`/`02h`/`05` take only `--dry-run` and sometimes `--board`).
- Follow the re-run traps in `.claude/rules/etl.md` before re-running a stage over existing gold output — several stages are not safe to blindly re-run (`02-parse-zeroboard.py` undoes later image/emoticon rewrites; `extract-image-urls.py` drifts the manifest if re-run for a subset).
- Respect the single-worker Wayback politeness policy (`wayback_client.global_polite_slot`) — never run two downloader/probe scripts expecting higher concurrency.
- `.image-*-summary.json`, `.parse-*.json`, `.parse-failures*.jsonl`, `.quarantine-*.tsv`, and `.omc/`, `__pycache__/` in this directory are gitignored scratch/state — don't try to commit them.

### Testing Requirements

There is no automated test suite for this directory (pytest is pinned in `requirements.txt` but no test files exist here). Verification is manual:

- Use `--dry-run` where the script supports it (see the add_argument list per file; `01-decode.py`, `02-parse-zeroboard.py`, `02b`, `02c`, `02d`, `02e`, `02f`, `02g`, `02h`, `03-build-index.py`, `04-rewrite-image-urls.py`, `05-repair-zeroboard-meta.py`, `cdx-image.py`, `cdx-image-fallback.py`, `download-images.py`, `migrate-emoticon-store.py`, `recover-chrome.py` all have it) before a destructive run.
- Use `--limit N` / `--board ID` to smoke-test a parser change against a small slice before a full run.
- Validate gold output against `schemas.py` — a parser script raising `pydantic.ValidationError` is the schema check; there is no separate linter for the JSON shape.

### Common Patterns

- Stage numbering encodes pipeline order: `01` decode, `02*` parse (one file per skin/engine), `03` index, `04`/`05` post-process gold. Image recovery is its own lettered phase sequence (B/C/D/E/F/G) layered on top, cross-referenced in `.claude/rules/etl.md`.
- Scripts that share helpers import them with `sys.path.insert(0, str(Path(__file__).resolve().parent))` followed by a local import (`sanitise.py`, `schemas.py`, `wayback_client.py`) rather than a package — this directory is not an installed package.
- Scripts that reuse another stage (`02f`, `02g`, `02h`, `05-repair-zeroboard-meta.py`, `site-image-queue.py`) load another script as a module via `importlib.util.spec_from_file_location` instead of importing it normally, because the loaded file's name starts with a digit.

## Dependencies

### Internal

- `src/content/posts/`, `src/content/boards/`, `src/content/listings/`, `src/content/pages/` — this pipeline's gold-tier output, read directly by the Next.js app.
- `src/types/post.ts` — must stay in sync with `schemas.py`.
- `public/img/posts/`, `public/img/chrome/`, `public/img/emoticon/` — image recovery output.
- `.docs/research/` (gitignored) — bronze/silver tiers, CDX inventories, downloader run state.

### External

- Python: `beautifulsoup4`, `lxml`, `html5lib` (decode fallback), `nh3` (HTML sanitising), `pydantic` (schema validation), `pytest` (pinned, unused by any test file here).
- Wayback Machine CDX and raw-capture (`id_`) endpoints — all network access goes through `wayback_client.py`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
