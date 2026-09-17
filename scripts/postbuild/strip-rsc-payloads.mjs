#!/usr/bin/env node
/**
 * Strip Next.js 16 App Router RSC payload `.txt` files from `out/`.
 *
 * Per page Next.js generates ~9-10 small `.txt` files containing the React
 * Server Component flight data + prefetch hints. For a 13,295-page museum
 * that's ~122,000 files. Cloudflare Pages caps deploys at 20,000 files
 * (see ADR-0015) — these payloads must be removed.
 *
 * Files removed match `__next._*.txt` (e.g. `__next._tree.txt`,
 * `__next._head.txt`, `__next._full.txt`, `__next._index.txt`).
 *
 * Side-effect: client-side `<Link>` prefetch becomes a no-op (browser would
 * 404 trying to fetch these). All `<Link>` usages in this codebase already
 * import from `@/components/link` which defaults `prefetch={false}`.
 */

import { readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const ROOT = "out";

// Match every Next.js 16 App Router RSC payload variant:
//   __next._*.txt        — server-side tree/head/full/index payloads
//   __next.!*.txt        — route-key-encoded prefetch payloads (incl. nested
//                          `__next.!base64.$dyn.txt` and `*.__PAGE__.txt`)
//   index.txt            — per-route plain RSC index file
const PATTERNS = [/^__next\..+\.txt$/, /^index\.txt$/];

let deleted = 0;
let scanned = 0;

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fp = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fp);
    } else if (entry.isFile()) {
      scanned++;
      if (PATTERNS.some((p) => p.test(entry.name))) {
        unlinkSync(fp);
        deleted++;
      }
    }
  }
}

walk(ROOT);
console.log(`[postbuild] strip-rsc-payloads: removed ${deleted} of ${scanned} files`);
