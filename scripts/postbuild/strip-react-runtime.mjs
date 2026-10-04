#!/usr/bin/env node
/**
 * Strip React's runtime and its inline RSC payload from every exported page
 * except the search page.
 *
 * Next.js 16 writes into each page the React Server Components payload that
 * React hydrates from (`self.__next_f.push(…)`, about 60% of a post page)
 * and the scripts that hydrate it; no option turns this off. Nothing on
 * these pages needs hydrating: the era toggle and the daemon names are plain
 * scripts (`public/scripts/`), links are plain `<a>`, and there are no
 * payloads for client navigation (`strip-rsc-payloads.mjs`). The search
 * page, the one client component (`src/client-components.test.ts`), keeps
 * them. The `/site/` documents are route-handler output and carry none.
 *
 * Removed: the payload scripts, every `<script src="/_next/…">` and the
 * `<link rel="preload" as="script">`. The stylesheet, the icon, the layout's
 * inline era script and the markup stay. The patterns follow Next 16.2's
 * output, so the step fails when a page that should carry the payload does
 * not, or when anything of it is left after stripping: check them on an
 * upgrade.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "out";
const KEEP = new Set(["search/index.html"]);
const PAYLOAD =
  /<script>(?:\(self\.__next_f=self\.__next_f\|\|\[\]\)\.push|self\.__next_f\.push)\([\s\S]*?<\/script>/g;
const RUNTIME = /<script src="\/_next\/[^"]*"[^>]*><\/script>/g;
const PRELOAD = /<link rel="preload" as="script"[^>]*\/>/g;
const LEFT = /__next_f|<script[^>]*src="\/_next\/|<link[^>]*as="script"/;

/** A `/site/` document: written by the route handler, never by React. */
const isSiteDocument = (rel) => rel.startsWith("site/") && rel !== "site/index.html";

let stripped = 0;
let before = 0;
let after = 0;
const problems = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fp = join(dir, entry.name);
    if (entry.isDirectory()) walk(fp);
    else if (entry.isFile() && entry.name.endsWith(".html")) visit(fp);
  }
}

function visit(fp) {
  const rel = relative(ROOT, fp);
  if (KEEP.has(rel) || isSiteDocument(rel)) return;
  const html = readFileSync(fp, "utf8");
  if (!html.includes("self.__next_f")) {
    problems.push(`${rel}: no RSC payload to strip`);
    return;
  }
  const out = html.replace(PAYLOAD, "").replace(RUNTIME, "").replace(PRELOAD, "");
  if (LEFT.test(out)) {
    problems.push(`${rel}: React runtime left after stripping`);
    return;
  }
  writeFileSync(fp, out);
  stripped++;
  before += Buffer.byteLength(html);
  after += Buffer.byteLength(out);
}

walk(ROOT);
if (problems.length > 0) {
  console.error(`[postbuild] strip-react-runtime: ${problems.length} page(s) not as expected`);
  for (const p of problems.slice(0, 10)) console.error(`  ${p}`);
  process.exit(1);
}
console.log(
  `[postbuild] strip-react-runtime: ${stripped} pages, ` +
    `${(before / 1e6).toFixed(0)} MB → ${(after / 1e6).toFixed(0)} MB`,
);
