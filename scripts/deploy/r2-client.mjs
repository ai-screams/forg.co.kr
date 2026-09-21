/**
 * Shared Cloudflare R2 client for the deploy scripts (search index, post images).
 *
 * R2 is S3-compatible; requests are signed with aws4fetch (SigV4). aws4fetch
 * retries 5xx/429 itself, but a network error ("fetch failed") throws straight
 * through — `fetchWithRetry` covers those. A first full search-index run lost
 * 9 of 13,346 files that way.
 *
 * Required environment variables (see `.env.r2.local`, git-ignored):
 *   R2_ACCOUNT_ID         — Cloudflare account id (Dashboard → R2 sidebar)
 *   R2_ACCESS_KEY_ID      — R2 API token Access Key
 *   R2_SECRET_ACCESS_KEY  — R2 API token Secret Access Key
 */

import { AwsClient } from "aws4fetch";
import { readdirSync } from "node:fs";
import { join } from "node:path";

export function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`[r2] missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

const ACCOUNT_ID = required("R2_ACCOUNT_ID");
export const ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

export const aws = new AwsClient({
  accessKeyId: required("R2_ACCESS_KEY_ID"),
  secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
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
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export function mime(p) {
  const ext = p.slice(p.lastIndexOf(".")).toLowerCase();
  return MIME[ext] ?? "application/octet-stream";
}

export function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fp = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fp);
    } else if (entry.isFile()) {
      yield fp;
    }
  }
}

const NETWORK_ATTEMPTS = 4;

export async function fetchWithRetry(url, init) {
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

/** Run `fn` over `items` with at most `concurrency` in flight; collects errors. */
export async function runPool(items, concurrency, fn, onProgress) {
  const queue = [...items];
  const errors = [];
  let done = 0;
  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) return;
      try {
        await fn(item);
      } catch (e) {
        errors.push({ item, error: e.message });
      }
      done++;
      onProgress?.(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return errors;
}

/** List every key under `prefix` (ListObjectsV2 with continuation). */
export async function listKeys(bucket, prefix) {
  const out = new Map(); // key → { size, etag }
  let token;
  for (;;) {
    const params = new URLSearchParams({ "list-type": "2", prefix, "max-keys": "1000" });
    if (token) params.set("continuation-token", token);
    const res = await fetchWithRetry(`${ENDPOINT}/${bucket}?${params}`, { method: "GET" });
    if (!res.ok)
      throw new Error(`ListObjectsV2 → ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const xml = await res.text();
    for (const m of xml.matchAll(
      /<Contents><Key>([^<]+)<\/Key><LastModified>[^<]*<\/LastModified><ETag>&quot;([^&]+)&quot;<\/ETag><Size>(\d+)<\/Size>/g,
    )) {
      out.set(decodeXml(m[1]), { etag: m[2], size: Number(m[3]) });
    }
    const next = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    if (!next) break;
    token = decodeXml(next[1]);
  }
  return out;
}

function decodeXml(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");
}
