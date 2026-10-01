---
paths:
  - "src/**"
---

# Era system and layout (ADR-0001, ADR-0005, ADR-0006, ADR-0016)

## Era toggle

- `<html data-era="2014" | "2003">` is the single source of truth: set by SSR (`src/app/layout.tsx`), patched before hydration by an inline script reading `localStorage["forg.era"]`.
- Era-invariant tokens are in `@theme` in `src/app/globals.css` (`forg-gold`, `font-forg`, …); era-specific ones in `:root[data-era="…"]` (`--era-page-bg`, …). Use `bg-forg-gold` or `bg-(--era-page-bg)` — never both styles for one concept.
- `<EraToggle>` uses `useSyncExternalStore`, not `useEffect + setState` (the React Compiler lint flags the latter). Mirror it for any DOM-as-state subscription.
- Colours are **OKLCH** with the original sRGB hex in an adjacent comment.

## Mobile layout

- Desktop (≥800px, where 10+100+680+7 fits) must stay pixel-identical to the original; the shell switches at `min-[800px]`. Narrow-only fixes go behind `max-[799px]:`.
- Below 800px the layout is our own interpretation (keep the palette): `NarrowList` rows, `MobileMenu` `<details>`, `/site/` pages reflow via `NARROW_CSS` in `src/app/site/[...path]/route.ts`.
- Verify with `pnpm build && python3 -m http.server 8789 -d out` + puppeteer-core (`/usr/bin/chromium-browser`); diff desktop screenshots against production.
- Prettier trims a leading space inside template-string class names (`overflow-hidden${x}` collapses) — build class lists with an array `.join(" ")`.
