#!/usr/bin/env node
/**
 * Plans how old forg.co.kr addresses reach the museum (ADR-0022) and writes
 * the three files Cloudflare Pages reads:
 *
 * - `out/_routes.json`: the old site's folders that no museum path uses
 *   (`/skill/*`, `/_zb/*`, `/~forg/*`, …) go to the Function
 *   (`functions/[[path]].ts`), which resolves pages, posts and pictures;
 * - `out/_old-images.json`: for those folders, each old picture's address →
 *   its copy (post pictures on the image host, chrome and emoticons here);
 * - `out/_redirects`: static 301s for what lies outside those folders — the
 *   folders a museum board shares (`/Diablo/`, `/screen/`) and the site's
 *   root — guide pages to `/site/{stem}/`, pictures to their copies.
 *
 * Only pages and pictures forg itself served: an address with a query cannot
 * be a `_redirects` line (the Function reads those), and a page is `.htm`,
 * `.html` or a folder (with and without its slash). Stops above Pages' limits:
 * 100 routes, 2,000 static redirects.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const PAGES = "src/content/pages";
const IMAGES = [
  ["public/img/posts", "posts"],
  ["public/img/chrome", "chrome"],
  ["public/img/emoticon", "emoticon"],
];
const OUT = "out";
const ROUTE_LIMIT = 100;
const REDIRECT_LIMIT = 2000;

const FORG_HOSTS = new Set(["forg.co.kr", "www.forg.co.kr", "forg.uospace.net", "forg.dotple.com"]);
const MIRROR_HOST = "hosting27.interpia98.net";
/** The board scripts' folders, routed even when no page or picture names them. */
const SCRIPT_FOLDERS = ["_zb", "zboard", "zb", "bbs"];
const PAGE = /(?:\.html?|\/)$/i;

/** `/~forg/X` was the hosting27 mirror of `/X`. */
function unmirror(path) {
  return path.replace(/^\/~forg(?=\/)/, "");
}

/** As `decoded` in src/lib/old-urls.ts: the Function looks a request up by the same key. */
function decoded(path) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path.replace(/%[0-9a-f]{2}/gi, (e) => e.toUpperCase());
  }
}

/** The first folder of a path, or "" for a file at the root. */
export function folderOf(path) {
  const parts = path.split("/").filter(Boolean);
  return path.endsWith("/") || parts.length > 1 ? (parts[0] ?? "") : "";
}

/** A guide page's old addresses on forg's own paths. */
export function sourcesOf(originalPath) {
  if (originalPath.includes("?")) return [];
  const mirror = /^[a-z0-9.-]+(\/~forg\/.*)$/i.exec(originalPath);
  const path = mirror ? unmirror(mirror[1]) : originalPath.startsWith("/") ? originalPath : null;
  if (!path || !PAGE.test(path)) return [];
  return path.endsWith("/") && path !== "/" ? [path, path.slice(0, -1)] : [path];
}

/** An old picture's address on forg's own paths, or null for another site's. */
export function pictureSource(originalUrl) {
  let url;
  try {
    url = new URL(originalUrl);
  } catch {
    return null;
  }
  if (url.search) return null;
  if (FORG_HOSTS.has(url.hostname)) return decoded(unmirror(url.pathname));
  if (url.hostname === MIRROR_HOST && url.pathname.startsWith("/~forg/")) {
    return decoded(unmirror(url.pathname));
  }
  return null;
}

/**
 * Where forg served a recovered picture: the manifest's `originalUrl`, or its
 * `originalPath` — the chrome probes (`recover-chrome.py`, `era-2001-chrome.py`)
 * record only that, server-relative on forg.co.kr or a full mirror address.
 */
export function pictureAddress(entry) {
  if (entry.originalUrl) return entry.originalUrl;
  const path = entry.originalPath ?? "";
  return path.startsWith("/") ? `http://forg.co.kr${path}` : path;
}

/** A guide page's path on forg's own paths with its query dropped, or null for another host's. */
function pathOf(originalPath) {
  const bare = originalPath.split("?")[0] ?? "";
  const mirror = /^[a-z0-9.-]+(\/~forg\/.*)$/i.exec(bare);
  return mirror?.[1] ? unmirror(mirror[1]) : bare.startsWith("/") ? bare : null;
}

/**
 * Stops a production build without the image host: every post picture and
 * every old picture's redirect would point at `/img/posts/…`, which is not
 * deployed (the bytes are on R2), and the 301s would be cached.
 */
export function imageHostProblem({ imgBase, branch }) {
  return !imgBase && branch === "main"
    ? "NEXT_PUBLIC_IMG_BASE is empty on the production branch: post pictures and old picture redirects would point at /img/posts/, which is not deployed"
    : null;
}

/** A `_redirects` path: spaces and non-ASCII percent-encoded, the rest as it was. */
function encodePath(path) {
  return encodeURI(path);
}

/**
 * The plan: `pages` `{ stem, originalPath }`, `pictures` `{ source, target }`,
 * `museum` the names at the export's root, `isServed(path)`.
 */
export function planOldAddresses({ pages, pictures, museum, isServed }) {
  const folders = new Set(SCRIPT_FOLDERS);
  for (const p of pages) for (const s of sourcesOf(p.originalPath)) folders.add(folderOf(s));
  // A page with a query has no static line, so only the Function reaches it.
  for (const p of pages) {
    const path = p.originalPath.includes("?") ? pathOf(p.originalPath) : null;
    if (path) folders.add(folderOf(path));
  }
  for (const p of pictures) folders.add(folderOf(p.source));
  folders.delete("");
  const routed = [...folders].filter((f) => !museum.has(f)).sort();
  routed.push("~forg");
  const isRouted = (path) => routed.includes(folderOf(path));

  const lines = new Map();
  const add = (from, to) => {
    if (isRouted(from) || isServed(from) || lines.has(from)) return;
    lines.set(from, `${encodePath(from)} ${to} 301`);
  };
  for (const { stem, originalPath } of pages) {
    for (const from of sourcesOf(originalPath)) add(from, `/site/${stem}/`);
  }
  const imageMap = {};
  for (const { source, target } of pictures) {
    if (isRouted(source)) imageMap[source] ??= target;
    else add(source, target);
  }
  return {
    routes: routed.map((f) => `/${f}/*`),
    redirects: [...lines.keys()].sort().map((k) => lines.get(k)),
    imageMap,
  };
}

function readPages(dir) {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

/** Every recovered picture with forg's address and the copy the museum serves. */
function readPictures(imgBase) {
  const pictures = [];
  for (const [root, kind] of IMAGES) {
    const manifests = readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((f) => f.endsWith(".manifest.json"))
      .sort();
    for (const m of manifests) {
      const folder = relative(root, dirname(join(root, m)));
      for (const entry of JSON.parse(readFileSync(join(root, m), "utf8"))) {
        const source = pictureSource(pictureAddress(entry));
        if (!source) continue;
        const file = encodeURI([folder, entry.filename].filter(Boolean).join("/"));
        const target =
          kind === "posts"
            ? imgBase
              ? `${imgBase}/posts/${file}`
              : `/img/posts/${file}`
            : `/img/${kind}/${file}`;
        pictures.push({ source, target });
      }
    }
  }
  return pictures;
}

function served(out, path) {
  const rel = path.replace(/^\//, "");
  return path.endsWith("/")
    ? existsSync(join(out, rel, "index.html"))
    : existsSync(join(out, rel)) || existsSync(join(out, rel, "index.html"));
}

if (import.meta.main) {
  const imgBase = (process.env.NEXT_PUBLIC_IMG_BASE ?? "").trim().replace(/\/+$/, "");
  const problem = imageHostProblem({ imgBase, branch: process.env.CF_PAGES_BRANCH });
  if (problem) {
    console.error(`[postbuild] old-addresses: ${problem}`);
    process.exit(1);
  }
  const plan = planOldAddresses({
    pages: readPages(PAGES),
    pictures: readPictures(imgBase),
    museum: new Set(readdirSync(OUT)),
    isServed: (p) => served(OUT, p),
  });
  if (plan.routes.length > ROUTE_LIMIT || plan.redirects.length > REDIRECT_LIMIT) {
    console.error(
      `[postbuild] old-addresses: ${plan.routes.length} routes (limit ${ROUTE_LIMIT}), ${plan.redirects.length} redirects (limit ${REDIRECT_LIMIT})`,
    );
    process.exit(1);
  }
  writeFileSync(
    join(OUT, "_routes.json"),
    `${JSON.stringify({ version: 1, include: plan.routes, exclude: [] }, null, 2)}\n`,
  );
  writeFileSync(join(OUT, "_redirects"), `${plan.redirects.join("\n")}\n`);
  writeFileSync(join(OUT, "_old-images.json"), JSON.stringify(plan.imageMap));
  console.log(
    `[postbuild] old-addresses: ${plan.routes.length} folders to the Function, ${Object.keys(plan.imageMap).length} pictures in its table, ${plan.redirects.length} static redirects`,
  );
}
