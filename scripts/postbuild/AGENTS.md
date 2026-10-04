<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-01 | Updated: 2026-10-01 -->

# scripts/postbuild

## Purpose

Node scripts run automatically after `next build` (wired into the `postbuild`
pnpm script) to keep the static export under Cloudflare Pages' file-count
limit before deploy. See `.claude/rules/repo-hygiene.md` for the deploy
pipeline these feed into.

## Key Files

| File                         | Description                                                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strip-rsc-payloads.mjs`     | Deletes Next.js 16 App Router RSC flight-data `.txt` files from `out/` (matches `__next\..+\.txt` and `index.txt`)                                          |
| `drop-image-sidecars.mjs`    | Deletes the image sidecars (files named exactly `.manifest.json`) from `out/img/`: ETL metadata that stays beside the images in `public/`, not for the site |
| `separate-search-bundle.mjs` | Moves `out/pagefind/` to a sibling `dist-search/` so the Pagefind index deploys separately via R2 instead of through Cloudflare Pages                       |

## For AI Agents

### Working In This Directory

- The scripts run via the `postbuild` pnpm script, in this order: `pagefind --site out --force-language ko && node scripts/postbuild/strip-rsc-payloads.mjs && node scripts/postbuild/drop-image-sidecars.mjs && node scripts/postbuild/separate-search-bundle.mjs`. Order matters — Pagefind must finish writing `out/pagefind/` before `separate-search-bundle.mjs` moves it.
- `strip-rsc-payloads.mjs` has a real side effect: with the `.txt` payloads gone, client-side navigation has nothing to fetch. That is why `@/components/link` is a plain `<a>`; don't reintroduce next/link without accounting for this.
- `separate-search-bundle.mjs` exits 0 with a warning (not an error) if `out/pagefind` doesn't exist — don't assume a missing dir means the script failed.
- Local preview (`npx serve out`) loses search after this runs, since the bundle has moved to `dist-search/` — that's an accepted tradeoff, not a bug.

### Testing Requirements

No automated test suite. Verify changes by running `pnpm build` and checking: `out/` has no `__next.*.txt` / loose `index.txt` / `.manifest.json` files left, and `dist-search/` exists with `out/pagefind/` gone.

### Common Patterns

- Both scripts are plain Node ESM with no dependencies beyond `node:fs` — keep additions here dependency-free; anything needing a package belongs in `scripts/deploy/` or `scripts/dev/`.

## Dependencies

### Internal

- `out/` — the `next build` static export, read and mutated in place.
- `dist-search/` — created here, consumed by `scripts/deploy/upload-search-to-r2.mjs`.

### External

- `pagefind` (devDependency, pinned 1.4.0 — see `.claude/rules/stack-and-tooling.md`) — runs before these scripts in the `postbuild` chain and produces `out/pagefind/`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
