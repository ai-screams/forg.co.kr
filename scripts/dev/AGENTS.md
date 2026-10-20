<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-01 | Updated: 2026-10-01 -->

# scripts/dev

## Purpose

Local developer tooling that isn't part of the build or deploy pipeline:
a headless-screenshot helper for comparing the museum against original
Wayback captures or checking a deploy, and a computed-style snapshot for
showing a CSS change changed nothing it should not.

## Key Files

| File                    | Description                                                                                                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shot.mjs`              | Headless Chrome screenshots + render facts (era applied, CSS rule count, hydration, image count, broken images, console errors) via `puppeteer-core`                                                                                           |
| `style-snapshot.mjs`    | Computed style of every element drawn on 13 pages × 4 eras × 4 widths: `dump` a served build, `compare` two dumps in order (exit 1 on a difference), `detail` one element's full style                                                         |
| `fetch-fonts-2026.mjs`  | Fetches the 2026 fonts' slices from Google Fonts once into `public/fonts/2026/` with `2026.css` and `.manifest.json` (source URL and SHA-256); renames Plex's slices Forg Sans KR (OFL Reserved Font Name). Run after `subset-digits-font.sh`. |
| `subset-digits-font.sh` | Cuts Forg Digits (D2Coding's digits, Latin and a few signs, renamed) into `public/fonts/2026/forg-digits.woff2` from the checked release zip.                                                                                                  |
| `rename-font.py`        | Renames a font's family in its name table and saves it as WOFF2, for the two scripts above (uv, fonttools).                                                                                                                                    |

## For AI Agents

### Working In This Directory

- `shot.mjs` and `style-snapshot.mjs` are tracked (`git ls-files scripts/dev`). Scratch Puppeteer scripts named `scripts/dev/.*.mjs` (leading dot) are created ad hoc during a session and deleted after use — don't assume a dotfile here is meant to persist, and don't add one to git.
- `shot.mjs` usage: `node scripts/dev/shot.mjs <base-url> <out-dir> "<era>|<path>|<name>[|<width>[|dark]]" ...` — each spec sets `localStorage["forg.era"]` before load so the FOUC script applies that era, then saves `<out-dir>/<name>.png` at 1280x900, or the spec's width, in the dark colour scheme with `dark`.
- Needs a local Chrome/Chromium binary. Set `CHROME_PATH`, or it falls back to common macOS/Linux paths (`/usr/bin/google-chrome`, `/usr/bin/chromium`, `/snap/bin/chromium`, etc.).
- Against a dev server, `networkidle0` never fires because of the open HMR socket — `shot.mjs` defaults to `SHOT_WAIT=load` plus a `SHOT_SETTLE` ms pause instead; override both via env if a page needs longer to settle.

### Testing Requirements

These are manual verification tools, not something tests call. `style-snapshot.mjs` is checked by dumping one build twice (`compare` must report every page view identical). "Testing" a change to `shot.mjs` means running it against a live `next dev` or `next start` server and confirming the PNG and the printed render-facts line look right.

### Common Patterns

- `puppeteer-core` is a devDependency already in the lockfile (pulled in through `size-limit`'s runner), not a dependency added for this script.

## Dependencies

### Internal

- Reads `localStorage["forg.era"]`, the same key the FOUC-prevention script in `src/app/layout.tsx` reads, to force an era before capture.

### External

- `puppeteer-core` — drives a local Chrome/Chromium; no bundled browser download.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
