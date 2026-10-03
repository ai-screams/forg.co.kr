#!/usr/bin/env node
/**
 * Upload `dist-search/` to Cloudflare R2.
 *
 * Parallel signed PUTs (see `r2-client.mjs`) — ~30 seconds for the 13,332
 * Pagefind files versus ~30 minutes of `wrangler r2 object put` in a loop.
 *
 * Environment (see `.env.r2.local`):
 *   R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
 *   R2_BUCKET             — Bucket name (default: forg-search)
 *   R2_CONCURRENCY        — Parallel uploads (default: 20)
 *
 * Usage:
 *   pnpm build                    # produces dist-search/
 *   pnpm deploy:search            # uploads dist-search/ → R2 bucket
 *   pnpm deploy:search --dry-run  # only count the files per Cache-Control
 *
 * The files go under the Pagefind version that built them (`1.4.0/…`, read
 * from `pagefind-entry.json`), the folder `next.config.ts` points the site at:
 * pages built against an older version keep finding theirs.
 *
 * Cache-Control: Pagefind's data files (`.pf_index`, `.pf_fragment`,
 * `.pf_filter`, `.pf_meta`) are named after a content hash
 * (`index/ko_8758385.pf_index`), so they never change under their name and are
 * cached for a year. The rest
 * (`pagefind.js`, `pagefind-entry.json`, which points at the current meta)
 * keep their names across builds and are cached for five minutes. Old hashed
 * files stay in the bucket, so a page holding a stale entry still finds the
 * index it names.
 */

import { readFileSync } from "node:fs";
import { relative } from "node:path";

import { ENDPOINT, fetchWithRetry, mime, runPool, walk } from "./r2-client.mjs";

const SRC = "dist-search";
const BUCKET = process.env.R2_BUCKET ?? "forg-search";
const CONCURRENCY = Number(process.env.R2_CONCURRENCY ?? 20);
const DRY_RUN = process.argv.includes("--dry-run");
const { version: VERSION } = JSON.parse(readFileSync(`${SRC}/pagefind-entry.json`, "utf8"));

const HASHED = /\.pf_[a-z]+$/;

function cacheControl(key) {
  return HASHED.test(key) ? "public, max-age=31536000, immutable" : "public, max-age=300";
}

function keyOf(file) {
  return `${VERSION}/${relative(SRC, file).split(/[\\/]/).join("/")}`;
}

async function uploadOne(file) {
  const key = keyOf(file);
  const res = await fetchWithRetry(`${ENDPOINT}/${BUCKET}/${key}`, {
    method: "PUT",
    body: readFileSync(file),
    headers: { "Content-Type": mime(file), "Cache-Control": cacheControl(key) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PUT ${key} → ${res.status}: ${text.slice(0, 200)}`);
  }
}

async function main() {
  const files = [...walk(SRC)];
  if (DRY_RUN) {
    const byHeader = Map.groupBy(files.map(keyOf), cacheControl);
    for (const [cc, keys] of byHeader) {
      console.log(`[r2] ${cc}: ${keys.length} (${keys.slice(0, 3).join(", ")}, …)`);
    }
    console.log(`[r2] dry-run: ${files.length} files under ${VERSION}/, nothing uploaded`);
    return;
  }
  console.log(
    `[r2] uploading ${files.length} files to ${BUCKET}/${VERSION}/ (concurrency=${CONCURRENCY})`,
  );
  const errors = await runPool(files, CONCURRENCY, uploadOne, (done, total) => {
    if (done % 500 === 0 || done === total) console.log(`[r2] ${done}/${total}`);
  });
  console.log(
    `[r2] done: ${files.length - errors.length}/${files.length} ok, ${errors.length} errors`,
  );
  if (errors.length > 0) {
    console.error("[r2] sample errors:");
    for (const e of errors.slice(0, 5)) console.error(`  ${e.item}: ${e.error}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`[r2] fatal: ${e.message}`);
  process.exit(1);
});
