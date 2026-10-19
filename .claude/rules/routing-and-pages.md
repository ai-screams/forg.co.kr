---
paths:
  - "src/app/**"
  - "src/components/**"
  - "src/lib/**"
  - "next.config.ts"
---

# Routing, board pages, `/site/` and search

## Routes (App Router, `output: "export"`)

- `/[board]/`, `/[board]/page/[N]/`, `/[board]/[postId]/` under the `(board)` group. The literal `page` segment keeps pagination from colliding with post ids.
- The root layout's `@crumb` slot (`src/app/@crumb/`) mirrors the two list routes and puts the board's name and notes (`board-info.tsx`) in the museum bar; `default.tsx` leaves it empty everywhere else. The era frame holds only the list: the museum's words about a board go outside it. A new list route needs its slot page too.
- All set `dynamicParams = false` + `generateStaticParams`: an unknown board/page/post is a **build error**, not a runtime 404.
- `/policy/` (`src/app/policy/page.tsx`) is the copyright and takedown page; the footer links to it and it holds the request address. It promises no response times (user decision, 2026-10-06).
- `src/app/not-found.tsx` is the 404 (`out/404.html`, served by Pages for any path not written). Every page's RSC payload carries it, so keep it small and outside `<EraShell>`.
- `<SiteHeader>`/`<SiteFooter>` are in the root layout; `<EraShell>` (`src/components/era-shell.tsx`) is the five-column frame pages render inside.

## Boards

All 76 boards in `src/lib/boards.ts` are built. `(board)/[board]/page.tsx` picks: an index → `BoardListing` (a board known only from its list pages has one too, with the 조회 column, and the museum bar names its list captures: `getListOnlyRecord`, `BoardNotes`); none → `BoardPlaceholder` (a members-only board, `memberOnly`, says why nothing survives). Comments render per skin in `comment-list.tsx` (kritz / webbus / plain). The home route `src/app/page.tsx` hands `<EraShell>` each era's front page: `home-2014.tsx` (eight board boxes), `home-2003.tsx` and `home-2001.tsx`; each era's frame is `era-chrome-2014.tsx` / `-2003.tsx` / `-2001.tsx`, assembled by `<EraShell>`.

## Static pages (`/site/`)

forg's hand-written guide pages (`/skill/`, `/map/`, `/dungeon/`, the root frames, …) are served back as whole documents.

- ETL: `cdx-site.py` (phase `S`) → `download.py --phase S` → `01-decode.py` → `02g-parse-site.py` → `src/content/pages/{stem}.json` (`stem` = path without `.htm`/`.html`; a view-selecting query joins the stem, `index--page-2`; a space becomes `_`, `dungeon/Fire_Dungeon`). Images (a space in a picture's path becomes `_` too, its download URL keeps it): `site-image-queue.py` → `download-images.py --queue scripts/etl/site-image-queue.json` → `site-image-borrow.py` (shared frame images and the Ultima history's pictures, kept only in byte-identical copies elsewhere) → re-run `02g`. A page drawn in black on black over pictures (`<body bgcolor="black" text="black">`, the 2007 monster book) gets 02g's `PARCHMENT` in each cell whose picture is still missing; its JSON then carries `museumFill` and the museum bar says the museum painted it.
- Sources: `forg.co.kr`, `forg.dotple.com`, `forg.uospace.net` share one path space; `cdx-site.MIRRORS` maps `hosting27.interpia98.net/~forg/` onto it.
- `src/app/site/[...path]/route.ts` is a **route handler**: static export writes `out/site/{stem}/index.html`. It holds `generateStaticParams` and `GET`; the document is assembled in `src/app/site/_render/document.ts` from `_render/assets.ts`, which reads the bar, reflow and feature CSS and scripts from `_render/assets/` (out of Prettier: they go into every document byte for byte; ESLint checks the scripts), and a change there must leave the 1,332 documents byte-identical unless it means to change them (compare sha256 of `out/site/**/index.html`). No layout applies; `@/components/link` is a plain `<a>`, so it links there like any page.
- A page shows its latest capture; its other `page` captures are `/site/{stem}/{ts}/` (`src/content/page-versions/`), picked from the museum bar, kept out of search and pointed at the latest by `rel=canonical`. Its older framesets (the front page before 2011) are served the same way under a museum-bar frame (`/site/{stem}/{ts}/bar/`, `renderSiteBar`), each frame on that frame page's capture current at the date (02g `CaptureClock`) or, for a board list or a page the museum lacks, Wayback's framed capture (`if_`).
- Each page keeps the rendering mode of its capture (`mode`, 02g RENDERING MODE): 571 of 774 had no doctype and are served without one (a 572nd is member-only), in quirks mode like the original. CSS the route injects must work in every mode; check what the page's own rules already give in quirks mode before overriding them.

## Search

Pagefind indexes `data-pagefind-body` only (the `/site/` route wraps each page in one, filter `board:site`). `next.config.ts` defaults `NEXT_PUBLIC_PAGEFIND_BASE` to `https://search.forg.co.kr/{pagefind version}/` when `CF_PAGES` is set, and `pnpm deploy:search` uploads to the folder of the version that built the bundle, so upload a new version's bundle before merging the bump (Cloudflare edge-caches `pagefind.js` but not the wasm or the entry file; one folder per version keeps them matched). PR previews can't search (CORS). `pnpm deploy:search` uploads every file (`--dry-run` only counts them per Cache-Control) and needs the variables in `.env.r2.local` (`set -a; source .env.r2.local; set +a`).

Result labels come from the `boardKr` meta on post pages. When a change adds or renames meta the search page reads, upload the new index first, then merge the code: the live code ignores meta it does not know, but new code against the old index shows board ids.

## Search engines

- The public address is `https://forg.co.kr` (`SITE_URL`, `src/lib/seo.ts`); the root layout sets `metadataBase` and the defaults. Every route builds its metadata with `pageMeta({ title, description, path })`: its canonical path, and Open Graph/Twitter with the preview picture, which a page's own `openGraph` would otherwise drop (Next replaces it wholesale). Never set a canonical in a layout: every page without its own would inherit it.
- `sitemap.xml` comes from `src/app/sitemap.ts` (`sitemapPaths` in `src/lib/sitemap.ts`, about 16,200 addresses, no `lastmod`). A new route worth finding goes there.
- JSON-LD: `WebSite` on the home page, `DiscussionForumPosting` + `BreadcrumbList` on posts (`src/lib/structured-data.ts`, `<JsonLd>`); a post with no date gets the breadcrumb only. The postbuild keeps these inline scripts.
- Kept out of search engines: `/search/` (`search/layout.tsx`, noindex, follow), the 404 (Next adds noindex), a board Wayback kept nothing of (`pageMeta` `noindex`), a `/site/` page's older captures, its framesets, redirects and member-only notices (`document.ts`), and preview deployments (`*.*.pages.dev`, `public/_headers`). The production alias `forg-archive.pages.dev` is not marked: its canonicals name forg.co.kr, and a dashboard redirect sends it there. A `/site/` page's latest capture gets its canonical, a description led by its title (pages of a section open with the same menu) and the preview tags. JSON-LD dates carry `+09:00` (`kst`): forg's clock was Korean time.

## Old forg.co.kr addresses

forg.co.kr is the old site's own domain, so its old links still arrive (ADR-0022). The postbuild `scripts/postbuild/old-addresses.mjs` plans them from the content into three files in `out/`:

- `_routes.json`: the old site's folders that no museum path uses (`/_zb/`, `/skill/`, `/images/`, `/~forg/`, and a folder that holds only pages with a query such as `/drawing/`; 29 on 2026-10-07) run `functions/[[path]].ts`, the one Pages Function. It answers a picture from `_old-images.json` (2,970: post pictures on the image host, chrome and emoticons here — a chrome manifest entry without `originalUrl` is read from its `originalPath`), else the first of `oldCandidates` (`src/lib/old-urls.ts`) the museum serves as it is (asked with `redirect: "manual"`: Pages answers a missing `/x/index/` with a 308 to `/x/`, which a followed fetch would count as a page): the post `/X/N/` for `zboard.php`/`view.php?id=X&no=N` and `/bbs/board.php?bo_table=X&wr_id=N`, the guide page `/site/{stem}/` with its query, the post's board (302: the post may be collected later), the page without its query (302). With nothing, the request is served as a static file (the 404 page).
- `_redirects`: static 301s for what lies outside those folders — the folders a board shares (`/Diablo/`, `/screen/`) and the root — guide pages and pictures alike (274 lines).
- Pages applies no `_redirects` line to a path the Function serves; the plan never writes one there. A new museum top-level path takes its folder from the Function at the next build (the plan reads `out/`); a production build (`CF_PAGES_BRANCH=main`) without `NEXT_PUBLIC_IMG_BASE` stops there; `stemOf` must stay the ETL's `stem_of` (the test checks it against every page).
