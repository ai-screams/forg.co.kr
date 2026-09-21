#!/usr/bin/env node
/**
 * Upload recovered post images (`public/img/posts/`) to Cloudflare R2 (ADR-0018).
 *
 * Bucket keys mirror the public URL: `posts/{board}/{post_id}/{filename}`, so
 * `NEXT_PUBLIC_IMG_BASE` + `/posts/…` serves what `/img/posts/…` served from
 * the repo. Idempotent: the bucket is listed once and a file is skipped when
 * an object of the same key already has its MD5 (R2's ETag for a single PUT).
 * Per-post `.manifest.json` sidecars stay in git and are not uploaded.
 *
 * Environment (see `.env.r2.local`):
 *   R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
 *   R2_IMG_BUCKET         — Bucket name (default: forg-img)
 *   R2_CONCURRENCY        — Parallel uploads (default: 20)
 *
 * Usage:
 *   pnpm deploy:img            # upload what changed
 *   pnpm deploy:img --dry-run  # only report what would be uploaded
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { relative } from "node:path";

import { ENDPOINT, fetchWithRetry, listKeys, mime, runPool, walk } from "./r2-client.mjs";

const SRC = "public/img/posts";
const PREFIX = "posts/";
const BUCKET = process.env.R2_IMG_BUCKET ?? "forg-img";
const CONCURRENCY = Number(process.env.R2_CONCURRENCY ?? 20);
const DRY_RUN = process.argv.includes("--dry-run");
// Filenames never change in place (a different capture lands at a different
// path), so the browser may keep an image for as long as it likes.
const CACHE_CONTROL = "public, max-age=31536000, immutable";

function keyOf(file) {
  return PREFIX + relative(SRC, file).split(/[\\/]/).join("/");
}

async function main() {
  const files = [...walk(SRC)].filter((f) => !f.endsWith(".manifest.json"));
  console.log(`[r2:img] ${files.length} local files under ${SRC}; listing ${BUCKET}/${PREFIX}…`);
  const remote = await listKeys(BUCKET, PREFIX);
  console.log(`[r2:img] ${remote.size} objects already in the bucket`);

  const todo = [];
  let same = 0;
  for (const file of files) {
    const body = readFileSync(file);
    const md5 = createHash("md5").update(body).digest("hex");
    const have = remote.get(keyOf(file));
    if (have && have.etag === md5) {
      same++;
      continue;
    }
    todo.push({ file, body });
  }
  console.log(`[r2:img] unchanged=${same} to_upload=${todo.length}${DRY_RUN ? " (dry-run)" : ""}`);
  if (DRY_RUN) {
    for (const t of todo.slice(0, 20)) console.log(`  would PUT ${keyOf(t.file)}`);
    if (todo.length > 20) console.log(`  … and ${todo.length - 20} more`);
    return;
  }

  const errors = await runPool(
    todo,
    CONCURRENCY,
    async ({ file, body }) => {
      const key = keyOf(file);
      const res = await fetchWithRetry(`${ENDPOINT}/${BUCKET}/${key}`, {
        method: "PUT",
        body,
        headers: { "Content-Type": mime(file), "Cache-Control": CACHE_CONTROL },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`PUT ${key} → ${res.status}: ${text.slice(0, 200)}`);
      }
    },
    (done, total) => {
      if (done % 200 === 0 || done === total) console.log(`[r2:img] ${done}/${total}`);
    },
  );

  console.log(
    `[r2:img] done: ${todo.length - errors.length}/${todo.length} uploaded, ${errors.length} errors`,
  );
  if (errors.length > 0) {
    console.error("[r2:img] sample errors:");
    for (const e of errors.slice(0, 5)) console.error(`  ${e.item.file}: ${e.error}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`[r2:img] fatal: ${e.message}`);
  process.exit(1);
});
