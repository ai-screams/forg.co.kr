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
- All set `dynamicParams = false` + `generateStaticParams`: an unknown board/page/post is a **build error**, not a runtime 404.
- `<SiteHeader>`/`<SiteFooter>` are in the root layout; `<EraShell>` (`src/components/era-shell.tsx`) is the five-column frame pages render inside.

## Boards

All 67 boards in `src/lib/boards.ts` are built. `(board)/[board]/page.tsx` picks: an index → `BoardListing`; no index but a captured list page → `BoardListingOnly`; neither → `BoardPlaceholder`. Comments render per skin in `comment-list.tsx` (kritz / webbus / plain). The home is `src/app/page.tsx` (2014, eight board boxes) and `home-2003.tsx`.

## Static pages (`/site/`)

forg's hand-written guide pages (`/skill/`, `/map/`, `/dungeon/`, the root frames, …) are served back as whole documents.

- ETL: `cdx-site.py` (phase `S`) → `download.py --phase S` → `01-decode.py` → `02g-parse-site.py` → `src/content/pages/{stem}.json` (`stem` = path without `.htm`/`.html`; a view-selecting query joins the stem, `index--page-2`). Images: `site-image-queue.py` → `download-images.py --queue scripts/etl/site-image-queue.json` → `site-image-borrow.py` (shared frame images and the Ultima history's pictures, kept only in byte-identical copies elsewhere) → re-run `02g`.
- Sources: `forg.co.kr`, `forg.dotple.com`, `forg.uospace.net` share one path space; `cdx-site.MIRRORS` maps `hosting27.interpia98.net/~forg/` onto it.
- `src/app/site/[...path]/route.ts` is a **route handler**: static export writes `out/site/{stem}/index.html`. No layout applies; `@/components/link` is a plain `<a>`, so it links there like any page.
- A page shows its latest capture; its other `page` captures are `/site/{stem}/{ts}/` (`src/content/page-versions/`), picked from the museum bar, kept out of search and pointed at the latest by `rel=canonical`.
- Each page keeps the rendering mode of its capture (`mode`, 02g RENDERING MODE): 536 of 739 had no doctype and are served without one (a 537th is member-only), in quirks mode like the original. CSS the route injects must work in every mode; check what the page's own rules already give in quirks mode before overriding them.

## Search

Pagefind indexes `data-pagefind-body` only (the `/site/` route wraps each page in one, filter `board:site`). `next.config.ts` defaults `NEXT_PUBLIC_PAGEFIND_BASE` to `https://search.forg.co.kr/{pagefind version}/` when `CF_PAGES` is set, and `pnpm deploy:search` uploads to the folder of the version that built the bundle, so upload a new version's bundle before merging the bump (Cloudflare edge-caches `pagefind.js` but not the wasm or the entry file; one folder per version keeps them matched). PR previews can't search (CORS). `pnpm deploy:search` uploads every file (`--dry-run` only counts them per Cache-Control) and needs the variables in `.env.r2.local` (`set -a; source .env.r2.local; set +a`).

Result labels come from the `boardKr` meta on post pages. When a change adds or renames meta the search page reads, upload the new index first, then merge the code: the live code ignores meta it does not know, but new code against the old index shows board ids.
