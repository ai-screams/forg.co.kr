<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-01 | Updated: 2026-10-01 -->

# src/components

## Purpose

Shared React components for the museum's chrome, era shell, board listings, and post/comment rendering. All components here are era-invariant in their markup — the 2014/2003 visual difference comes from CSS (`--era-*` variables in `src/app/globals.css`), not from component branching, with `era-chrome-2014.tsx` and `home-2003.tsx` as the two exceptions that _hold_ each era's own chrome pieces.

## Key Files

| File                     | Description                                                                                                                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `board-listing.tsx`      | Paginated board index table for boards with a post-backed index (`BoardIndexPage`). Renders the title/date table and prev/next pagination links.                                                                                 |
| `board-listing-only.tsx` | Board listing for boards whose post pages were never captured — rows come from captured list pages only (`BoardListing` type), with a 조회(hits) column and a "본문 없음" mark on linkless rows.                                 |
| `board-placeholder.tsx`  | Placeholder card shown for a documented board whose parser hasn't run yet (Gnuboard4 pending P2.2, Phase B downloads pending P3.3).                                                                                              |
| `comment-list.tsx`       | Renders a post's comments in the skin of its source board: `kritz` (Zeroboard), `webbus` (Gnuboard4), or `plain` (Gnuboard5/forg.kr).                                                                                            |
| `era-chrome-2014.tsx`    | 2014-era chrome: left/right rails, AdSense slate column, game-category sidebar, `SiteHeader2014` (logo + login bar + 7-button menu), mobile menu, `VisitorCounter` footer strip.                                                 |
| `era-shell.tsx`          | The five-column frame (`10 / 100 / 680 / 7 / *`) every route renders inside. Renders content once and swaps only the era chrome via `.era-2014-only` / `.era-2003-only` CSS classes.                                             |
| `era-toggle.tsx`         | Client component: the 2014 · 2003 · 2001 toggle button group. Reads/writes `<html data-era>` and `localStorage`.                                                                                                                 |
| `home-2001.tsx`          | 2001-era home content (`Home2001Content`, the August 2001 front page) plus the exported `FrameTop2001` (banner and 14-button menu) that `era-shell.tsx` uses. Artwork from `public/img/chrome/2001/`.                            |
| `home-2003.tsx`          | 2003-era home content (`Home2003Content`) plus the exported `FrameTop2003` / `FrameLeft2003` / `FrameBottom2003` chrome pieces that `era-shell.tsx` composes for the 2003 era.                                                   |
| `link.tsx`               | Default export. Wraps `next/link` with `prefetch={false}` by default.                                                                                                                                                            |
| `list-skin.tsx`          | Shared board-list table primitives (`ListTable`, `CommentCount`, `RowMarks`, `NoBodyMark`, `listSkinOf`) used by both `board-listing.tsx` and `board-listing-only.tsx`; `ListTable` renders the private `NarrowList` below `sm`. |
| `post-view.tsx`          | Renders a full post: header metadata, sanitised body, attachments, comments, and prev/next post navigation. Also carries the Pagefind `data-pagefind-*` markup.                                                                  |
| `site-footer.tsx`        | Site-wide footer (era-invariant, shown in the root layout).                                                                                                                                                                      |
| `site-header.tsx`        | Site-wide header: logo link, search link, embeds `<EraToggle>`.                                                                                                                                                                  |

## Subdirectories

None.

## For AI Agents

### Working In This Directory

- Don't branch a component on era in JS. Use `bg-forg-gold` (era-invariant Tailwind utility) or `bg-(--era-page-bg)` (era-specific CSS var) — never both styles for the same concept. See `.claude/rules/era-and-ui.md`.
- `era-toggle.tsx` subscribes to DOM/`localStorage` state via `useSyncExternalStore`, not `useEffect` + `setState` — the React Compiler lint flags the latter as a cascading-render anti-pattern. Mirror this pattern for any other DOM-as-state subscription added here.
- `era-shell.tsx` renders page content once; only the home page passes separate `content2014`/`content2003` props because its exhibit genuinely differs per era. Don't duplicate a post or board body per era — it doubles the HTML of thousands of static pages for nothing.
- `link.tsx`'s `prefetch={false}` default exists because the RSC prefetch payload `.txt` files are stripped at `postbuild` (Cloudflare Pages' 20,000-file cap). Use this `Link` wrapper for in-app navigation; `/site/` pages must use a plain `<a>` instead since they're route-handler documents, not App Router pages.
- `list-skin.tsx` and `comment-list.tsx` pick their rendering skin from `listSkinOf(engine)` (`kritz` / `webbus` / `plain`) — derive the skin from the board's `engine` field in `src/lib/boards.ts`, never hardcode a skin per board or per component.
- `comment-list.tsx` and `post-view.tsx` render `bodyHtml` via `dangerouslySetInnerHTML`. That HTML is pre-sanitised by nh3 at ETL Stage 2 (ADR-0008) — don't re-sanitise on the client, and don't reuse this pattern for any HTML that hasn't gone through that ETL stage.
- `post-view.tsx` puts `data-pagefind-meta="boardKr:…"` on the article; the search page reads its result labels from it. Changing it means rebuilding and uploading the search index (`pnpm deploy:search`) before the code ships.
- Prev/next links in `post-view.tsx` go to `entry.board ?? board`: a continuing board (UoBoard2, Shop) lists rows carried in from older boards, and those posts live under their own board.
- Mobile layout (below 800px) is the museum's own interpretation, not a faithful reproduction — keep the forg palette but build phone-only markup behind `max-[799px]:` (desktop stays pixel-identical above 800px). See `.claude/rules/era-and-ui.md`, including its Prettier template-string class-name gotcha.

### Testing Requirements

There is no unit-test suite (no `test` script in `package.json`). Verify changes here with:

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm build       # next build — renders every board/post statically
```

Visual regressions (era toggle, mobile reflow) are checked manually per `.claude/rules/era-and-ui.md` (`pnpm build` + a local static server + screenshot diff), not by an automated test.

### Common Patterns

- `chromeUrl(asset, era)` (from `@/lib/chrome`) looks up a recovered Wayback chrome image; every call site has a typography or CSS fallback for when the asset wasn't recovered — follow that pattern rather than assuming an asset exists.
- Per-board data loading uses a local `loadBox`/`BoxConfig`/`BoxData` shape (see `home-2003.tsx`; the home page's equivalent lives in `src/app/page.tsx`) — an async loader per box, run with `Promise.all`.
- A list row with no captured post body gets `<NoBodyMark />` ("본문 없음") instead of a plain link — don't silently drop the row or fake a link.

## Dependencies

### Internal

- `@/lib/boards` — board metadata, engine, `BoardId` type.
- `@/lib/chrome` — `chromeUrl` for recovered Wayback chrome assets.
- `@/lib/dates` — `formatShortDate`, `formatKoreanDateTime`, `formatWaybackTs`, `isUnknownDate`.
- `@/lib/era` — `DEFAULT_ERA`, `ERA_STORAGE_KEY`, `ERAS`, `ERA_LABELS`, `isEra`, `Era` type.
- `@/lib/img-base` — `withImgBase` / `withImgBaseEverywhere` for rewriting recovered image URLs.
- `@/lib/posts` — `getRecentPostEntries`, `AdjacentPosts` type.
- `@/types/post` — `Post`, `BoardListing`, `BoardIndexPage`, `BoardIndexEntry`, `SourceEngine`.

### External

- `react` 19 (`useSyncExternalStore`, `Fragment`, `ReactNode`).
- `next/link` — wrapped by `link.tsx`; other components should import the wrapper (`@/components/link`), not `next/link` directly.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
