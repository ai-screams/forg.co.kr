# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project identity

This repository is a **digital museum for forg.co.kr** (1999–2015), the largest Korean Ultima Online community fan site. It is a non-commercial preservation project — read-only archive of Wayback-captured posts, plus a modern Next.js shell that switches between two visual eras (2014 default, 2003 toggle).

The README describes the goal in detail. The two non-obvious facts that affect every change:

- The site is fundamentally **read-only**. There is no auth, no posting, no DB. Comments will be added later via Giscus (GitHub Discussions backend), not a self-hosted system.
- forg's **signature gold `#FFC73B` is invariant across both eras**. Era toggling only swaps the chrome (page bg, sidebar, links). Do not introduce era-aware utilities for token values that should be era-invariant.

## Where decisions live (gitignored, internal)

The `.docs/` directory holds the internal context. It is **gitignored on purpose** — never stage it. Future agents must read it to understand intent:

- `.docs/ADR/` — accepted Architecture Decision Records numbered ADR-0001 through ADR-NNNN. The index at `.docs/ADR/README.md` lists all decisions in scope. Read the ADR before changing tokens, era system, ETL, or stack choices. Current: **14 ADRs** (ADR-0001 through ADR-0014; ADR-0009 superseded). Key decisions:
  - ADR-0011: Image storage — git-direct commit (56 MB / 2,715 files across 9 boards)
  - ADR-0012: single-URL CDX fallback layer for body images (Phase G, ~15% → 30~50% recovery target)
  - ADR-0013: All registered boards enumerated (42 boards total; unparsed boards use placeholder component)
  - ADR-0014: Licensing — dual MIT (code) + original-authors-retain (content) with takedown SLA
- `.docs/considerations/` — forward-looking notes (`CONS-NNNN`) for decisions deliberately deferred. Lighter than ADRs; each one names its re-evaluation trigger (e.g. CONS-0001 captures the future interactive-board / DB scenario). Resolution path is to be promoted to an ADR or rejected.
- `.docs/plan/ROADMAP.md` — phased checklist (P0–P5). Tasks reference ADR numbers. Update checkboxes as work completes.
- `.docs/research/` — Wayback CDX results, raw HTML captures, the original `FORG-RECONSTRUCTION-GUIDE.md` describing the historical site's structure (boards, colors, layout). The reconstruction-guide explains things like the original board IDs (UoBoard, Q_A, Role, …) and the Zeroboard 4.1pl4 / Gnuboard4 / Gnuboard5 engine progression — invaluable context for the parser work.

When making non-trivial changes, append a new ADR-NNNN rather than editing accepted ones (Status: `Superseded by ADR-…` is the protocol).

## Architecture quick map

### The era toggle (ADR-0001, ADR-0005, ADR-0006)

Two visual eras share the same content:

- `<html data-era="2014" | "2003">` — single source of truth, set by SSR (`src/app/layout.tsx`) and patched pre-hydration by an inline FOUC-prevention script that reads `localStorage["forg.era"]`.
- Era-invariant tokens live in `@theme` inside `src/app/globals.css` (color-forg-gold, font-forg, spacing-forg-\*). Era-specific tokens live in `:root[data-era="…"]` blocks (`--era-page-bg`, `--era-content-bg`, etc.). Components reference `bg-forg-gold` (Tailwind utility) or `bg-(--era-page-bg)` (Tailwind v4 arbitrary CSS-var syntax) — never both styles for the same concept.
- `<EraToggle>` (`src/components/era-toggle.tsx`) uses **`useSyncExternalStore`**, not `useEffect + setState`. The React 19 / React Compiler lint flags effect-driven state updates as cascading-render anti-patterns. Mirror this pattern in any other DOM-as-state subscription.
- All colors are **OKLCH** with the original sRGB hex preserved in adjacent comments. `oklch.com` is the conversion source of truth.

### ETL pipeline (ADR-0004, ADR-0007)

Three tiers of data, all under `.docs/research/`:

- **bronze** `archive/A/{board}/{post_id}.html` — raw Wayback captures, EUC-KR-encoded, treated as immutable. The downloader (`scripts/etl/download.py`) reads `cdx/e-policy-plan.json` and writes here. Phase A finished at 11,034/11,035; the missing one (`ScreenShot/10481`) is a fixed URL-encoding bug (`_ascii_safe_url` patch) that recovers on the next downloader run.
- **silver** `archive-clean/A/{board}/{post_id}.html` — UTF-8 + Wayback chrome stripped, produced by `scripts/etl/01-decode.py` using BeautifulSoup4 + lxml (html5lib fallback). Atomic writes (`.tmp` then `rename`); idempotent so re-running only processes new files.
- **gold** `src/content/posts/{board}/{post_id}.json` — parsed, schema-conformant JSON. Produced by `scripts/etl/02-parse-zeroboard.py` (Pydantic-validated). **13,290 posts across 37 boards** ship in git: UoBoard 4393 / Q_A 2735 / Role 1197 / Notice 862 / ScreenShot 656 / Events 477 / Items 229 / column 167 / UOForum 18 / Newbie 345 / newbieqna 39 / WOWNotice 7 / WowForum 2 / WOWEvents 1 / WOWScreen 1 / WowRole 1 (Phase B/C, P3.3). UoBoard2 (Gnuboard4 23건) excluded via `EXCLUDE_BOARDS` and deferred to P2.2's separate parser. `Post.capturedAt` is the real Wayback timestamp (sourced from `e-policy-plan.json` → `.progress.jsonl`, fail-loud if missing); `Post.parsedAt` is the ISO 8601 parse-time stamp.
- **gold (index)** `src/content/boards/{board}/index-{N}.json` — paginated board index, 50 entries per page, `createdAt` desc. Produced by `scripts/etl/03-build-index.py`. **289 chunks** ship today; auto-rebuilds when posts grow.
- **recovered images** `public/img/posts/{board}/{post_id}/{filename}` — Wayback-fetched binaries plus per-post `.manifest.json` sidecars (`{filename, originalUrl, capturedAt, sizeBytes, sha256}`). Produced by ADR-0010 Phase D (`scripts/etl/download-images.py`). **2,715 files / 56 MB across 9 boards.** Gold-tier `<img src>` is rewritten to `/img/posts/...` (recoverable) or `/img/placeholder/missing.svg` (unrecoverable) by Phase F (`scripts/etl/04-rewrite-image-urls.py`); both states preserve the original Wayback URL on `data-original-src`. ADR-0011 records the git-direct storage decision (re-evaluate at 150 / 200 MB / 1 GB thresholds).

Wayback was downloaded with the `id_` modifier so the captures arrive without Wayback's chrome to begin with — `01-decode.py`'s chrome counters are normally 0. They become non-zero only if someone re-downloads with `if_`/`fw_`. Don't remove the cleanup logic on that basis.

#### Image recovery layer (ADR-0010 P3.0~3.2 + ADR-0012 Phase G)

Gold-tier posts contain embedded images that must be recovered from Wayback. The recovery pipeline spans two strategies:

**Phase A–F (ADR-0010, completed):** Prefix-based CDX discovery + manifest-first inventory

- **A1** `wayback_client.py` — shared polite rate limiter (fcntl.flock, strict 1-worker cross-process, 4s delay, exponential backoff)
- **A2** `Post.capturedAt` — corrected to real Wayback timestamp (sourced from `e-policy-plan.json` + `.progress.jsonl`); new field `Post.parsedAt` tracks parse time
- **B** `extract-image-urls.py` — gold tier posts → `image-manifest.jsonl` with `urljoin`-based URL normalization + candidate variants (port, percent-encoding, host)
- **C** `cdx-image.py` — 12-prefix CDX sharding (`_zb/data/`, `_zb/emoticon/`, etc.) + canonical-key multimap join + valid image row filtering (status 200, image/\*, non-zero length)
- **D** `download-images.py` — resumable batch fetch to `public/img/posts/{board}/{post_id}/{filename}` + per-post `.manifest.json` sidecars
- **E** `measure-recovery.py` — metrics (recovery rate by board, host distribution, unrecoverable classification)
- **F** `04-rewrite-image-urls.py` — src rewrite (recovered → `/img/posts/...`, failed → `/img/placeholder/missing.svg`); `data-recovery` + `data-original-src` attributes preserved for accessibility + future retry

**Result (P2.4):** 2,715 files / 56 MB across 9 boards; **49.9% body image recovery** (1,077 references, 569 recovered). Chrome assets: **68/73 = 93%** via single-URL probe.

**Phase G (ADR-0012, reworked 2026-09-20):** Single-URL probes for URLs the sweeps missed

- `cdx-image-fallback.py` — probes each distinct `normalized_url` in `image-unrecoverable.jsonl` **once** and appends the rows to `.docs/research/cdx/image-probe.jsonl`; misses are cached in `.probe-misses.jsonl`. It writes CDX rows, not queue entries — `cdx-image.py --queue-only` joins them like any sweep (`--filter` narrows, e.g. `/_zb/emoticon/`).
- `run-phase-g-chain.sh [probe args]` — probe → join → Phase D → Phase F → measure
- First use (P1-1): the 20 `u_*`/`m_*` emoticons behind 878 comment refs have no 200 capture anywhere (404 in 2004, 302 in 2007, nothing on the hosting27 mirror)

**Storage decision (ADR-0011):** 56 MB < 200 MB threshold → git-direct commit (same model as gold JSON tier). Re-evaluate at 150 / 200 MB / 1 GB milestones.

### Routing structure (App Router, static export)

The site has three dynamic route shapes under the `(board)` route group (the
`(board)` segment is stripped from the URL):

- `/[board]/` — board listing page 1 (canonical). `(board)/[board]/page.tsx`.
- `/[board]/page/[N]/` — board listing pages 2..N. The literal `page` segment
  exists to keep `/[board]/[postId]` from colliding with paginated URLs.
- `/[board]/[postId]/` — single post (P1.4). `(board)/[board]/[postId]/page.tsx`.

All three set `export const dynamicParams = false` and enumerate via
`generateStaticParams`, so unknown boards / pages / post ids become **build
errors** rather than runtime 404s — appropriate for a frozen archive.

`<SiteHeader>` and `<SiteFooter>` live in the root layout (`src/app/layout.tsx`),
so every page inherits the chrome and routes only render the article container.

#### 2014 main page layout (P2.4 completed)

The home (`src/app/page.tsx`) is now the **final 2014 forg.co.kr visual identity** — a 5-column layout:

```text
<header> (53px, chrome assets)
  └─ logo + login/signup (inactive) + 7-button menu (free/photo/fun/movie/boo/tra/trash)

<body>
  ┌──────────────────────────────────────────────────┐
  │  width: 10/100/680/7/AdSense (pixel widths)      │
  │                                                   │
  │  [10px]  [100px sidebar]  [680px content]  [7px] │
  │            (game category        (8-box grid)    │
  │             6 buttons)                            │
  │                                                   │
  │            Box 1: 자유게시판 (UoBoard)           │
  │            Box 2: 펀게시판 (column)               │
  │            Box 3: Reveal                         │
  │            Box 4: 포라토 (외부 link)              │
  │            Box 5: Trash                          │
  │            Box 6: Ultima                         │
  │            Box 7: Events                         │
  │            Box 8: Items                          │
  │                                                   │
  │            [42 total registered boards]          │
  │            [unparsed boards → <BoardPlaceholder>]│
  │                                                   │
  └──────────────────────────────────────────────────┘

<footer>
  24px visitor counter (frozen at 5,291만 in 2014)
  chrome assets: 68/73 recovered (93% via single-URL CDX probe)
  5 missing (hover variants, CSS fallback)
```

All 42 registered boards are enumerated at build time via `generateStaticParams` in `(board)/[board]/page.tsx`. Unparsed boards (those with `parsed: false` in `src/lib/boards.ts`) render `<BoardPlaceholder>` instead of live data — maintains URL structure without ETL completion burden.

**Phase C (P3.3, completed):** Added 391 posts across 4 new gold-tier boards (Newbie 345 / newbieqna 39 / events_date 6 / WOWScreen 1) plus 5 placeholder boards for WoW family (WOWNotice / WowForum / WOWEvents / WowRole / others). New `buzzard` skin parser added to `02-parse-zeroboard.py` for `events_date` event-calendar support. Total gold tier: 37 boards / 13,290 posts.

### Background downloads

The downloader runs for ~24h and is sensitive to interruption. It tracks state under `.docs/research/archive/`:

- `.run.pid` — PID of the running process
- `.summary.json` — live progress snapshot
- `.progress.jsonl` / `.errors.jsonl` — append-only logs (resume key)

The script is resumable: re-running with the same args skips files that already landed on disk. Wayback IP-blocks aggressive clients — settings are 1 worker / 4s base delay / random jitter / exponential backoff / `BLOCK_THRESHOLD` consecutive refusals trigger a 1-hour sleep. Don't raise concurrency without explicit reason.

## Tech stack notes (versions matter)

- **Next.js 16.x** with App Router, Turbopack, **`output: "export"` static build**. `import.meta.dirname` is used for `turbopack.root` to silence multi-lockfile detection. `next lint` is removed in v16 — use `eslint` directly.
- **React 19.x** — `useSyncExternalStore` for external state, no forwardRef pattern, server components by default.
- **TypeScript 6.x** with strict + `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`. `@total-typescript/ts-reset` (`src/types/reset.d.ts`) tightens stdlib (`JSON.parse → unknown`, `Array.filter(Boolean)` narrows nullables, `fetch().json() → unknown`).
- **Tailwind v4** CSS-first config — there is no `tailwind.config.js`. Tokens go in `@theme` inside `globals.css`. PostCSS uses `@tailwindcss/postcss`. The class-sort plugin must come **after** `prettier-plugin-organize-imports` in `.prettierrc.mjs`.
- **ESLint 9.x** (held back from 10 because `eslint-config-next` 16.x's bundled plugins still cap at v9). When `eslint-config-next@17` ships, both can move together.
- **`@types/node` 25.x** — matches the `ts6.0` dist-tag, not Node 25's runtime. Don't downgrade for "Node 24 LTS alignment" reasons.
- **pnpm 10.33.x** pinned via `packageManager` in `package.json`. The pin is required for `pnpm/action-setup@v4` in CI.

## Quality tooling (10 tools, all run in CI)

Local commands (each maps to a CI step):

```bash
pnpm dev               # Next.js dev server (Turbopack)
pnpm build             # static export to out/
pnpm typecheck         # tsc --noEmit
pnpm lint              # eslint
pnpm lint:md           # markdownlint-cli2
pnpm format            # prettier --write .
pnpm format:check      # prettier --check .
pnpm secret            # secretlint scan
pnpm knip              # unused exports/files/deps
pnpm size              # size-limit (200KB JS / 50KB CSS budgets)
```

Husky v9 hooks (auto-installed by `pnpm install` via `prepare` script):

- **pre-commit** runs `lint-staged` — `eslint --fix` + `prettier --write` + `secretlint` on `.ts/.tsx/.js/...`, `markdownlint-cli2 --fix` on `.md`. Hook scripts source `~/.nvm/nvm.sh` so `pnpm` resolves under non-interactive `git`. If you add a new hook, copy the same nvm-loading prelude.
- **commit-msg** runs commitlint (Conventional Commits, header ≤100, body line ≤120). Use `feat`, `fix`, `chore`, `docs`, `ci`, `refactor`, `perf`, `test`, `build`, `revert`, `style`.
- **pre-push** runs `pnpm typecheck && pnpm lint`.

GitHub Actions CI (`.github/workflows/ci.yml`) runs the same set on push/PR. `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` opts the runner JS actions into Node 24 ahead of GitHub's 2026-06-02 default switch.

## Python ETL environment

ETL scripts run from a project-local venv (gitignored). Homebrew Python 3.14 enforces PEP 668, so a venv is required:

```bash
python3 -m venv .venv
.venv/bin/pip install -r scripts/etl/requirements.txt
.venv/bin/python3 scripts/etl/01-decode.py [--limit N] [--force] [--dry-run]
```

`requirements.txt` pins `beautifulsoup4>=4.13`, `lxml>=5.3`, `html5lib>=1.1`. Use **CP949 first, EUC-KR fallback with `errors="replace"`** for Korean decode — many Wayback captures labeled `euc-kr` actually contain CP949 (a superset). Decoding strict EUC-KR breaks 1–2% of files unnecessarily.

## .gitignore traps to remember

- The Python distribution patterns (`/lib/`, `/lib64/`, `/var/`, `/parts/`, `/sdist/`, `/wheels/`) are root-anchored on purpose. **Do not remove the leading slash** — `lib/` without anchor recursively swallowed `src/lib/era.ts` from one commit and broke CI typecheck. The fix lives in commit `155034f`.
- `.docs/`, `.docs/**`, `.venv/`, `archive/`, `archive-utf8/`, `.summary.json`, `.progress.jsonl`, `.errors.jsonl`, `.run.log`, `.run.pid`, `skills-lock.json`, `.agents/` are all intentionally ignored. Don't recommend committing them.
- `.vscode/extensions.json`, `.vscode/settings.json`, `.vscode/tasks.json`, `.vscode/launch.json`, `.editorconfig`, `.gitignore`, `.npmrc`, `.nvmrc` are whitelisted re-includes — keep them tracked.

## What is _not_ in the repo (intentionally)

- The 14k Wayback HTML captures (~140MB silver tier, more in raw). They live in `.docs/research/archive/` and `archive-clean/`. Reproducible from Wayback CDX.
- Site chrome assets — **68/73 now in the repo** at `public/img/chrome/` (P2.4, commit `3a18aca8`). Originally Wayback CDX returned **0 rows** for `forg.co.kr/images/` / `/skin/` / `_zb/images/` / `_zb/skin/` prefixes, but single-URL probes against known asset filenames recovered 93%. The 5 remaining (mostly hover variants) use CSS fallback; placeholder SVG (`public/img/placeholder/missing.svg`) bridges missing assets with graceful degradation.
