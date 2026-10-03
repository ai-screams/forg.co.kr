/**
 * Shared Cloudflare R2 client for the deploy scripts (search index, post images).
 *
 * R2 is S3-compatible; requests are signed with aws4fetch (SigV4). aws4fetch
 * retries 5xx/429 itself, but a network error ("fetch failed") throws straight
 * through — `fetchWithRetry` covers those. A first full search-index run lost
 * 9 of 13,346 files that way.
 *
 * Environment variables (see `.env.r2.local`, git-ignored), read on the first
 * request, so a dry run that never talks to R2 needs none of them:
 *   R2_ACCOUNT_ID         — Cloudflare account id (Dashboard → R2 sidebar)
 *   R2_ACCESS_KEY_ID      — R2 API token Access Key
 *   R2_SECRET_ACCESS_KEY  — R2 API token Secret Access Key
 */

import { AwsClient } from "aws4fetch";
import { readdirSync } from "node:fs";
import { join } from "node:path";

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`[r2] missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

let client;

/** The signing client and endpoint, made on the first request. */
function r2() {
  client ??= {
    endpoint: `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    aws: new AwsClient({
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      service: "s3",
      region: "auto",
    }),
  };
  return client;
}

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

/** A signed request to `{bucket}/{path}` (a key, or `?query` on the bucket). */
async function fetchWithRetry(bucket, path, init) {
  const { endpoint, aws } = r2();
  const url = `${endpoint}/${bucket}${path.startsWith("?") ? "" : "/"}${path}`;
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

/** PUT one object; a refusal throws with the status and the start of R2's answer. */
export async function putObject(bucket, key, body, headers) {
  const res = await fetchWithRetry(bucket, key, { method: "PUT", body, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PUT ${key} → ${res.status}: ${text.slice(0, 200)}`);
  }
}

/** GET one object's bytes. */
export async function getObject(bucket, key) {
  const res = await fetchWithRetry(bucket, key, { method: "GET" });
  if (!res.ok) throw new Error(`GET ${key} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
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
    const res = await fetchWithRetry(bucket, `?${params}`, { method: "GET" });
    if (!res.ok)
      throw new Error(`ListObjectsV2 → ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const xml = await res.text();
    // One entry per <Contents> block, read by tag rather than by position:
    // R2 orders them Key, Size, LastModified, ETag, StorageClass, which is
    // not the order the S3 documentation lists and not what a fixed-sequence
    // pattern matched — it found nothing and every object looked absent.
    for (const [, block] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = block.match(/<Key>([^<]+)<\/Key>/);
      const etag = block.match(/<ETag>(?:&quot;|")?([^&"<]+)/);
      const size = block.match(/<Size>(\d+)<\/Size>/);
      // A listing we cannot read is an error, not an empty answer: guessing
      // "" and 0 would make the upload resend unchanged files and the pull
      // keep a zero-byte local copy of a non-empty object.
      if (!key || !etag || !size) {
        throw new Error(`ListObjectsV2: unreadable <Contents>: ${block.slice(0, 200)}`);
      }
      out.set(decodeXml(key[1]), { etag: etag[1], size: Number(size[1]) });
    }
    const next = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    if (!next) break;
    token = decodeXml(next[1]);
  }
  return out;
}

const XML_ENTITIES = { quot: '"', amp: "&", lt: "<", gt: ">", apos: "'" };

/**
 * One pass over the entities, so a decoded `&` never starts a second
 * reference: `a&amp;apos;b` is the key `a&apos;b`, not `a'b`. R2 writes an
 * apostrophe as `&apos;` (`serpent&apos;s-fang_s.jpg`); numeric references
 * are decoded too so no other spelling of a character survives into a key.
 */
function decodeXml(s) {
  return s.replace(
    /&(?:#x([0-9a-f]+)|#(\d+)|(quot|amp|lt|gt|apos));/gi,
    (whole, hex, dec, name) => {
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      if (dec) return String.fromCodePoint(Number(dec));
      return XML_ENTITIES[name.toLowerCase()] ?? whole;
    },
  );
}
