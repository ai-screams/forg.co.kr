#!/usr/bin/env node
/**
 * Writes `out/_redirects`: each old forg.co.kr guide page's address (for
 * example `/skill/attack.htm`) to its museum copy `/site/{stem}/`, with a
 * permanent redirect (ADR-0022). Cloudflare Pages reads the file; static
 * redirects, so no Function runs.
 *
 * Left out: an address with a query string (`_redirects` cannot match one),
 * and one the museum serves itself (the front page `/`). Pages allows 2,000
 * static redirects; the build stops above that.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PAGES = "src/content/pages";
const OUT = "out";
const LIMIT = 2000;

/** Whether the export already serves `path`. */
function served(out, path) {
  const rel = path.replace(/^\//, "");
  return path.endsWith("/")
    ? existsSync(join(out, rel, "index.html"))
    : existsSync(join(out, rel)) || existsSync(join(out, rel, "index.html"));
}

/** `_redirects` lines for the pages `{ stem, originalPath }`. */
export function redirectLines(pages, isServed) {
  const seen = new Set();
  const lines = [];
  for (const { stem, originalPath: from } of pages) {
    if (from.includes("?") || isServed(from) || seen.has(from)) continue;
    seen.add(from);
    lines.push(`${from} /site/${stem}/ 301`);
  }
  return lines.sort();
}

function readPages(dir) {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const lines = redirectLines(readPages(PAGES), (p) => served(OUT, p));
  if (lines.length > LIMIT) {
    console.error(`[postbuild] old-page-redirects: ${lines.length} lines, Pages allows ${LIMIT}`);
    process.exit(1);
  }
  writeFileSync(join(OUT, "_redirects"), `${lines.join("\n")}\n`);
  console.log(`[postbuild] old-page-redirects: ${lines.length} old addresses → /site/`);
}
