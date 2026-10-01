<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-10-01 | Updated: 2026-10-01 -->

# src/content

## Purpose

Gold-tier data for the museum: parsed, schema-conformant JSON generated
by the Python ETL pipeline under `scripts/etl/`. This directory is
**generated output, not hand-authored content** — see "For AI Agents"
below before editing anything in it.

## Subdirectories

| Directory   | Layout                                                                                                                                                                    | Producer script                                                                                                                                                                                                   | Reader                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `posts/`    | `{board}/{post_id}.json`, one `Post` per file (e.g. `posts/UoBoard/26245.json`)                                                                                           | `02-parse-zeroboard.py` (Zeroboard 4.1), `02b-parse-gnuboard4.py`, `02d-parse-gnuboard5.py` (forg.kr), `02e-parse-link-diary.py`, `02f-parse-zeroboard40.py`, `02h-parse-reply-forms.py` — routed by board engine | `src/lib/posts.ts` (`getPost`, `getAllPostParams`)                               |
| `boards/`   | `{board}/index-{N}.json`, 50 entries per page, `createdAt` desc, 1-indexed                                                                                                | `03-build-index.py`                                                                                                                                                                                               | `src/lib/posts.ts` (`getBoardIndex`, `getRecentPostEntries`, `getAdjacentPosts`) |
| `listings/` | `{board}.json`, one `BoardListing` per board — rows merged from captured list pages, the only trace of posts (or whole boards) whose view page Wayback never captured     | `02c-parse-listing.py`                                                                                                                                                                                            | `src/lib/posts.ts` (`getBoardListing`)                                           |
| `pages/`    | `{stem}.json`, `stem` = original path without `.htm`/`.html` (e.g. `pages/map.json`, `pages/Diablo/uarmor.json`); a view-selecting query joins the stem (`index--page-2`) | `02g-parse-site.py`                                                                                                                                                                                               | `src/lib/site-pages.ts` (`getSitePage`, `getAllSiteStems`, `getAllSitePages`)    |

Counts as of 2026-10-01: 14,837 posts (`posts/`), 605 index chunks
(`boards/`), 56 listing files (`listings/`), 877 page files (`pages/`).

## For AI Agents

### Working In This Directory

- **This tree is generated.** Hand edits get silently overwritten the
  next time the producing ETL stage runs. If a value is wrong, fix it
  with a targeted repair script instead (the model is
  `scripts/etl/05-repair-zeroboard-meta.py`) — do not re-run the
  original parser stage over existing gold data (it undoes downstream
  work such as image URL rewrites); see `.claude/rules/etl.md` for the
  re-run traps.
- The JSON shape for `posts/` and `boards/` is `Post` /
  `BoardIndexEntry` / `BoardIndexPage` in `src/types/post.ts`, which
  mirror the Pydantic models in `scripts/etl/schemas.py` 1:1. Changing
  either side without the other breaks the build.
- Full pipeline tiers (bronze/silver raw captures), image recovery, and
  per-script responsibilities are documented in `.claude/rules/etl.md` —
  read it before touching anything that feeds this directory. Routing
  of `pages/` content into `/site/*` URLs is in
  `.claude/rules/routing-and-pages.md`.
- Do not add a new `AGENTS.md` inside `posts/`, `boards/`, `listings/`,
  or `pages/` subdirectories — those are per-board/per-page generated
  data folders, not code modules.

### Testing Requirements

There is no unit-test suite in this repo (no `test` script in
`package.json`). Content changes are verified by the build, since every
route under `src/app/(board)/` sets `dynamicParams = false`:

```bash
pnpm typecheck   # tsc --noEmit
pnpm build       # next build — a missing/malformed file is a build error, not a 404
```

### Common Patterns

- A board can have `posts/` entries without a `boards/` index yet, or a
  `listings/` file with no matching `posts/` (post page never captured —
  `BoardListingEntry.hasPost: false`). `src/lib/posts.ts` and the board
  page component (`(board)/[board]/page.tsx`) both handle the three
  states: indexed, listing-only, and placeholder.
- `BoardMeta.continues` in `src/lib/boards.ts` and `CONTINUES` in
  `03-build-index.py` carry an older, retired board's rows forward under
  its successor's index — check both when a board's history spans a
  rename.

## Dependencies

### Internal

- `src/types/post.ts` — TypeScript shape of everything in this tree.
- `src/lib/boards.ts` — `BOARDS` catalog gates which board ids are valid
  (`isBoardId`), used by loaders in `src/lib/posts.ts`.
- `src/lib/posts.ts`, `src/lib/site-pages.ts` — the only code that reads
  this tree at build time.

### External

- `scripts/etl/schemas.py` (Pydantic) — validates every file before it
  is written here.
- `public/img/posts/**` — image bytes referenced by `<img src>` in
  `posts/*.json` and `pages/*.json` bodies (git-ignored, served from R2
  per ADR-0018; see `.claude/rules/etl.md`).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
