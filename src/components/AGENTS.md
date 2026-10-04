<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-01 | Updated: 2026-10-01 -->

# src/components

## Purpose

Shared React components for the museum's chrome, era shell, board listings, and post/comment rendering. All components here are era-invariant in their markup — the 2014/2003 visual difference comes from CSS (`--era-*` variables in `src/styles/eras.css`), not from component branching, with `era-chrome-2014.tsx` and `home-2003.tsx` as the two exceptions that _hold_ each era's own chrome pieces.

## Key Files

| File                     | Description                                                                                                                                                                                                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `author-name.tsx`        | `AuthorName`: a post's or comment's author as its board showed it (a random daemon name for guests on `daemonGuestNames` boards); `PostAuthor` and `CommentAuthor`, which pick the seed every copy of that author shares; `AuthorRef`, the plain shape a list row carries; `commentSeed`, also the comments' React key. |
| `board-listing-only.tsx` | Board known only from its captured list pages: header, `ListTable` (rows from `listingRows`, with the 조회 column) and the capture footer.                                                                                                                                                                              |
| `board-listing.tsx`      | Paginated board index for boards with a post-backed index: header, `ListTable` (rows from `indexRows`) and pagination.                                                                                                                                                                                                  |
| `board-header.tsx`       | `BoardHeader` (a list page's board name and description, then its notes) and `BoardNote` (one note line); `BoardListing` and `BoardListingOnly` share them.                                                                                                                                                             |
| `board-placeholder.tsx`  | The page of a documented board Wayback kept nothing readable of (no index, no captured list page).                                                                                                                                                                                                                      |
| `board-rows.tsx`         | Builds each `ListRow` once for every view of a list: `indexRows`, `listingRows`, and the title cell with its comment count, marks and 본문 없음 (greyed on boards that keep posts).                                                                                                                                     |
| `chrome-primitives.tsx`  | Pieces the 2014 and 2003 frames share: `LeftRail` / `RightRail`, `LoginBar` (the inert Login / Sign Up bar), `TBarRow`, `MenuRow`, `MobileMenu`, `InertJumpMenu` (the disabled friend-site selects).                                                                                                                    |
| `comment-list.tsx`       | Renders a post's comments in the skin of the capture they came from (`captureSkin`): `kritz` (Zeroboard), `webbus` (Gnuboard4), or `plain` (Gnuboard5/forg.kr).                                                                                                                                                         |
| `daemon-name.tsx`        | Client component: one random daemon name per seed, drawn in the browser.                                                                                                                                                                                                                                                |
| `era-chrome-2001.tsx`    | 2001-era chrome: `FrameTop2001` (forg_t, the banner and 14-button menu) that `era-shell.tsx` uses.                                                                                                                                                                                                                      |
| `era-chrome-2003.tsx`    | 2003-era chrome: `FrameTop2003`, `FrameLeft2003` (sidebar with its Friend Site menu) and `FrameBottom2003` (counter and search strip) that `era-shell.tsx` composes.                                                                                                                                                    |
| `era-chrome-2014.tsx`    | 2014-era chrome: `FrameTop2014` (logo, login bar, 7-button menu, mobile menu), `FrameLeft2014` (game-category sidebar) and `FrameBottom2014` (visitor counter), from the 2014-12-18 capture.                                                                                                                            |
| `era-shell.tsx`          | The five-column frame (`10 / 100 / 680 / 7 / *`) every route renders inside. Renders content once and swaps only the era chrome via `.era-2014-only` / `.era-2003-only` CSS classes.                                                                                                                                    |
| `era-toggle.tsx`         | Client component: the 2014 · 2003 · 2001 toggle button group. Reads/writes `<html data-era>` and `localStorage`.                                                                                                                                                                                                        |
| `home-2014.tsx`          | 2014-era home content (`Home2014Content`, the eight-box grid of latest posts from the 2014-12-18 capture). Box labels are the boards' `nameKr`.                                                                                                                                                                         |
| `home-2001.tsx`          | 2001-era home content (`Home2001Content`, forg_b, the August 2001 front page). Artwork from `public/img/chrome/2001/`.                                                                                                                                                                                                  |
| `home-2003.tsx`          | 2003-era home content (`Home2003Content`, frame-main-2003: the artwork between the m*\* and r*\* board boxes).                                                                                                                                                                                                          |
| `lazy-img.tsx`           | `LazyImg`, the one `<img>` components draw: always `loading="lazy"`, so a hidden era's art never loads.                                                                                                                                                                                                                 |
| `link.tsx`               | Default export. A plain `<a>` that adds the trailing slash to internal paths, as next/link did.                                                                                                                                                                                                                         |
| `list-row.ts`            | The `ListRow` model every view of a board list draws from, and the wording every era shares: `NO_BODY_TOOLTIP` for a title-only row, `DATE_APPROX` (mark and tooltip) for an inferred year (`≈`) or a first-comment date (`≤`).                                                                                         |
| `list-skin-2001.tsx`     | The 2001 era's board list (`ListTable2001`): the Zeroboard 4.0 N+gine skins and `n_board`, drawn beside `ListTable`'s table and shown only in 2001.                                                                                                                                                                     |
| `list-skin.tsx`          | The board-list table (`ListTable`): per-skin columns and header art, the phone list (`NarrowList`), and the 2001 table beside them.                                                                                                                                                                                     |
| `post-view-2001.tsx`     | The 2001 era's post head (`PostHead2001`) and comment rows (`CommentList2001`), beside `PostView`'s own; the body is shared.                                                                                                                                                                                            |
| `post-view.tsx`          | Renders a full post: header metadata, sanitised body, attachments, comments, and prev/next post navigation. Also carries the Pagefind `data-pagefind-*` markup.                                                                                                                                                         |
| `sanitized-html.tsx`     | `SanitizedHtml`: a post or comment body (nh3-sanitised HTML, image host applied, scrolling inside itself below 800px).                                                                                                                                                                                                  |
| `skin-img-2001.tsx`      | `SkinImg2001`: a recovered 2001 skin image at its own size, or nothing when Wayback never kept it (the 2001 list and post head).                                                                                                                                                                                        |
| `site-footer.tsx`        | Site-wide footer (era-invariant, shown in the root layout).                                                                                                                                                                                                                                                             |
| `site-header.tsx`        | Site-wide header: logo link, search link, embeds `<EraToggle>`.                                                                                                                                                                                                                                                         |

## Subdirectories

None.

## For AI Agents

### Working In This Directory

- Don't branch a component on era in JS. Use `bg-forg-gold` (era-invariant Tailwind utility) or `bg-(--era-page-bg)` (era-specific CSS var) — never both styles for the same concept. See `.claude/rules/era-and-ui.md`.
- `era-toggle.tsx` subscribes to DOM/`localStorage` state via `useSyncExternalStore`, not `useEffect` + `setState` — the React Compiler lint flags the latter as a cascading-render anti-pattern. Mirror this pattern for any other DOM-as-state subscription added here.
- `era-shell.tsx` renders page content once; only the home page passes separate `content2014`/`content2003` props because its exhibit genuinely differs per era. Don't duplicate a post or board body per era — it doubles the HTML of thousands of static pages for nothing.
- `link.tsx` renders a plain `<a>`, not next/link: the RSC payload `.txt` files are stripped at `postbuild` (Cloudflare Pages' 20,000-file cap), so client navigation could only 404 and fall back to a full load. Use the wrapper for in-app links; it reaches `/site/` pages (route-handler documents) like any other.
- Skins come from `lib/skins.ts`: a board list from its board (`boardSkin(meta)`), a post's comments from the capture they came from (`captureSkin(post)`). The two differ for 919 posts — Zeroboard-era captures on boards indexed as Gnuboard4 — and that is deliberate; don't "fix" one to the other. Never hardcode a skin per board or per component.
- `comment-list.tsx` and `post-view.tsx` render `bodyHtml` via `dangerouslySetInnerHTML`. That HTML is pre-sanitised by nh3 at ETL Stage 2 (ADR-0008) — don't re-sanitise on the client, and don't reuse this pattern for any HTML that hasn't gone through that ETL stage.
- `post-view.tsx` puts `data-pagefind-meta="boardKr:…"` on the article; the search page reads its result labels from it. Changing it means rebuilding and uploading the search index (`pnpm deploy:search`) before the code ships.
- Prev/next links in `post-view.tsx` go to `entry.board ?? board`: a continuing board (UoBoard2, Shop) lists rows carried in from older boards, and those posts live under their own board.
- Mobile layout (below 800px) is the museum's own interpretation, not a faithful reproduction — keep the forg palette but build phone-only markup behind `max-frame:` (desktop stays pixel-identical from 800px, `frame:`). See `.claude/rules/era-and-ui.md`, including its Prettier template-string class-name gotcha.

### Testing Requirements

Components have no unit tests (`pnpm test` covers `src/lib`). Verify changes here with:

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm build       # next build — renders every board/post statically
```

Visual regressions (era toggle, mobile reflow) are checked manually per `.claude/rules/era-and-ui.md` (`pnpm build` + a local static server + screenshot diff), not by an automated test.

### Common Patterns

- `chromeUrl(asset, era)` (from `@/lib/chrome`) returns a recovered chrome image's URL and stops the build when the file is not in `public/img/chrome/`, so draw the image without a stand-in. Use `optionalChrome` only for art Wayback never kept (the 2014 menu's hover images, the 2003 `bgm_en.gif`) and draw without it. The 2001 skin images (`skinAsset2001`, `SkinImg2001`) are a separate lookup where many files are missing by nature.
- Per-board data loading uses a local `loadBox`/`BoxConfig`/`BoxData` shape (see `home-2014.tsx`, `home-2003.tsx`, `home-2001.tsx`) — an async loader per box, run with `Promise.all`.
- A list row with no captured post body gets `<NoBodyMark />` ("본문 없음") instead of a plain link — don't silently drop the row or fake a link.

## Dependencies

### Internal

- `@/lib/boards` — board metadata, engine, `BoardId` type.
- `@/lib/chrome` — `chromeUrl` for recovered Wayback chrome assets.
- `@/lib/dates` — `formatShortDate`, `formatKoreanDateTime`, `formatWaybackTs`, `isUnknownDate`.
- `@/lib/era` — `DEFAULT_ERA`, `ERA_STORAGE_KEY`, `ERAS`, `ERA_LABELS`, `isEra`, `Era` type.
- `@/lib/img-base` — `withImgBase` / `withImgBaseEverywhere` for rewriting recovered image URLs.
- `@/lib/posts` — `getRecentPostEntries`, `AdjacentPosts` type.
- `@/lib/skins` — `boardSkin`, `captureSkin`, `isHot`.
- `@/types/post` — `Post`, `BoardListing`, `BoardIndexPage`, `BoardIndexEntry`, `SourceEngine`.

### External

- `react` 19 (`useSyncExternalStore`, `Fragment`, `ReactNode`).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
