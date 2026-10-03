<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-01 | Updated: 2026-10-01 -->

# src/app

## Purpose

Next.js App Router tree for the static-export museum: the root shell, the home page, the `(board)` route group (board listings and posts), full-text search, and the `/site/` static-page archive.

## Key Files

| File                                                 | Description                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout.tsx`                                         | Root layout. Sets `<html data-era>` from `DEFAULT_ERA`, injects the pre-hydration FOUC-prevention script that reads `localStorage["forg.era"]`, wraps `children` with `<SiteHeader>` / `<SiteFooter>`.                                                                                             |
| `page.tsx`                                           | Home page. Loads the eight 2014 board boxes server-side and renders both era variants through `<EraShell content2014 content2003>`.                                                                                                                                                                |
| `globals.css`                                        | Tailwind v4 CSS-first config. `@theme` holds era-invariant tokens (`forg-gold`, fonts, layout spacing); `:root[data-era="…"]` blocks hold era-specific semantic tokens; also defines `.era-2014-only` / `.era-2003-only` visibility rules and the `img[data-recovery="failed"]` placeholder style. |
| `favicon.ico`                                        | Site favicon.                                                                                                                                                                                                                                                                                      |
| `search/page.tsx`                                    | Client component (`"use client"`). Loads the Pagefind runtime from `NEXT_PUBLIC_PAGEFIND_BASE` via an indirect dynamic `import()`, reads `?q=` through `useSyncExternalStore`, and renders results.                                                                                                |
| `site/page.tsx`                                      | Index of every `/site/` static page, grouped by section (`SECTION_NAMES`), rendered inside `<EraShell>`.                                                                                                                                                                                           |
| `site/[...path]/route.ts`                            | Route handler, not a page. Serves each recovered static page (`src/content/pages/{stem}.json`) as a standalone HTML document; `generateStaticParams` and `GET` only.                                                                                                                               |
| `site/_render/document.ts`, `site/_render/assets.ts` | Assemble a `/site/` document (`renderSitePage`): museum bar, capture picker, the page's own CSS, mobile reflow CSS, injected scripts, doctype per rendering mode, Pagefind markup. Private folder, not routed.                                                                                     |
| `(board)/layout.tsx`                                 | Wraps every board/post route in `<EraShell>` so they share the five-column frame with the home page.                                                                                                                                                                                               |

## Subdirectories

| Route                            | File                                         | Renders                                                                                                                                                           |
| -------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/{board}/`                      | `(board)/[board]/page.tsx`                   | Board listing page 1 (canonical). Picks `BoardListing` (has a post-backed index), `BoardListingOnly` (captured list pages only), or `BoardPlaceholder` (neither). |
| `/{board}/page/{N}/`             | `(board)/[board]/page/[pageNumber]/page.tsx` | Board listing pages 2+. The literal `page` segment keeps this route from colliding with `/{board}/{postId}`. Page 1 is never generated here.                      |
| `/{board}/{postId}/`             | `(board)/[board]/[postId]/page.tsx`          | A single post via `<PostView>`, with adjacent-post navigation.                                                                                                    |
| `/{board}/{postId}/` (unmatched) | `(board)/[board]/[postId]/not-found.tsx`     | The 404 card shown when `notFound()` fires inside the post route.                                                                                                 |
| `/search`                        | `search/page.tsx`                            | Full-text search UI.                                                                                                                                              |
| `/site/`                         | `site/page.tsx`                              | Index of static guide pages.                                                                                                                                      |
| `/site/{stem}/`                  | `site/[...path]/route.ts`                    | One recovered static document.                                                                                                                                    |

All three board-shaped routes set `dynamicParams = false` and enumerate every param via `generateStaticParams`, so an unregistered board, page number, or post id is a **build error**, not a runtime 404. See `.claude/rules/routing-and-pages.md` for the full routing/board/search contract and `.claude/rules/era-and-ui.md` for the era-toggle and mobile-layout rules — both are authoritative; this file only points at files.

## For AI Agents

### Working In This Directory

- `params` is a `Promise` on every dynamic route (Next.js 16 / React 19 RSC contract) — `await params` before destructuring, as every `page.tsx` here does.
- Don't add a 404 fallback to a board/page/post route. The `dynamicParams = false` + `generateStaticParams` pairing is deliberate: a missing id must fail the build.
- The `(board)` segment is a route group — it is stripped from the URL. Files under `(board)/` do not get a `/board/...` prefix.
- `site/[...path]/route.ts` is a route handler: static export renders its `GET` to `out/site/{stem}/index.html`. It carries no layout; the `Link` wrapper is a plain `<a>`, so it links there like any page.
- `search/page.tsx` loads `pagefind.js` with `import(/* webpackIgnore: true */ url)` so the bundler leaves it to run time — that file only exists after the `postbuild` step — and preloads it (`preloadModule`) from the static HTML. When it cannot load (as in `pnpm dev`) the page says the index could not be loaded; a search that fails says so instead of showing no results.
- `search/page.tsx` keeps the Pagefind runtime in state and the search effect depends on it: a `?q=` search arrives before the runtime has loaded and must run again once it is ready. With the runtime in a ref, `?q=` searches on the live site came back empty in every try (PR #25). Result labels come from the `boardKr` meta on post pages, not from `src/lib/boards.ts`, which stays out of the client bundle.
- `layout.tsx`'s inline script and `suppressHydrationWarning` only cover the `data-era` attribute on `<html>` — don't extend `suppressHydrationWarning` to other attributes or elements on the strength of this precedent.

### Testing Requirements

There is no unit-test suite (no `test` script in `package.json`). Verify changes here with:

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm build       # next build — this is what actually catches a bad generateStaticParams
```

`pnpm build` is the meaningful check for this directory specifically, since `dynamicParams = false` turns routing mistakes into build failures.

### Common Patterns

- `generateMetadata` reads the same data loaders as the page body (`getBoard`, `getBoardView`, `getBoardIndex`, `getPost`) and returns `{}` for an invalid board id rather than throwing.
- `notFound()` is called for an invalid `board` param or a missing post/index, never a manual redirect.
- Pagination hrefs: page 1 is always `/{board}`, page N≥2 is `/{board}/page/{N}` (`pageHref` in `board-listing.tsx` builds the prev/next links; `(board)/[board]/page/[pageNumber]/page.tsx`'s `generateStaticParams` enumerates `pageNumber` from 2).

## Dependencies

### Internal

- `@/components/*` — `EraShell`, `SiteHeader`, `SiteFooter`, `BoardListing`, `BoardListingOnly`, `BoardPlaceholder`, `PostView`, `Home2003Content`, `Link`.
- `@/lib/boards`, `@/lib/posts`, `@/lib/chrome`, `@/lib/site-pages`, `@/lib/img-base`, `@/lib/era` — data and config loaders consumed by pages and `generateStaticParams`.
- `@/types/post` — shared post/board-index types.

### External

- `next` (App Router, `generateStaticParams`, `notFound`, route handlers, `output: "export"`).
- `react` 19 (`useEffect`, `useState`, `useSyncExternalStore` in `search/page.tsx`).
- `pagefind` — runtime loaded client-side in `search/page.tsx`, built by the `postbuild` script, not a direct npm dependency import.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
