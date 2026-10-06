<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-01 | Updated: 2026-10-01 -->

# src/app

## Purpose

Next.js App Router tree for the static-export museum: the root shell, the home page, the `(board)` route group (board listings and posts), full-text search, and the `/site/` static-page archive.

## Key Files

| File                                                                         | Description                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `layout.tsx`                                                                 | Root layout. Sets `<html data-era>` from `DEFAULT_ERA`, inlines the era script (`_scripts/era.js`: the saved era before paint, the era buttons from the first click, other tabs' changes), wraps `children` with `<SiteHeader>` / `<SiteFooter>`.                                                                                                                        |
| `page.tsx`                                                                   | Home page. Hands `<EraShell>` each era's front page (`Home2014Content`, `Home2003Content`, `Home2001Content`); CSS shows one.                                                                                                                                                                                                                                            |
| `not-found.tsx`                                                              | The 404 page (`out/404.html`, which Cloudflare Pages serves for any path not written): a small card in the root layout with a search box and two links. Every page's RSC payload carries it, so it stays small and outside `<EraShell>`.                                                                                                                                 |
| `globals.css`                                                                | Stylesheet entry: declares the cascade layers (`theme, base, components, utilities, museum`), imports Tailwind and `src/styles/` — `tokens.css` (`@theme`, era-invariant), `skins.css` (`@theme`, the original skins' colours in hex), `eras.css` (`:root[data-era]` variables, era visibility, 2001 post and centred frame), `base.css` (body, image recovery markers). |
| `favicon.ico`                                                                | Site favicon.                                                                                                                                                                                                                                                                                                                                                            |
| `search/page.tsx`                                                            | Client component (`"use client"`). Loads the Pagefind runtime from `NEXT_PUBLIC_PAGEFIND_BASE` via an indirect dynamic `import()`, reads `?q=` through `useSyncExternalStore`, and renders results.                                                                                                                                                                      |
| `sitemap.ts`                                                                 | `/sitemap.xml` at build from `src/lib/sitemap.ts`.                                                                                                                                                                                                                                                                                                                       |
| `search/layout.tsx`                                                          | The search page's metadata (the page is a client component): noindex, follow.                                                                                                                                                                                                                                                                                            |
| `policy/page.tsx`                                                            | The copyright and takedown page the footer links to: who owns what, the request address, what to include. Drawn like the search page outside `<EraShell>`; promises no response times (`policy.test.ts`).                                                                                                                                                                |
| `site/page.tsx`                                                              | Index of every `/site/` static page, grouped by section (`SECTION_NAMES`), rendered inside `<EraShell>`.                                                                                                                                                                                                                                                                 |
| `site/[...path]/route.ts`                                                    | Route handler, not a page. Serves each recovered static page (`src/content/pages/{stem}.json`) as a standalone HTML document; `generateStaticParams` and `GET` only.                                                                                                                                                                                                     |
| `site/_render/document.ts`, `site/_render/assets.ts`, `site/_render/assets/` | Assemble a `/site/` document (`renderSitePage`): museum bar, capture picker, the page's own CSS, mobile reflow CSS, injected scripts, doctype per rendering mode, Pagefind markup. The longer CSS and scripts are files in `assets/`, inserted byte for byte (kept out of Prettier; ESLint checks the scripts). Private folder, not routed.                              |
| `(board)/layout.tsx`                                                         | Wraps every board/post route in `<EraShell>` and the padded content cell, so they share the five-column frame with the home page.                                                                                                                                                                                                                                        |

## Subdirectories

| Route                | File                                         | Renders                                                                                                                                                            |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/{board}/`          | `(board)/[board]/page.tsx`                   | Board listing page 1 (canonical). Picks `BoardListing` (the board's index, of its posts and list rows or of its list rows alone) or `BoardPlaceholder` (no index). |
| `/{board}/page/{N}/` | `(board)/[board]/page/[pageNumber]/page.tsx` | Board listing pages 2+. The literal `page` segment keeps this route from colliding with `/{board}/{postId}`. Page 1 is never generated here.                       |
| `/{board}/{postId}/` | `(board)/[board]/[postId]/page.tsx`          | A single post via `<PostView>`, with adjacent-post navigation.                                                                                                     |
| `/search`            | `search/page.tsx`                            | Full-text search UI.                                                                                                                                               |
| `/policy/`           | `policy/page.tsx`                            | Copyright and takedown requests.                                                                                                                                   |
| `/site/`             | `site/page.tsx`                              | Index of static guide pages.                                                                                                                                       |
| `/site/{stem}/`      | `site/[...path]/route.ts`                    | One recovered static document.                                                                                                                                     |

All three board-shaped routes set `dynamicParams = false` and enumerate every param via `generateStaticParams`, so an unregistered board, page number, or post id is a **build error**, not a runtime 404. See `.claude/rules/routing-and-pages.md` for the full routing/board/search contract and `.claude/rules/era-and-ui.md` for the era-toggle and mobile-layout rules — both are authoritative; this file only points at files.

## For AI Agents

### Working In This Directory

- `params` is a `Promise` on every dynamic route (Next.js 16 / React 19 RSC contract) — `await params` before destructuring, as every `page.tsx` here does.
- Don't add a 404 fallback to a board/page/post route. The `dynamicParams = false` + `generateStaticParams` pairing is deliberate: a missing id must fail the build.
- The `(board)` segment is a route group — it is stripped from the URL. Files under `(board)/` do not get a `/board/...` prefix.
- `site/[...path]/route.ts` is a route handler: static export renders its `GET` to `out/site/{stem}/index.html`. It carries no layout; the `Link` wrapper is a plain `<a>`, so it links there like any page.
- `search/use-pagefind.ts` loads `pagefind.js` with `import(/* webpackIgnore: true */ url)` so the bundler leaves it to run time — that file only exists after the `postbuild` step — and preloads it (`preloadModule`) from the static HTML. When it cannot load (as in `pnpm dev`) the page says the index could not be loaded; a search that fails says so instead of showing no results. A load or a search that has not answered in 15 s counts as failed (a runtime whose wasm did not load never answers), and a late answer still replaces that.
- `search/use-pagefind.ts` keeps the Pagefind runtime in state and the search effect depends on it: a `?q=` search arrives before the runtime has loaded and must run again once it is ready. With the runtime in a ref, `?q=` searches on the live site came back empty in every try (PR #25). The effect returns `startSearch`'s cleanup, so a search the query has moved past reports nothing: a slower older query cannot replace a newer one's results. Result labels come from the `boardKr` meta on post pages, not from `src/lib/boards.ts`, which stays out of the client bundle.
- `suppressHydrationWarning` marks exactly the places a plain script rewrites before React can hydrate (on `/search/` and under `pnpm dev`): `<html data-era>` and the era buttons' `aria-pressed` (the layout's inline `_scripts/era.js`) and a guest's daemon name (`public/scripts/daemon-names.js`). Don't add it anywhere else on the strength of these.

### Testing Requirements

A few routes have unit tests beside them (`search/use-pagefind.test.ts`, `site/[...path]/route.test.ts`, `site/_render/document.test.ts`, `policy/policy.test.ts`, `_scripts/era.test.ts`); most do not. Verify changes here with:

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm build       # next build — this is what actually catches a bad generateStaticParams
```

`pnpm build` is the meaningful check for this directory specifically, since `dynamicParams = false` turns routing mistakes into build failures.

### Common Patterns

- `generateMetadata` reads the same data loaders as the page body (`getBoard`, `getBoardView`, `getBoardIndex`, `getPost`) and returns `{}` for an invalid board id rather than throwing.
- `notFound()` is called for an invalid `board` param or a missing post/index, never a manual redirect. With `dynamicParams = false` it cannot fire for a generated page, so the routes keep no `not-found.tsx` of their own: one under `[postId]` was serialized into every post page's RSC payload (about 1 KB each) and never shown. The root `not-found.tsx` is carried the same way by every page, which is why it stays small.
- Pagination hrefs: page 1 is always `/{board}`, page N≥2 is `/{board}/page/{N}` (`pageHref` in `board-listing.tsx` builds the prev/next links; `(board)/[board]/page/[pageNumber]/page.tsx`'s `generateStaticParams` enumerates `pageNumber` from 2).

## Dependencies

### Internal

- `@/components/*` — `EraShell`, `SiteHeader`, `SiteFooter`, `BoardListing`, `BoardPlaceholder`, `PostView`, `Home2014Content`, `Home2003Content`, `Home2001Content`, `Link`.
- `@/lib/boards`, `@/lib/posts`, `@/lib/chrome`, `@/lib/site-pages`, `@/lib/img-base`, `@/lib/era` — data and config loaders consumed by pages and `generateStaticParams`.
- `@/types/post` — shared post/board-index types.

### External

- `next` (App Router, `generateStaticParams`, `notFound`, route handlers, `output: "export"`).
- `react` 19 (`useEffect`, `useState`, `useSyncExternalStore` in `search/page.tsx`, the one client component; every other page ships without the React runtime, see `scripts/postbuild/strip-react-runtime.mjs`).
- `pagefind` — runtime loaded client-side in `search/page.tsx`, built by the `postbuild` script, not a direct npm dependency import.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
