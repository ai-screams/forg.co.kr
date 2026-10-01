<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-10-01 | Updated: 2026-10-01 -->

# src/types

## Purpose

Shared TypeScript types for the gold-tier content schema, plus ambient
declarations for modules TypeScript cannot otherwise resolve.

## Key Files

| File            | Description                                                                                                                                                                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `post.ts`       | `Post`, `Attachment`, `Comment`, `BoardIndexEntry`, `BoardIndexPage`, `BoardListingEntry`, `BoardListing`, `PostEra`, `SourceEngine`, and the `BOARD_INDEX_PAGE_SIZE` constant (50). Mirrors the Pydantic models in `scripts/etl/schemas.py` field-for-field — the parser validates against Pydantic, the React side reads with these interfaces. |
| `pagefind.d.ts` | Ambient module declaration for `/pagefind/pagefind.js`, a postbuild artifact (`pagefind --site out --force-language ko`) that does not exist at typecheck time. Types `search`, `init`, `filters`.                                                                                                                                                |
| `reset.d.ts`    | Imports `@total-typescript/ts-reset` to tighten stdlib types project-wide: `JSON.parse()` returns `unknown`, `Array.prototype.filter(Boolean)` narrows out `null`/`undefined`, `fetch().json()` returns `unknown`.                                                                                                                                |

## For AI Agents

### Working In This Directory

- `post.ts` and `scripts/etl/schemas.py` must change together. If you
  add, rename, or retype a field in `Post` (or the index/listing types),
  make the matching edit in `schemas.py` in the same change — the ETL
  writes the JSON these types describe, so a mismatch is only caught at
  `pnpm build` time via `src/lib/posts.ts`'s shallow runtime check, not
  by `tsc`.
- `pagefind.d.ts` only needs updating if the Pagefind JS API surface
  used by search components changes (e.g. a new search option).
- `reset.d.ts` is imported once for its side effect; it has no exports
  to extend. Don't add unrelated ambient declarations to it — give a new
  ambient module its own file.

### Testing Requirements

There is no unit-test suite in this repo (no `test` script in
`package.json`). Verify changes here with:

```bash
pnpm typecheck   # tsc --noEmit — the primary check for this directory
pnpm lint        # eslint
pnpm build       # next build — catches Post shape drift against gold JSON
```

### Common Patterns

- Fields that are informational rather than render-critical are marked
  optional (`createdAtApprox?`, `hits: number | null`) rather than
  widening the whole interface — see `Post`'s doc comments for which
  fields are "absent on files written before 2026-09-20; treat absent as
  false" style migrations.
- `BoardIndexEntry` deliberately excludes `bodyHtml`/`bodyText` so board
  listing pages don't ship full post bodies to the client.

## Dependencies

### Internal

- Consumed by `src/lib/posts.ts`, `src/lib/boards.ts` (via `PostEra`,
  `SourceEngine`), and route components under `src/app/`.
- Mirrored by `scripts/etl/schemas.py` (Pydantic), which produces the
  JSON under `src/content/posts/**`, `src/content/boards/**`, and
  `src/content/listings/**`.

### External

- `@total-typescript/ts-reset` — stdlib type tightening (`reset.d.ts`).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
