/**
 * Build-time loader for forg's static pages — the guides, maps and frames
 * outside the boards (ETL Stage 2g, `scripts/etl/02g-parse-site.py`).
 *
 * Each page is `src/content/pages/{stem}.json`; `stem` is the original path
 * without `.htm`/`.html` (`Diablo/uarmor`, `index`, `holy/index`).
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const PAGES_ROOT = path.join(process.cwd(), "src", "content", "pages");

export type SitePageKind = "page" | "frameset" | "redirect";

/** A page's section in the page list: its first path segment ("" at the root). */
export function sectionOf(page: Pick<SitePage, "stem">): string {
  const i = page.stem.indexOf("/");
  return i < 0 ? "" : page.stem.slice(0, i);
}

/** The page list's anchor for a section (`/site/#section-skill`). */
export function sectionAnchor(section: string): string {
  return `section-${section || "root"}`;
}

export interface SitePage {
  stem: string;
  originalPath: string;
  originalUrl: string;
  kind: SitePageKind;
  title: string;
  capturedAt: string;
  versions: { capturedAt: string; kind: string }[];
  /** Rules from the page's own `<style>` blocks, minus anything that loads or runs. */
  css: string;
  /** The page's `<body>` attributes as CSS properties (`--link` etc. for link colours). */
  bodyStyle: Record<string, string>;
  /** nh3-sanitised body, or the rebuilt `<frameset>` for kind `frameset`. */
  html: string;
  redirectTo: string | null;
  /**
   * A guest was refreshed to the login notice (`/faq_1.html`) and no open
   * capture of the document was found; the route explains that instead.
   */
  memberOnly?: true;
  /**
   * With `memberOnly`: the open pages in the same folder, when there are ten
   * or fewer (empty past that — the notice links the section instead).
   */
  openNearby?: { stem: string; title: string }[];
  /** `<base target>` — the frame every link opens in (`detail`, `forg_b`). */
  baseTarget: string | null;
}

function assertIsSitePage(value: unknown): asserts value is SitePage {
  if (!value || typeof value !== "object") throw new Error("page JSON is not an object");
  const v = value as Record<string, unknown>;
  for (const key of ["stem", "originalPath", "kind", "title", "capturedAt", "css", "html"]) {
    if (typeof v[key] !== "string") throw new Error(`page JSON missing string field: ${key}`);
  }
}

export async function getAllSiteStems(): Promise<string[]> {
  const entries = await readdir(PAGES_ROOT, { recursive: true, encoding: "utf8" });
  return entries
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length).split(path.sep).join("/"))
    .sort();
}

export async function getSitePage(stem: string): Promise<SitePage | null> {
  if (!/^[A-Za-z0-9._/-]+$/.test(stem) || stem.split("/").includes("..")) return null;
  try {
    const raw: unknown = JSON.parse(await readFile(path.join(PAGES_ROOT, `${stem}.json`), "utf8"));
    assertIsSitePage(raw);
    return raw;
  } catch (err) {
    if ((err as { code?: unknown }).code === "ENOENT") return null;
    throw err;
  }
}

export async function getAllSitePages(): Promise<SitePage[]> {
  const stems = await getAllSiteStems();
  const pages = await Promise.all(stems.map((s) => getSitePage(s)));
  return pages.filter((p) => p !== null);
}
