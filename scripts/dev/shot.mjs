#!/usr/bin/env node
/**
 * Headless screenshots + a few render facts, for comparing the museum
 * against the original captures or checking a deploy.
 *
 *   node scripts/dev/shot.mjs <base-url> <out-dir> "<era>|<path>|<name>" ...
 *
 *   node scripts/dev/shot.mjs http://localhost:3000 /tmp/shots \
 *     "2014|/|home-2014" "2003|/UoBoard/|board-2003"
 *
 * Each spec sets localStorage["forg.era"] before the page loads, so the
 * FOUC script picks that era. Output: <out-dir>/<name>.png at 1280×900 and
 * one line of facts (era applied, CSS rule count, hydration, image count,
 * broken images, console errors).
 *
 * Needs a Chrome/Chromium binary. Set CHROME_PATH, or it tries the usual
 * places for macOS and Linux. puppeteer-core is a devDependency (it was
 * already in the lockfile through size-limit's runner).
 *
 * The dev server keeps an HMR socket open, so `networkidle0` never fires
 * there; SHOT_WAIT=load (the default) plus SHOT_SETTLE ms is used instead.
 */

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { default: puppeteer } = await import(require.resolve("puppeteer-core"));

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
const executablePath = CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error("[shot] no Chrome found; set CHROME_PATH");
  process.exit(2);
}

const [base, outDir, ...specs] = process.argv.slice(2);
if (!base || !outDir || specs.length === 0) {
  console.error('usage: shot.mjs <base-url> <out-dir> "<era>|<path>|<name>" ...');
  process.exit(2);
}
await mkdir(outDir, { recursive: true });

const waitUntil = process.env.SHOT_WAIT || "load";
const settleMs = Number(process.env.SHOT_SETTLE || 2500);

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-first-run", "--no-default-browser-check", "--no-sandbox"],
});
try {
  for (const spec of specs) {
    const [era, path, name] = spec.split("|");
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 120)));
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 120)));
    if (era) {
      await page.evaluateOnNewDocument((e) => {
        try {
          localStorage.setItem("forg.era", e);
        } catch {}
      }, era);
    }
    const res = await page.goto(base + path, { waitUntil, timeout: 120000 });
    await new Promise((r) => setTimeout(r, settleMs));
    const facts = await page.evaluate(() => ({
      era: document.documentElement.dataset.era,
      css: [...document.styleSheets].reduce((n, s) => {
        try {
          return n + s.cssRules.length;
        } catch {
          return n;
        }
      }, 0),
      hydrated: typeof window.next === "object",
      imgs: document.images.length,
      broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
      title: document.title.slice(0, 40),
    }));
    await page.screenshot({ path: `${outDir}/${name}.png` });
    console.log(
      `${name}: status=${res?.status()} ${JSON.stringify(facts)} errors=${errors.length}${errors[0] ? " " + errors[0] : ""}`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
