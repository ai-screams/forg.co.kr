---
paths:
  - "src/**"
---

# Era system and layout (ADR-0001, ADR-0005, ADR-0006, ADR-0016, ADR-0019)

## Era toggle

- `<html data-era="2014" | "2003" | "2001">` is the single source of truth: set by SSR (`src/app/layout.tsx`), patched before the page paints by the inline era script (`src/app/_scripts/era.js`) reading `localStorage["forg.era"]`.
- Styles live in `src/styles/` (`tokens.css`, `eras.css`, `base.css`), imported by `src/app/globals.css`, which also declares the cascade layers; the museum's own rules go in `@layer museum`, after Tailwind's `utilities`.
- Era-invariant tokens are in `@theme` in `src/styles/tokens.css` (`forg-gold`, `font-forg`, …); era-specific ones in `:root[data-era="…"]` (`--era-page-bg`, …). Use `bg-forg-gold` or `bg-(--era-page-bg)` — never both styles for one concept.
- Visibility: `.era-2014-only` / `.era-2003-only` / `.era-2001-only`, plus `.era-not-2001` for the 2014/2003 side columns. 2001 centres a 790px column (`.forg-shell` / `.forg-shell-main` in `src/styles/eras.css`); 2014 and 2003 keep the 10/100/680/7/\* frame.
- Content pages ship no React runtime: `scripts/postbuild/strip-react-runtime.mjs` removes the RSC payload and the Next scripts from every page but `/search/`. So `<EraToggle>` and `<DaemonName>` are server markup and their behaviour is a plain script: `src/app/_scripts/era.js`, inlined at the top of every page by the layout, applies the saved era, handles the era buttons from the first click (switch, save, press) and follows another tab's `storage` event; `public/scripts/daemon-names.js` draws the guests' names. Add behaviour the same way: a client component outside `/search/` renders but never runs, and `src/client-components.test.ts` fails on one. The toggle's pressed colour comes from the `[data-era-option]` rules in `src/styles/eras.css`, so the saved era is lit before any script runs.
- Era `<img>`s (`ChromeImg`) are eager, hidden eras included: Safari draws a lazy picture only after its viewport check even when cached (WebKit PR 67352), so lazy chrome blinked on every reload, and a script switching them to eager after parsing did not help. Their URLs are content-versioned (`versioned` in `src/lib/chrome.ts`) and `/img/chrome/*` is immutable for a year, so each hidden era costs one download. React preloads eager pictures from the head.
- Colours are **OKLCH** with the original sRGB hex in an adjacent comment — except the original skins' colours in `src/styles/skins.css`, which stay hex: they are read off the captures like the pixel sizes, and OKLCH would round through `lab()`. Name a skin colour there (`bg-zb40-rule`) instead of writing `bg-[#e0e0e0]` in a component; `pnpm lint` rejects a hex class in any string under `src/` (`eslint.config.mjs`).

## Adding an era

The 2001 era (ADR-0019) touched these; a new one touches the same:

1. `src/lib/era.ts` — `ERAS` (the layout's inline script and `<EraToggle>`'s buttons come from it) and `ERA_LABELS`.
2. `src/styles/eras.css` — the `:root[data-era="…"]` tokens, `.era-…-only` visibility, and the toggle's `[data-era-option]` pressed colour.
3. The frame — `era-chrome-….tsx` with `FrameTop…` (plus `FrameLeft…` / `FrameBottom…` if the era had those frames), slotted into `era-shell.tsx`; its menus and link lists go in `src/lib/era-menus.ts`, where `era-menus.test.ts` checks the paths.
4. The home — `home-….tsx` (`Home…Content`), handed to `<EraShell>` by `src/app/page.tsx` as a new `content…` prop.
5. Lists and posts, if the era drew them differently — a view beside the others, built from the same `ListRow` / `Post` and shown with `.era-…-only` (as `list-skin-2001.tsx`, `PostHead2001`, `CommentList2001`).
6. Assets — `public/img/chrome/{era}/`, looked up with `chromeUrl(asset, era)`.
7. An ADR.

## Mobile layout

- Desktop (≥800px, where 10+100+680+7 fits) keeps each frame pixel-identical to the original; the shell switches at `frame:` (`--breakpoint-frame: 800px` in `tokens.css`, px because the frame is; in custom CSS, `@variant frame`). Narrow-only fixes go behind `max-frame:` (`width < 800px`). Don't write `min-[800px]`/`max-[799px]`: Tailwind's `max-*` is exclusive, so that pair left 799–800px with neither. The one chosen departure: every era's frame is centred, with slate on both sides in 2014/2003 where the originals sat left with a slate `1*` column (2026-10-03).
- Below 800px the layout is our own interpretation (keep the palette): `NarrowList` rows, `MobileMenu` `<details>`, `/site/` pages reflow via `NARROW_CSS` in `src/app/site/_render/assets.ts`, and `FIT_SCRIPT` (`assets/fit.js`) fits what is still wider than the screen: images over 120px shrink with their cells unless that crushes a ≤300px image, otherwise the document (not the museum bar) is zoomed to the screen. Measure overflow as `scrollWidth − clientWidth` (`innerWidth` grows with the content under mobile emulation).
- 2001 below 800px fills the width without scaling its pixel art: each piece is carried on by its own edge colours (`forg2001-*` in `skins.css`). The banner shows `t_logo` plus the plain-marble start of `t_logo_r` up to 475px, and both halves at 50% from 476px. The menu is `.forg2001-menu` in `eras.css` (seven to a row from 385px). The 390px headers sit on a band of their end colour. The 200px headers are drawn in three parts (title, face gradient, arrow). The left art's four links become a row. Only the 390×200 middle art scales.
- Verify with `pnpm build && python3 -m http.server 8789 -d out` + puppeteer-core (`/usr/bin/chromium-browser`); diff desktop screenshots against production. For a CSS change, `scripts/dev/style-snapshot.mjs` dumps every element's computed style before and after and compares them.
- Prettier trims a leading space inside template-string class names (`overflow-hidden${x}` collapses) — build class lists with an array `.join(" ")`.
