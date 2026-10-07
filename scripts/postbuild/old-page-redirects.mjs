#!/usr/bin/env node
/**
 * Writes `out/_redirects`: each old forg.co.kr guide page's address (for
 * example `/skill/attack.htm`) to its museum copy `/site/{stem}/`, with a
 * permanent redirect (ADR-0022). Cloudflare Pages reads the file; static
 * redirects, so no Function runs.
 *
 * - A page kept from the `hosting27.interpia98.net/~forg/` mirror shares
 *   forg's paths: it answers at `/~forg/X` and at `/X`.
 * - A folder answers with and without its slash, as the old server did.
 * - Only pages: an address with a query (`_redirects` cannot match one), a
 *   file such as `.wma`, or one the museum serves itself (the front page `/`)
 *   gets no line.
 * - Pages applies no `_redirects` line to a path the Function serves, so the
 *   build stops on one; it also stops above Pages' 2,000 static redirects.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PAGES = "src/content/pages";
const OUT = "out";
const LIMIT = 2000;

const MIRROR = /^[a-z0-9.-]+\/~forg(\/.*)$/i;
const PAGE = /(?:\.html?|\/)$/i;

/** Whether the export already serves `path`. */
function served(out, path) {
  const rel = path.replace(/^\//, "");
  return path.endsWith("/")
    ? existsSync(join(out, rel, "index.html"))
    : existsSync(join(out, rel)) || existsSync(join(out, rel, "index.html"));
}

/** The addresses a page answered at on forg.co.kr. */
export function sourcesOf(originalPath) {
  if (originalPath.includes("?")) return [];
  const mirror = MIRROR.exec(originalPath);
  const paths = mirror
    ? [`/~forg${mirror[1]}`, mirror[1]]
    : originalPath.startsWith("/")
      ? [originalPath]
      : [];
  return paths
    .filter((p) => PAGE.test(p))
    .flatMap((p) => (p.endsWith("/") && p !== "/" ? [p, p.slice(0, -1)] : [p]));
}

/** `_redirects` lines for the pages `{ stem, originalPath }`. */
export function redirectLines(pages, isServed, functionPaths = []) {
  const seen = new Set();
  const lines = [];
  for (const { stem, originalPath } of pages) {
    for (const from of sourcesOf(originalPath)) {
      if (isServed(from) || seen.has(from)) continue;
      if (functionPaths.includes(from)) {
        throw new Error(
          `${from} is the Function's (public/_routes.json): no redirect applies there`,
        );
      }
      seen.add(from);
      lines.push(`${from} /site/${stem}/ 301`);
    }
  }
  return lines.sort();
}

function readPages(dir) {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

if (import.meta.main) {
  const routes = JSON.parse(readFileSync(join(OUT, "_routes.json"), "utf8"));
  const lines = redirectLines(readPages(PAGES), (p) => served(OUT, p), routes.include);
  if (lines.length > LIMIT) {
    console.error(`[postbuild] old-page-redirects: ${lines.length} lines, Pages allows ${LIMIT}`);
    process.exit(1);
  }
  writeFileSync(join(OUT, "_redirects"), `${lines.join("\n")}\n`);
  console.log(`[postbuild] old-page-redirects: ${lines.length} old addresses → /site/`);
}
