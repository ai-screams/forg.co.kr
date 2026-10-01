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

- ETL: `cdx-site.py` (phase `S`) → `download.py --phase S` → `01-decode.py` → `02g-parse-site.py` → `src/content/pages/{stem}.json` (`stem` = path without `.htm`/`.html`; a view-selecting query joins the stem, `index--page-2`). Images: `site-image-queue.py` → `download-images.py --queue scripts/etl/site-image-queue.json`, then re-run `02g`.
- Sources: `forg.co.kr`, `forg.dotple.com`, `forg.uospace.net` share one path space; `cdx-site.MIRRORS` maps `hosting27.interpia98.net/~forg/` onto it.
- `src/app/site/[...path]/route.ts` is a **route handler**: static export writes `out/site/{stem}/index.html`. No layout applies, so link to it with `<a>`, not `<Link>`.

## Search

Pagefind indexes `data-pagefind-body` only (the `/site/` route wraps each page in one, filter `board:site`). `next.config.ts` defaults `NEXT_PUBLIC_PAGEFIND_BASE` to `https://search.forg.co.kr/` when `CF_PAGES` is set. PR previews can't search (CORS). `pnpm deploy:search` has **no dry-run**.
