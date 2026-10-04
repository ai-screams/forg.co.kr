#!/usr/bin/env node
/**
 * Remove the image sidecars (`.manifest.json`) from `out/`.
 *
 * The ETL keeps a `.manifest.json` beside each folder of recovered images
 * in `public/img/` (posts, chrome, the emoticon store): where each file came
 * from and when Wayback captured it. The scripts that write and read them
 * expect them next to the images, so they stay in `public/`, but Next copies
 * all of `public/` into `out/`, which put 1,222 of them on the live site and
 * against Cloudflare Pages' 20,000-file cap. Nothing on the site reads them.
 * Only files named exactly `.manifest.json` under `out/` are removed;
 * `public/` is never touched.
 */

import { readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const ROOT = "out";
const NAME = ".manifest.json";

let deleted = 0;

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fp = join(dir, entry.name);
    if (entry.isDirectory()) walk(fp);
    else if (entry.isFile() && entry.name === NAME) {
      unlinkSync(fp);
      deleted++;
    }
  }
}

walk(ROOT);
console.log(`[postbuild] drop-image-sidecars: removed ${deleted} ${NAME} files`);
