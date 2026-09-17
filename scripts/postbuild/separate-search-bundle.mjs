#!/usr/bin/env node
/**
 * Separate Pagefind index from the Cloudflare Pages deploy.
 *
 * Pagefind emits ~13,300 small fragment files (one per indexed page) to
 * `out/pagefind/`. Combined with the rest of the static site, the deploy
 * exceeds Cloudflare Pages' 20,000-file cap (ADR-0015 Re-evaluation
 * trigger #2). The search bundle is hosted separately on Cloudflare R2
 * and fetched at runtime via `NEXT_PUBLIC_PAGEFIND_BASE`.
 *
 * This script moves the bundle out of `out/` (which Cloudflare uploads)
 * into a sibling `dist-search/` (which the deploy:search script uploads
 * to R2). Local preview (`npx serve out`) loses search unless the bundle
 * is symlinked back in; that is acceptable for a deploy-time tradeoff.
 */

import { existsSync, renameSync, rmSync } from "node:fs";

const SRC = "out/pagefind";
const DST = "dist-search";

if (!existsSync(SRC)) {
  console.warn(`[postbuild] separate-search-bundle: ${SRC} not found — skipping`);
  process.exit(0);
}

if (existsSync(DST)) {
  rmSync(DST, { recursive: true, force: true });
}

renameSync(SRC, DST);
console.log(`[postbuild] separate-search-bundle: ${SRC} → ${DST}/ (Cloudflare R2 destination)`);
