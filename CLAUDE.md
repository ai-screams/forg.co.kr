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

- `.docs/ADR/` — accepted Architecture Decision Records numbered ADR-0001 through ADR-NNNN. The index at `.docs/ADR/README.md` lists all decisions in scope. Read the ADR before changing tokens, era system, ETL, or stack choices.
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

- **bronze** `archive/A/{board}/{post_id}.html` — raw Wayback captures, EUC-KR-encoded, treated as immutable. The downloader (`scripts/etl/download.py`) reads `cdx/e-policy-plan.json` and writes here.
- **silver** `archive-clean/A/{board}/{post_id}.html` — UTF-8 + Wayback chrome stripped, produced by `scripts/etl/01-decode.py` using BeautifulSoup4 + lxml (html5lib fallback). Atomic writes (`.tmp` then `rename`); idempotent so re-running only processes new files.
- **gold** `src/content/posts/{board}/{post_id}.json` — parsed, schema-conformant JSON (P1.0+, not yet implemented). This is the only tier that ships in git and is consumed by Next.js.

Wayback was downloaded with the `id_` modifier so the captures arrive without Wayback's chrome to begin with — `01-decode.py`'s chrome counters are normally 0. They become non-zero only if someone re-downloads with `if_`/`fw_`. Don't remove the cleanup logic on that basis.

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
- Final `src/content/posts/*.json` files. They are the gold tier and will be generated by P1.0's parser. The directory will appear when that work lands.
- Site chrome assets (forg's original GIFs/icons). Will be downloaded into `public/img/chrome/` in P3.x.
