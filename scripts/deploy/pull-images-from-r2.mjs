#!/usr/bin/env node
/**
 * Download recovered post images from Cloudflare R2 into `public/img/posts/`
 * (ADR-0018) — the reverse of `upload-images-to-r2.mjs`, for a clone that
 * needs the bytes locally (a second ETL machine, an offline copy).
 *
 * Only keys that are missing locally or differ in size are fetched; existing
 * files are never overwritten with a smaller one.
 *
 * Environment (see `.env.r2.local`):
 *   R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
 *   R2_IMG_BUCKET         — Bucket name (default: forg-img)
 *   R2_CONCURRENCY        — Parallel downloads (default: 20)
 *
 * Usage:
 *   pnpm img:pull
 */

import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ENDPOINT, fetchWithRetry, listKeys, runPool } from "./r2-client.mjs";

const DEST = "public/img/posts";
const PREFIX = "posts/";
const BUCKET = process.env.R2_IMG_BUCKET ?? "forg-img";
const CONCURRENCY = Number(process.env.R2_CONCURRENCY ?? 20);

async function main() {
  console.log(`[r2:img] listing ${BUCKET}/${PREFIX}…`);
  const remote = await listKeys(BUCKET, PREFIX);
  const todo = [];
  for (const [key, { size }] of remote) {
    const local = join(DEST, key.slice(PREFIX.length));
    if (existsSync(local) && statSync(local).size === size) continue;
    todo.push({ key, local });
  }
  console.log(`[r2:img] ${remote.size} remote, ${todo.length} to download`);

  const errors = await runPool(
    todo,
    CONCURRENCY,
    async ({ key, local }) => {
      const res = await fetchWithRetry(`${ENDPOINT}/${BUCKET}/${key}`, { method: "GET" });
      if (!res.ok) throw new Error(`GET ${key} → ${res.status}`);
      mkdirSync(dirname(local), { recursive: true });
      writeFileSync(local, Buffer.from(await res.arrayBuffer()));
    },
    (done, total) => {
      if (done % 200 === 0 || done === total) console.log(`[r2:img] ${done}/${total}`);
    },
  );

  console.log(
    `[r2:img] done: ${todo.length - errors.length}/${todo.length} downloaded, ${errors.length} errors`,
  );
  if (errors.length > 0) {
    for (const e of errors.slice(0, 5)) console.error(`  ${e.item.key}: ${e.error}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`[r2:img] fatal: ${e.message}`);
  process.exit(1);
});
