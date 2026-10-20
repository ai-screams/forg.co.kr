<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-01 | Updated: 2026-10-01 -->

# scripts/postbuild

## Purpose

Node scripts run automatically after `next build` (wired into the `postbuild`
pnpm script) to keep the static export under Cloudflare Pages' file-count
limit before deploy. See `.claude/rules/repo-hygiene.md` for the deploy
pipeline these feed into.

## Key Files

| File                         | Description                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strip-react-runtime.mjs`    | Removes the inline RSC payload, the `/_next/` scripts and their preload from every page but `search/index.html` (the `/site/` documents carry none); fails the build if a page lacks the payload or keeps any of it                                                                                                                                                                                     |
| `strip-rsc-payloads.mjs`     | Deletes Next.js 16 App Router RSC flight-data `.txt` files from `out/` (matches `__next\..+\.txt` and `index.txt`)                                                                                                                                                                                                                                                                                      |
| `drop-image-sidecars.mjs`    | Deletes the sidecars (files named exactly `.manifest.json`) from all of `out/`: ETL metadata beside the images, and the 2026 fonts' sources, that stay in `public/`, not for the site                                                                                                                                                                                                                   |
| `old-addresses.mjs`          | Plans the old forg.co.kr addresses (ADR-0022) and writes `out/_routes.json` (old folders no museum path uses → the Function), `out/_old-images.json` (their pictures → copies) and `out/_redirects` (static 301s for the rest: folders a board shares, the root). Stops above 100 routes or 2,000 redirects. Tested in `src/lib/old-urls.test.ts`                                                       |
| `check-page-weight.mjs`      | Runs last. Holds every page's 2026 markup (ADR-0023) to limits: the 2026 bar (`data-era-frame="2026"`) and the other `.era-2026-only` markup per page kind fail the build past them, as does a deploy of more than 19,500 files (`out/img/posts/` aside); sample pages past (main's bytes + 2026's share) × 1.03 only warn. Prints its table for the Pages log. Tested in `src/lib/page-weight.test.ts` |
| `separate-search-bundle.mjs` | Moves `out/pagefind/` to a sibling `dist-search/` so the Pagefind index deploys separately via R2 instead of through Cloudflare Pages                                                                                                                                                                                                                                                                   |

## For AI Agents

### Working In This Directory

- The scripts run via the `postbuild` pnpm script, in this order: `strip-react-runtime.mjs`, `pagefind --site out --force-language ko`, `strip-rsc-payloads.mjs`, `drop-image-sidecars.mjs`, `separate-search-bundle.mjs`, `old-addresses.mjs`, `check-page-weight.mjs` (last, so it weighs the pages as they deploy). Order matters — Pagefind must finish writing `out/pagefind/` before `separate-search-bundle.mjs` moves it.
- `strip-rsc-payloads.mjs` has a real side effect: with the `.txt` payloads gone, client-side navigation has nothing to fetch. That is why `@/components/link` is a plain `<a>`; don't reintroduce next/link without accounting for this.
- `separate-search-bundle.mjs` exits 0 with a warning (not an error) if `out/pagefind` doesn't exist — don't assume a missing dir means the script failed.
- Local preview (`npx serve out`) loses search after this runs, since the bundle has moved to `dist-search/` — that's an accepted tradeoff, not a bug.

### Testing Requirements

`old-addresses.mjs` and `check-page-weight.mjs` export their pure parts, tested in `src/lib/old-urls.test.ts` and `src/lib/page-weight.test.ts`. For the rest, verify changes by running `pnpm build` and checking: `out/` has no `__next.*.txt` / loose `index.txt` / `.manifest.json` files left, and `dist-search/` exists with `out/pagefind/` gone.

### Common Patterns

- Both scripts are plain Node ESM with no dependencies beyond `node:fs` — keep additions here dependency-free; anything needing a package belongs in `scripts/deploy/` or `scripts/dev/`.

## Dependencies

### Internal

- `out/` — the `next build` static export, read and mutated in place.
- `dist-search/` — created here, consumed by `scripts/deploy/upload-search-to-r2.mjs`.

### External

- `pagefind` (devDependency, pinned 1.4.0 — see `.claude/rules/stack-and-tooling.md`) — runs before these scripts in the `postbuild` chain and produces `out/pagefind/`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
