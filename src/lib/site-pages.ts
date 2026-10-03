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
const VERSIONS_ROOT = path.join(process.cwd(), "src", "content", "page-versions");

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
  /** Every capture, oldest first; an older `page` one that can be shown has its `ts`. */
  versions: { capturedAt: string; kind: string; ts?: string }[];
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
  /**
   * Kind `page`: the mode a browser draws the capture in, which the route's
   * doctype selects again. Framesets and redirects carry `no-quirks`.
   */
  mode: "quirks" | "limited-quirks" | "no-quirks";
}

/** An older capture of a page, served at `/site/{stem}/{ts}/` (02g OLDER CAPTURES). */
export interface SitePageVersion {
  stem: string;
  /** The capture time the museum shows, `YYYYMMDDhhmmss`. */
  ts: string;
  capturedAt: string;
  originalPath: string;
  originalUrl: string;
  baseTarget: string | null;
  mode: SitePage["mode"];
  css: string;
  bodyStyle: Record<string, string>;
  html: string;
}

function assertIsSitePage(value: unknown): asserts value is SitePage {
  if (!value || typeof value !== "object") throw new Error("page JSON is not an object");
  const v = value as Record<string, unknown>;
  for (const key of ["stem", "originalPath", "kind", "title", "capturedAt", "css", "html"]) {
    if (typeof v[key] !== "string") throw new Error(`page JSON missing string field: ${key}`);
  }
  if (v["mode"] !== "quirks" && v["mode"] !== "limited-quirks" && v["mode"] !== "no-quirks") {
    throw new Error("page JSON has no rendering mode: re-run 02g-parse-site.py");
  }
}

async function getAllSiteStems(): Promise<string[]> {
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

export async function getSitePageVersion(
  stem: string,
  ts: string,
): Promise<SitePageVersion | null> {
  if (!/^[A-Za-z0-9._/-]+$/.test(stem) || stem.split("/").includes("..") || !/^\d{14}$/.test(ts)) {
    return null;
  }
  try {
    const raw: unknown = JSON.parse(
      await readFile(path.join(VERSIONS_ROOT, stem, `${ts}.json`), "utf8"),
    );
    const v = raw as Partial<SitePageVersion> | null;
    if (!v || typeof v.html !== "string" || typeof v.css !== "string" || v.ts !== ts) {
      throw new Error(`page version JSON malformed: ${stem}/${ts}`);
    }
    return raw as SitePageVersion;
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
