#!/usr/bin/env node
/**
 * Computed-style snapshots of every element, to show a CSS change changed
 * nothing it should not. Dump a build before and after the change, then
 * compare:
 *
 *   python3 -m http.server 8789 -d out          # the build under test
 *   node scripts/dev/style-snapshot.mjs dump 8789 /tmp/before
 *   … change, pnpm build, serve again …
 *   node scripts/dev/style-snapshot.mjs dump 8789 /tmp/after
 *   node scripts/dev/style-snapshot.mjs compare /tmp/before /tmp/after
 *   node scripts/dev/style-snapshot.mjs detail 8789 2014 800 /Notice/ 275 278
 *
 * A dump covers PAGES in each era at 1280, 375, 799 and 800px (the frame
 * breakpoint and the pixel below it; `--widths` overrides). Each element is
 * recorded as its tag and a hash of its computed style; `compare` lists
 * the page views whose elements differ, `detail` prints an element's full
 * style. Exit 1 from `compare` when anything differs.
 *
 * What the hash leaves out, so a build compared with itself is identical:
 * - transitions and animations, stopped before measuring (the body fades
 *   its colour);
 * - the resolved sizes width, height, inline-size, block-size,
 *   transform-origin and perspective-origin, which follow lazy images
 *   loading — so a CSS change that only resizes an element is NOT caught
 *   here; compare screenshots as well;
 * - custom properties, which render only through the properties that use
 *   them (and a new token on :root would mark every element).
 * Property names are sorted: Chrome lists custom properties in no fixed
 * order. `::before`/`::after` with content are hashed the same way.
 *
 * A dump writes `.complete` last; `compare` refuses a dump without it, and a
 * page view missing from either side counts as a difference.
 *
 * Needs a Chrome/Chromium binary (CHROME_PATH, or the usual places).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { default: puppeteer } = await import(require.resolve("puppeteer-core"));

const PAGES = [
  "/",
  "/Q_A/",
  "/Q_A/2663/",
  "/Notice/",
  "/Notice/139/",
  "/kr_free/95/",
  "/site/",
  "/Sell/",
  "/DF/",
  "/FunBoard/page/21/",
  "/bod_s_s/",
  "/UoBoard2/40006/",
  "/search/?q=%EC%9A%B8%ED%8B%B0%EB%A7%88",
];
const ERAS = ["2014", "2003", "2001"];
const DEFAULT_WIDTHS = [1280, 375, 799, 800];

const CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
].filter(Boolean);

function launch() {
  const executablePath = CANDIDATES.find((p) => existsSync(p));
  if (!executablePath) {
    console.error("[style-snapshot] no Chrome found; set CHROME_PATH");
    process.exit(2);
  }
  return puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
}

/** Runs in the page: tag and style hash of every element. */
function collect() {
  const skip = new Set([
    "width",
    "height",
    "inline-size",
    "block-size",
    "transform-origin",
    "perspective-origin",
  ]);
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    const text = (cs) => {
      const names = [];
      for (let i = 0; i < cs.length; i++)
        if (!skip.has(cs[i]) && !cs[i].startsWith("--")) names.push(cs[i]);
      names.sort();
      let t = "";
      for (const p of names) t += `${p}:${cs.getPropertyValue(p)};`;
      return t;
    };
    let s = text(getComputedStyle(el));
    for (const pseudo of ["::before", "::after"]) {
      const ps = getComputedStyle(el, pseudo);
      if (ps.content && ps.content !== "none" && ps.content !== "normal") s += pseudo + text(ps);
    }
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    out.push([el.tagName, h]);
  }
  return out;
}

/** Runs in the page: full computed style of the elements at these indices. */
function details(indices) {
  const all = document.querySelectorAll("*");
  return indices.map((i) => {
    const el = all[i];
    const cs = getComputedStyle(el);
    const style = {};
    for (let k = 0; k < cs.length; k++) style[cs[k]] = cs.getPropertyValue(cs[k]);
    return { i, tag: el.tagName, class: el.getAttribute("class"), style };
  });
}

async function open(browser, port, era, width, path) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900 });
  await page.evaluateOnNewDocument((e) => localStorage.setItem("forg.era", e), era);
  await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: "networkidle0" });
  await page.addStyleTag({
    content: "*,*::before,*::after{transition:none!important;animation:none!important}",
  });
  await new Promise((r) => setTimeout(r, 200));
  return page;
}

const key = (era, width, path) => `${era}-${width}-${path.replace(/[^a-z0-9]/gi, "_")}`;
const [mode, ...rest] = process.argv.slice(2);

if (mode === "dump") {
  const [port, dir] = rest;
  const flag = rest.indexOf("--widths");
  const widths = flag >= 0 ? (rest[flag + 1] ?? "").split(",").map(Number) : DEFAULT_WIDTHS;
  if (!port || !dir || !widths.every((w) => Number.isInteger(w) && w > 0)) {
    console.error("usage: style-snapshot.mjs dump <port> <dir> [--widths 1280,375]");
    process.exit(2);
  }
  mkdirSync(dir, { recursive: true });
  rmSync(`${dir}/.complete`, { force: true });
  const browser = await launch();
  try {
    for (const era of ERAS) {
      for (const width of widths) {
        for (const path of PAGES) {
          const page = await open(browser, port, era, width, path);
          writeFileSync(
            `${dir}/${key(era, width, path)}.json`,
            JSON.stringify(await page.evaluate(collect)),
          );
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  writeFileSync(`${dir}/.complete`, "");
  console.log(`[style-snapshot] ${readdirSync(dir).length - 1} page views in ${dir}`);
} else if (mode === "compare") {
  const [a, b] = rest;
  for (const dir of [a, b]) {
    if (!dir || !existsSync(`${dir}/.complete`)) {
      console.error(`[style-snapshot] ${dir} is not a complete dump`);
      process.exit(2);
    }
  }
  const views = [...new Set([...readdirSync(a), ...readdirSync(b)])]
    .filter((f) => f.endsWith(".json"))
    .sort();
  let same = 0;
  let elements = 0;
  for (const file of views) {
    const missing = [a, b].find((dir) => !existsSync(`${dir}/${file}`));
    if (missing) {
      console.log(`${file}: missing from ${missing}`);
      continue;
    }
    const A = JSON.parse(readFileSync(`${a}/${file}`, "utf8"));
    const B = JSON.parse(readFileSync(`${b}/${file}`, "utf8"));
    elements += A.length;
    if (A.length !== B.length) {
      console.log(`${file}: element count ${A.length} → ${B.length}`);
      continue;
    }
    const differ = [];
    for (let i = 0; i < A.length; i++)
      if (A[i][0] !== B[i][0] || A[i][1] !== B[i][1]) differ.push(i);
    if (differ.length === 0) same++;
    else
      console.log(
        `${file}: ${differ.length} elements differ (first ${differ.slice(0, 8).join(" ")})`,
      );
  }
  console.log(
    `[style-snapshot] ${views.length} page views, ${elements} elements; identical ${same}`,
  );
  process.exit(same === views.length ? 0 : 1);
} else if (mode === "detail") {
  const [port, era, width, path, ...indices] = rest;
  const browser = await launch();
  try {
    const page = await open(browser, port, era, Number(width), path);
    console.log(JSON.stringify(await page.evaluate(details, indices.map(Number)), null, 1));
  } finally {
    await browser.close();
  }
} else {
  console.error(
    "usage: style-snapshot.mjs dump <port> <dir> [--widths 1280,375]\n" +
      "       style-snapshot.mjs compare <dir-before> <dir-after>\n" +
      "       style-snapshot.mjs detail <port> <era> <width> <path> <index>...",
  );
  process.exit(2);
}
