<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-01 | Updated: 2026-10-01 -->

# src

## Purpose

The Next.js 16 App Router site and the JSON it renders. Everything here is built to static HTML by `pnpm build`.

## Subdirectories

| Directory     | Purpose                                                                          |
| ------------- | -------------------------------------------------------------------------------- |
| `app/`        | Routes, root layout, global CSS (see `app/AGENTS.md`)                            |
| `components/` | Era chrome, board listings, post and comment views (see `components/AGENTS.md`)  |
| `lib/`        | Content loaders, board catalog, image base, dates (see `lib/AGENTS.md`)          |
| `types/`      | Post and index types mirrored from the ETL schemas (see `types/AGENTS.md`)       |
| `content/`    | ETL output: posts, board indexes, listings, site pages (see `content/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- Read `node_modules/next/dist/docs/` before using a Next.js API (see the root `AGENTS.md`); era and mobile rules are in `.claude/rules/era-and-ui.md`.
- `src/content/` is generated — change the ETL, not the JSON.

### Testing Requirements

There is no unit-test suite. Run `pnpm typecheck`, `pnpm lint` and `pnpm build`; layout changes are checked by screenshots (see `.claude/rules/era-and-ui.md`).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
