#!/usr/bin/env node
/**
 * The 2026 era's fonts (ADR-0023 §6), fetched from Google Fonts once and
 * served by the museum: IBM Plex Sans KR 400, 500 and 600 and Do Hyeon 400,
 * every unicode-range slice Google's CSS lists, plus Forg Digits, the cut of
 * D2Coding `scripts/dev/subset-digits-font.sh` makes. Run from the repository
 * root, after that script:
 *
 *   node scripts/dev/fetch-fonts-2026.mjs
 *
 * Everything is fetched and renamed in a temporary folder first; only when
 * that has all worked does it replace what is in `public/fonts/2026/`: the
 * slices, named by their
 * family, weight, order and a hash of their bytes; `2026.css`, their
 * `@font-face` rules with relative URLs and `font-display: swap`; and
 * `.manifest.json`, each file's source URL and SHA-256 (`drop-image-sidecars`
 * keeps it off the site). The era script links `2026.css` only while the era
 * is 2026 (`src/app/_scripts/era.js`).
 *
 * IBM Plex reserves the name "Plex" (OFL 1.1, Reserved Font Name). Google's
 * slices are subsets, which the OFL FAQ counts as Modified Versions (2.6), so
 * they are served as "Forg Sans KR": renamed in the CSS and in each file's
 * name table (`rename-font.py`, through uv). Do Hyeon reserves no name.
 *
 * Needs network access to fonts.googleapis.com and fonts.gstatic.com, and uv.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = "public/fonts/2026";
const CSS_URL =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600&family=Do+Hyeon&display=swap";
/**
 * Google answers a current browser with WOFF2 slices. It sends Windows and
 * Linux hinted files and macOS unhinted ones, the same glyphs in 27% fewer
 * bytes for Plex and 41% fewer for Do Hyeon (2026-10-20: 820,692 against
 * 1,124,248 bytes for Plex 400); the museum serves one set to everyone and
 * takes the smaller.
 */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const DIGITS = "forg-digits.woff2";
const DIGITS_RANGE =
  "U+0020-007E, U+00B7, U+2013, U+2014, U+2026, U+2190-2193, U+2248, U+2264, U+2265";

/** Families as Google names them → as the museum serves them. */
const RENAMED = { "IBM Plex Sans KR": { name: "Forg Sans KR", reserved: "Plex" } };

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const slug = (family) => family.toLowerCase().replace(/\s+/g, "-");

async function fetchOk(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res;
}

if (!existsSync(join(OUT, DIGITS))) {
  console.error(`[fonts] ${OUT}/${DIGITS} is missing: run scripts/dev/subset-digits-font.sh first`);
  process.exit(2);
}

const css = await (await fetchOk(CSS_URL, { headers: { "User-Agent": USER_AGENT } })).text();
const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => {
  const body = m[1] ?? "";
  const get = (prop) => new RegExp(`${prop}:\\s*([^;]+);`).exec(body)?.[1]?.trim() ?? "";
  return {
    family: get("font-family").replace(/^'|'$/g, ""),
    weight: get("font-weight"),
    style: get("font-style"),
    range: get("unicode-range"),
    url: /url\(([^)]+)\)/.exec(body)?.[1] ?? "",
  };
});
if (faces.length === 0 || faces.some((f) => !f.family || !f.url.endsWith(".woff2") || !f.range)) {
  console.error("[fonts] Google's CSS did not list WOFF2 slices with a unicode-range");
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "fonts-2026-"));
process.on("exit", () => rmSync(work, { recursive: true, force: true }));

const order = new Map();
const files = [];
for (const face of faces) {
  const key = `${face.family} ${face.weight}`;
  const n = order.get(key) ?? 0;
  order.set(key, n + 1);
  const bytes = Buffer.from(await (await fetchOk(face.url)).arrayBuffer());
  const temp = join(work, `${slug(face.family)}-${face.weight}-${n}.woff2`);
  writeFileSync(temp, bytes);
  files.push({ ...face, n, temp, sourceSha256: sha256(bytes) });
}

for (const [family, { name, reserved }] of Object.entries(RENAMED)) {
  const temps = files.filter((f) => f.family === family).map((f) => f.temp);
  execFileSync(
    "uv",
    [
      ...["run", "--quiet", "--with", "fonttools", "--with", "brotli", "python"],
      ...["scripts/dev/rename-font.py", "--from", family, "--to", name, "--reserved", reserved],
      ...temps,
    ],
    { stdio: "inherit" },
  );
}

const rules = [];
const manifest = [];
for (const f of files) {
  const family = RENAMED[f.family]?.name ?? f.family;
  const bytes = readFileSync(f.temp);
  const hash = sha256(bytes);
  const file = `${slug(family)}-${f.weight}-${f.n}-${hash.slice(0, 8)}.woff2`;
  f.file = file;
  rules.push(
    `@font-face{font-family:"${family}";font-style:${f.style};font-weight:${f.weight};font-display:swap;` +
      `src:url(${file}) format("woff2");unicode-range:${f.range}}`,
  );
  manifest.push({
    file,
    family,
    weight: Number(f.weight),
    source: f.url,
    sourceFamily: f.family,
    sourceSha256: f.sourceSha256,
    sha256: hash,
    bytes: bytes.length,
  });
}

const digits = readFileSync(join(OUT, DIGITS));
rules.push(
  `@font-face{font-family:"Forg Digits";font-style:normal;font-weight:400;font-display:swap;` +
    `src:url(${DIGITS}?v=${sha256(digits).slice(0, 10)}) format("woff2");unicode-range:${DIGITS_RANGE}}`,
);

// Everything is in hand: swap the old slices for the new ones.
mkdirSync(OUT, { recursive: true });
for (const name of readdirSync(OUT)) {
  if (name.endsWith(".woff2") && name !== DIGITS) rmSync(join(OUT, name));
}
for (const f of files) copyFileSync(f.temp, join(OUT, f.file));
writeFileSync(
  join(OUT, "2026.css"),
  "/* The 2026 era's fonts: scripts/dev/fetch-fonts-2026.mjs wrote this. Licences: /fonts/OFL.txt */\n" +
    rules.join("\n") +
    "\n",
);
writeFileSync(
  join(OUT, ".manifest.json"),
  JSON.stringify(
    {
      fetched: new Date().toISOString(),
      css: CSS_URL,
      userAgent: USER_AGENT,
      renamed: RENAMED,
      digits: { file: DIGITS, sha256: sha256(digits), script: "scripts/dev/subset-digits-font.sh" },
      files: manifest,
    },
    null,
    2,
  ) + "\n",
);
const total = manifest.reduce((n, f) => n + f.bytes, 0) + digits.length;
console.log(`[fonts] ${manifest.length + 1} fonts, ${total} bytes, in ${OUT}`);
