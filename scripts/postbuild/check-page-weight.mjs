#!/usr/bin/env node
/**
 * After every build: what the 2026 era (ADR-0023) adds to the pages, held to
 * limits. Every page carries the 2026 bar and 2026's notes, hidden in the
 * other eras, so their bytes are counted where they would otherwise grow
 * unseen. Cloudflare Pages runs `pnpm build`, so this stops a deploy; CI
 * does not build (`.claude/rules/stack-and-tooling.md`).
 *
 * Fails the build (exit 1) when, on any page of `out/`:
 *  - the 2026 bar (`data-era-frame="2026"`) is over FRAME_LIMIT bytes;
 *  - the rest of the page's 2026 markup (its outermost `.era-2026-only`
 *    elements, the bar's wrapper left out) is over its kind's limit
 *    (KIND_LIMITS: a post, a list, the front page, any other page);
 * or when the deploy holds more than FILE_LIMIT files: all of `out/` but
 * `out/img/posts/`, which R2 serves.
 *
 * Only warns when a sample page (SAMPLES) has grown past its limit: a
 * content change moves those as much as markup does, and a warning there
 * should not stop a deploy. Prints its table either way, for the Pages log.
 *
 * An element's bytes run from its start tag to the end tag that closes it,
 * found by the depth of its own tag name.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

const OUT = "out";
export const FRAME_LIMIT = 3072;
export const KIND_LIMITS = { post: 1024, list: 2048, home: 10240, other: 512 };
export const FILE_LIMIT = 19500;

/**
 * The sample pages' bytes on main c789b673a (built 2026-10-20), before the
 * 2026 era: content that does not change. A page warns past (base + its
 * share of 2026) × 1.03, in KiB rounded up; the share is FRAME_LIMIT, its
 * kind's limit and COMMON. To move a limit, build main again and replace the
 * base with its bytes.
 */
const SAMPLES = {
  "/": 118965,
  "/UoBoard2/": 165822,
  "/Q_A/page/2/": 165334,
  "/UoBoard/29831/": 50227,
  "/Events/160/": 47765,
  "/MoNgBaT/": 37692,
  "/site/": 210726,
};
/** Pages that came with 2026, by their bytes when they came (2026-10-20); they warn past × 1.03. */
const NEW_PAGES = { "/boards/": 59547 };
/**
 * What every page gains besides the bar and the notes: the fourth era
 * button, the buttons folded below 360px, the search magnifier, the fonts'
 * address in the era script, and 2026's class hooks (a list's rows carry
 * `forg-num` twice each).
 */
const COMMON = { post: 2048, list: 3072, home: 2048, other: 2048 };

const VOID = new Set([
  "area",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "wbr",
]);

/** The element starting at `at`: its end as a string index, and its bytes. */
export function outerElement(html, at) {
  const name = /^<([a-zA-Z][\w-]*)/.exec(html.slice(at, at + 64))?.[1]?.toLowerCase();
  if (!name) throw new Error(`no start tag at ${at}`);
  const tag = new RegExp(`<(/?)${name}(?=[\\s/>])[^>]*>`, "gi");
  tag.lastIndex = at;
  let depth = 0;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    if (m[1]) depth--;
    else if (!VOID.has(name)) depth++;
    if (depth === 0)
      return { end: tag.lastIndex, bytes: Buffer.byteLength(html.slice(at, tag.lastIndex)) };
  }
  throw new Error(`<${name}> at ${at} is not closed`);
}

/** The 2026 bar's bytes (0 without one), and those of the page's other 2026 markup. */
export function era2026Bytes(html) {
  const marker = html.indexOf('data-era-frame="2026"');
  const bar = marker < 0 ? null : outerElement(html, html.lastIndexOf("<", marker));
  const barStart = marker < 0 ? -1 : html.lastIndexOf("<", marker);
  let extras = 0;
  let inside = -1;
  for (const m of html.matchAll(
    /<[a-zA-Z][\w-]*\s[^>]*class="(?:[^"]* )?era-2026-only(?: [^"]*)?"/g,
  )) {
    if (m.index < inside) continue;
    const el = outerElement(html, m.index);
    inside = el.end;
    if (bar && m.index < barStart && el.end >= bar.end) continue;
    extras += el.bytes;
  }
  return { frame: bar?.bytes ?? 0, extras };
}

/** What a page is, for its limit: the front page, a post, a list or another. */
export function pageKind(path, html) {
  if (path === "/") return "home";
  if (html.includes('class="forg-post ')) return "post";
  if (html.includes('class="forg-narrow-list ')) return "list";
  return "other";
}

/** Over a limit: one byte past it, not at it. */
export function over(value, limit) {
  return value > limit;
}

/** The files a deploy of `dir` holds: all but those under `img/posts/`. */
export function deployFiles(dir) {
  const posts = join(dir, "img", "posts");
  let n = 0;
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    const where = join(entry.parentPath, entry.name);
    if (entry.isFile() && where !== posts && !where.startsWith(posts + sep)) n++;
  }
  return n;
}

/** Every page in `dir` (each `index.html`, and `404.html`), by its address. */
export function pages(dir) {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f === "404.html" || f === "index.html" || f.endsWith(`${sep}index.html`))
    .map((f) => {
      const folders = f.split(sep).slice(0, -1);
      const path = f === "404.html" ? "/404" : folders.length ? `/${folders.join("/")}/` : "/";
      return { file: join(dir, f), path };
    });
}

const KiB = (n) => Math.ceil(n / 1024);
const n = (x) => x.toLocaleString("en-US");

if (import.meta.main) {
  const failures = [];
  const warnings = [];
  const largest = {};
  const samples = [];
  let checked = 0;
  for (const { file, path } of pages(OUT)) {
    const html = readFileSync(file, "utf8");
    const kind = pageKind(path, html);
    const { frame, extras } = era2026Bytes(html);
    checked++;
    if (over(frame, FRAME_LIMIT))
      failures.push(`${path}: the 2026 bar is ${n(frame)} bytes, over ${n(FRAME_LIMIT)}`);
    if (over(extras, KIND_LIMITS[kind]))
      failures.push(
        `${path}: 2026 markup ${n(extras)} bytes, over the ${kind} limit ${n(KIND_LIMITS[kind])}`,
      );
    if (!largest[kind] || extras > largest[kind].extras) largest[kind] = { extras, path };
    if (path in SAMPLES || path in NEW_PAGES) {
      const bytes = Buffer.byteLength(html);
      const limit = KiB(
        path in SAMPLES
          ? (SAMPLES[path] + FRAME_LIMIT + KIND_LIMITS[kind] + COMMON[kind]) * 1.03
          : NEW_PAGES[path] * 1.03,
      );
      if (over(bytes, limit * 1024))
        warnings.push(`${path}: ${n(bytes)} bytes, past its ${limit} KiB`);
      samples.push({ path, bytes, limit, frame, extras, kind });
    }
  }
  const files = deployFiles(OUT);
  if (over(files, FILE_LIMIT))
    failures.push(`the deploy holds ${n(files)} files, over ${n(FILE_LIMIT)}`);

  const rows = samples
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(
      (s) =>
        `  ${s.path.padEnd(17)} ${n(s.bytes).padStart(8)} [${String(s.limit).padStart(3)} KiB]` +
        `  bar ${n(s.frame).padStart(5)} [${n(FRAME_LIMIT)}]  2026 ${n(s.extras).padStart(6)} [${n(KIND_LIMITS[s.kind])} ${s.kind}]`,
    );
  console.log(
    [
      "[postbuild] page-weight: sample pages, their 2026 bar and other 2026 markup, limits in brackets",
      ...rows,
      `  every page (${n(checked)}): most 2026 markup by kind — ${Object.entries(largest)
        .map(([k, v]) => `${k} ${n(v.extras)} (${v.path})`)
        .join(", ")}`,
      `  deploy files: ${n(files)} [${n(FILE_LIMIT)}]`,
      ...warnings.map((w) => `  warning: ${w}`),
      ...failures.map((f) => `  FAIL: ${f}`),
    ].join("\n"),
  );
  if (failures.length > 0) process.exit(1);
}
