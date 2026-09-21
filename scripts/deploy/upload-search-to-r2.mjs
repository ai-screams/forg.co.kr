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
 *   pnpm build              # produces dist-search/
 *   pnpm deploy:search      # uploads dist-search/ → R2 bucket
 */

import { readFileSync } from "node:fs";
import { relative } from "node:path";

import { ENDPOINT, fetchWithRetry, mime, runPool, walk } from "./r2-client.mjs";

const SRC = "dist-search";
const BUCKET = process.env.R2_BUCKET ?? "forg-search";
const CONCURRENCY = Number(process.env.R2_CONCURRENCY ?? 20);

async function uploadOne(file) {
  const key = relative(SRC, file).split(/[\\/]/).join("/");
  const res = await fetchWithRetry(`${ENDPOINT}/${BUCKET}/${key}`, {
    method: "PUT",
    body: readFileSync(file),
    headers: { "Content-Type": mime(file) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PUT ${key} → ${res.status}: ${text.slice(0, 200)}`);
  }
}

async function main() {
  const files = [...walk(SRC)];
  console.log(`[r2] uploading ${files.length} files to ${BUCKET} (concurrency=${CONCURRENCY})`);
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
