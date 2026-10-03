<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-10-01 | Updated: 2026-10-01 -->

# src/lib

## Purpose

Build-time helpers that Server Components use to read and interpret the
gold-tier ETL output (`src/content/**`) and recovered assets
(`public/img/**`). Everything here runs during `next build` / `next dev`
(Node filesystem APIs), not in the browser, except `era.ts`'s storage
helpers which run on both server and client.

## Key Files

| File            | Description                                                                                                                                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `boards.ts`     | `BOARDS` catalog — Korean display name, `BoardCategory`, `SourceEngine`, era hint, and `continues` (older boards merged into a successor) for every board id. Single source of truth for Korean names; the Python parsers do not duplicate it. |
| `posts.ts`      | Loaders for `src/content/posts/**`, `src/content/boards/**`, and `src/content/listings/**`: `getPost`, `getAllPostParams`, `getBoardIndex`, `getBoardListing`, `getRecentPostEntries`, `getAdjacentPosts`.                                     |
| `site-pages.ts` | Loader for `src/content/pages/**` (forg's hand-written guide pages): `getSitePage`, `getAllSitePages`; older captures from `src/content/page-versions/**`: `getSitePageVersion`.                                                               |
| `skins-2001.ts` | The 2001 era's board skins: board → skin (`skin2001Of`), palettes, and recovered skin images under `public/img/chrome/2001/zb/` (`skinAsset2001`).                                                                                             |
| `chrome.ts`     | Resolves recovered site-chrome assets under `public/img/chrome/` (era-bounded first, flat pool fallback): `chromeUrl`, `chromeExists`, `chromeEraOf`, `listRecoveredChrome`.                                                                   |
| `img-base.ts`   | Rewrites `/img/posts/…` references in post/page HTML to `NEXT_PUBLIC_IMG_BASE` (R2 CDN) at render time: `withImgBase`, `withImgBaseEverywhere`.                                                                                                |
| `era.ts`        | The `Era` type (`"2014"                                                                                                                                                                                                                        | "2003"`), `DEFAULT_ERA`, `ERA_STORAGE_KEY`, `isEra`guard,`ERA_LABELS`. |
| `dates.ts`      | Date formatting for the UI: `isUnknownDate` (flags the 1970-epoch Zeroboard NULL-timestamp placeholder), `formatKoreanDateTime`, `formatShortDate`, `formatWaybackTs`.                                                                         |

## For AI Agents

### Working In This Directory

- `posts.ts` and `site-pages.ts` resolve paths with `process.cwd()` —
  they only work when the Next.js process runs from the repo root.
- `posts.ts` does a shallow runtime check (`assertIsPost`) on the eight
  top-level string fields the renderer depends on. It is not a schema
  validator — the ETL's Pydantic models in `scripts/etl/schemas.py` own
  that job. Do not add deep validation here; fix the ETL instead.
- `getPost`, `getBoardIndex` and `getBoardListing` are wrapped in React's
  `cache`, so `generateMetadata` and the page share one read.
  `getAdjacentPosts` builds each board's ordered rows once per process
  (`boardSequences`); without it a build opened index files 982,870 times
  instead of 2,542. Under `pnpm dev`, restart the server after rebuilding
  the index.
- Adding a board means adding an entry to `BOARDS` in `boards.ts` first;
  `isBoardId`/`getBoard` and every loader in `posts.ts` key off it.
- `chrome.ts` reads the filesystem once at module load (build time), so
  newly recovered chrome assets need a rebuild to show up, not a page
  reload.
- See `.claude/rules/etl.md` for what produces `src/content/**` and
  `public/img/**`, and `.claude/rules/routing-and-pages.md` for how the
  App Router pages consume these loaders.

### Testing Requirements

There is no unit-test suite in this repo (no `test` script in
`package.json`). Verify changes here with:

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm build       # next build — exercises every loader via generateStaticParams
```

`pnpm build` is the real check for this directory: `dynamicParams =
false` on every board/post/page route means a loader bug or a missing
file surfaces as a build error, not a runtime 404.

### Common Patterns

- Loaders return `null` for a missing file (`ENOENT`) and let every
  other error propagate, so the build fails loudly on corrupt content
  rather than silently rendering an empty page.
- Prefer adding a new exported function over widening an existing one's
  return type — callers (`(board)/[board]/page.tsx`,
  `(board)/[board]/[postId]/page.tsx`, `src/app/page.tsx`) narrow on the
  specific shape they need.

## Dependencies

### Internal

- `src/types/post.ts` — `Post`, `BoardIndexEntry`, `BoardIndexPage`,
  `BoardListing`, `PostEra`, `SourceEngine` types consumed by `posts.ts`.
- `src/content/**` — the data `posts.ts` and `site-pages.ts` read.
- `public/img/chrome/**`, `public/img/posts/**` — assets `chrome.ts` and
  `img-base.ts` resolve.

### External

- `node:fs`, `node:fs/promises`, `node:path` — all file I/O is Node's
  built-in filesystem API, no third-party loader library.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
