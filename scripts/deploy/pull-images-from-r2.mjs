#!/usr/bin/env node
/**
 * Download recovered post images from Cloudflare R2 into `public/img/posts/`
 * (ADR-0018) — the reverse of `upload-images-to-r2.mjs`, for a clone that
 * needs the bytes locally (a second ETL machine, an offline copy).
 *
 * Only keys missing locally are fetched. A local file is never overwritten or
 * removed: one whose size differs from R2's may hold bytes not uploaded yet,
 * so it is listed and left alone (compare it, then `pnpm deploy:img`).
 *
 * Environment (see `.env.r2.local`):
 *   R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
 *   R2_IMG_BUCKET         — Bucket name (default: forg-img)
 *   R2_CONCURRENCY        — Parallel downloads (default: 20)
 *
 * Usage:
 *   pnpm img:pull             # download what is missing
 *   pnpm img:pull --dry-run   # only report it
 */

import { existsSync, linkSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { getObject, listKeys, runPool } from "./r2-client.mjs";

const DEST = "public/img/posts";
const PREFIX = "posts/";
const BUCKET = process.env.R2_IMG_BUCKET ?? "forg-img";
const CONCURRENCY = Number(process.env.R2_CONCURRENCY ?? 20);
const DRY_RUN = process.argv.includes("--dry-run");

/** Keys missing locally (to fetch), and local files whose size differs (to report). */
function plan(remote) {
  const todo = [];
  const differs = [];
  for (const [key, { size }] of remote) {
    const local = join(DEST, key.slice(PREFIX.length));
    if (!existsSync(local)) {
      todo.push({ key, local });
      continue;
    }
    const localSize = statSync(local).size;
    if (localSize !== size) differs.push({ local, localSize, size });
  }
  return { todo, differs };
}

async function main() {
  console.log(`[r2:img] listing ${BUCKET}/${PREFIX}…`);
  const remote = await listKeys(BUCKET, PREFIX);
  const { todo, differs } = plan(remote);
  console.log(
    `[r2:img] ${remote.size} remote, ${todo.length} missing locally, ` +
      `${differs.length} kept with another size${DRY_RUN ? " (dry-run)" : ""}`,
  );
  for (const d of differs.slice(0, 20)) {
    console.log(`  kept ${d.local}: ${d.localSize} B here, ${d.size} B in R2`);
  }
  if (differs.length > 20) console.log(`  … and ${differs.length - 20} more`);
  if (DRY_RUN) {
    for (const t of todo.slice(0, 20)) console.log(`  would GET ${t.key}`);
    if (todo.length > 20) console.log(`  … and ${todo.length - 20} more`);
    return;
  }

  const errors = await runPool(
    todo,
    CONCURRENCY,
    async ({ key, local }) => {
      const bytes = await getObject(BUCKET, key);
      mkdirSync(dirname(local), { recursive: true });
      // Whole bytes first, then the name: a failed write leaves only the
      // `.part` file (the next pull rewrites it), never a short file under the
      // real name that would then be kept. `linkSync` fails rather than
      // overwrite a file that appeared meanwhile.
      const part = `${local}.part`;
      writeFileSync(part, bytes);
      linkSync(part, local);
      unlinkSync(part);
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
