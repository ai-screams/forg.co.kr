---
paths:
  - "src/**"
---

# Era system and layout (ADR-0001, ADR-0005, ADR-0006, ADR-0016, ADR-0019)

## Era toggle

- `<html data-era="2014" | "2003" | "2001">` is the single source of truth: set by SSR (`src/app/layout.tsx`), patched before hydration by an inline script reading `localStorage["forg.era"]`.
- Era-invariant tokens are in `@theme` in `src/app/globals.css` (`forg-gold`, `font-forg`, …); era-specific ones in `:root[data-era="…"]` (`--era-page-bg`, …). Use `bg-forg-gold` or `bg-(--era-page-bg)` — never both styles for one concept.
- Visibility: `.era-2014-only` / `.era-2003-only` / `.era-2001-only`, plus `.era-not-2001` for the 2014/2003 side columns. 2001 centres a 790px column (`.forg-shell` / `.forg-shell-main` in `globals.css`); 2014 and 2003 keep the 10/100/680/7/\* frame.
- `<EraToggle>` uses `useSyncExternalStore`, not `useEffect + setState` (the React Compiler lint flags the latter). Mirror it for any DOM-as-state subscription. Its pressed colour comes from the `[data-era-option]` rules in `globals.css`, so the saved era is lit before hydration; another tab's change arrives as a `storage` event that sets `data-era`.
- Era-specific `<img>`s carry `loading="lazy"`: a hidden era's images then never load, and React does not emit `<link rel=preload>` for them.
- Colours are **OKLCH** with the original sRGB hex in an adjacent comment.

## Mobile layout

- Desktop (≥800px, where 10+100+680+7 fits) keeps each frame pixel-identical to the original; the shell switches at `min-[800px]`. Narrow-only fixes go behind `max-[799px]:`. The one chosen departure: every era's frame is centred, with slate on both sides in 2014/2003 where the originals sat left with a slate `1*` column (2026-10-03).
- Below 800px the layout is our own interpretation (keep the palette): `NarrowList` rows, `MobileMenu` `<details>`, `/site/` pages reflow via `NARROW_CSS` in `src/app/site/[...path]/route.ts`.
- Verify with `pnpm build && python3 -m http.server 8789 -d out` + puppeteer-core (`/usr/bin/chromium-browser`); diff desktop screenshots against production.
- Prettier trims a leading space inside template-string class names (`overflow-hidden${x}` collapses) — build class lists with an array `.join(" ")`.
