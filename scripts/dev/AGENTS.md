<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-01 | Updated: 2026-10-01 -->

# scripts/dev

## Purpose

Local developer tooling that isn't part of the build or deploy pipeline —
currently a headless-screenshot helper for visually comparing the museum
against original Wayback captures or checking a deploy.

## Key Files

| File       | Description                                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shot.mjs` | Headless Chrome screenshots + render facts (era applied, CSS rule count, hydration, image count, broken images, console errors) via `puppeteer-core` |

## For AI Agents

### Working In This Directory

- Only `shot.mjs` is tracked (`git ls-files scripts/dev`). Scratch Puppeteer scripts named `scripts/dev/.*.mjs` (leading dot) are created ad hoc during a session and deleted after use — don't assume a dotfile here is meant to persist, and don't add one to git.
- `shot.mjs` usage: `node scripts/dev/shot.mjs <base-url> <out-dir> "<era>|<path>|<name>" ...` — each spec sets `localStorage["forg.era"]` before load so the FOUC script applies that era, then saves `<out-dir>/<name>.png` at 1280x900.
- Needs a local Chrome/Chromium binary. Set `CHROME_PATH`, or it falls back to common macOS/Linux paths (`/usr/bin/google-chrome`, `/usr/bin/chromium`, `/snap/bin/chromium`, etc.).
- Against a dev server, `networkidle0` never fires because of the open HMR socket — `shot.mjs` defaults to `SHOT_WAIT=load` plus a `SHOT_SETTLE` ms pause instead; override both via env if a page needs longer to settle.

### Testing Requirements

No automated test suite — this is a manual visual-verification tool, not something tests call. "Testing" a change to `shot.mjs` means running it against a live `next dev` or `next start` server and confirming the PNG and the printed render-facts line look right.

### Common Patterns

- `puppeteer-core` is a devDependency already in the lockfile (pulled in through `size-limit`'s runner), not a dependency added for this script.

## Dependencies

### Internal

- Reads `localStorage["forg.era"]`, the same key the FOUC-prevention script in `src/app/layout.tsx` reads, to force an era before capture.

### External

- `puppeteer-core` — drives a local Chrome/Chromium; no bundled browser download.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
