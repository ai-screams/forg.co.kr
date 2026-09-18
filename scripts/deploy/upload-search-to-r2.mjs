#!/usr/bin/env node
/**
 * Upload `dist-search/` to Cloudflare R2.
 *
 * R2 is S3-compatible; we sign requests with aws4fetch (SigV4) for parallel
 * PUTs. This is significantly faster than `wrangler r2 object put` in a
 * loop (~30 minutes vs ~30 seconds for the 13,332 Pagefind files).
 *
 * Required environment variables:
 *   R2_ACCOUNT_ID         — Cloudflare account id (Dashboard → R2 sidebar)
 *   R2_ACCESS_KEY_ID      — R2 API token Access Key
 *   R2_SECRET_ACCESS_KEY  — R2 API token Secret Access Key
 *   R2_BUCKET             — Bucket name (default: forg-search)
 *
 * Optional:
 *   R2_CONCURRENCY        — Parallel uploads (default: 20)
 *
 * Usage:
 *   pnpm build              # produces dist-search/
 *   pnpm deploy:search      # uploads dist-search/ → R2 bucket
 */

import { AwsClient } from "aws4fetch";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = "dist-search";
const BUCKET = process.env.R2_BUCKET ?? "forg-search";
const ACCOUNT_ID = required("R2_ACCOUNT_ID");
const ACCESS_KEY = required("R2_ACCESS_KEY_ID");
const SECRET_KEY = required("R2_SECRET_ACCESS_KEY");
const ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;
const CONCURRENCY = Number(process.env.R2_CONCURRENCY ?? 20);

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`[r2] missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

const aws = new AwsClient({
  accessKeyId: ACCESS_KEY,
  secretAccessKey: SECRET_KEY,
  service: "s3",
  region: "auto",
});

const MIME = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".pf_meta": "application/octet-stream",
  ".pf_index": "application/octet-stream",
  ".pf_fragment": "application/octet-stream",
  ".pf_filter": "application/octet-stream",
};

function mime(p) {
  const ext = p.slice(p.lastIndexOf("."));
  return MIME[ext] ?? "application/octet-stream";
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fp = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fp);
    } else if (entry.isFile()) {
      yield fp;
    }
  }
}

// aws4fetch retries 5xx/429 itself, but a network error ("fetch failed")
// throws straight through — retry those here. A first full run lost 9 of
// 13,346 files that way.
const NETWORK_ATTEMPTS = 4;

async function putWithRetry(url, init) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await aws.fetch(url, init);
    } catch (e) {
      if (attempt >= NETWORK_ATTEMPTS) {
        const code = e.cause?.code ? ` (${e.cause.code})` : "";
        throw new Error(`${e.message}${code} after ${attempt} attempts`);
      }
      await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
    }
  }
}

async function uploadOne(file) {
  const key = relative(SRC, file).split(/[\\/]/).join("/");
  const body = readFileSync(file);
  const url = `${ENDPOINT}/${BUCKET}/${key}`;
  const res = await putWithRetry(url, {
    method: "PUT",
    body,
    headers: { "Content-Type": mime(file) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PUT ${key} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return key;
}

async function main() {
  const files = [...walk(SRC)];
  console.log(`[r2] uploading ${files.length} files to ${BUCKET} (concurrency=${CONCURRENCY})`);
  const queue = [...files];
  let done = 0;
  const errors = [];

  async function worker() {
    while (queue.length > 0) {
      const f = queue.shift();
      if (!f) return;
      try {
        await uploadOne(f);
        done++;
        if (done % 500 === 0 || done === files.length) {
          console.log(`[r2] ${done}/${files.length}`);
        }
      } catch (e) {
        errors.push({ file: f, error: e.message });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`[r2] done: ${done}/${files.length} ok, ${errors.length} errors`);
  if (errors.length > 0) {
    console.error("[r2] sample errors:");
    for (const e of errors.slice(0, 5)) console.error(`  ${e.file}: ${e.error}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`[r2] fatal: ${e.message}`);
  process.exit(1);
});
