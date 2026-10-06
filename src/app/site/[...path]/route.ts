/**
 * `/site/{stem}/` — one of forg's static pages, served back as the whole
 * document it was (ETL Stage 2g).
 *
 * These pages were designed as documents opened in the site's "detail"
 * frame, not as board posts, so they are not wrapped in the museum layout.
 * The route emits `/site/{stem}/index.html` at build time (static export
 * renders GET route handlers to files); the last path segment is the literal
 * `index.html` so every page gets a directory URL like the rest of the site.
 *
 * A thin museum bar names the page, its original path and capture date. It
 * hides itself inside a frame — a frameset page shows several documents at
 * once and one bar at the top is enough. An older frameset capture has it in
 * a frame of its own, `/site/{stem}/{ts}/bar/`.
 */

import { withImgBaseEverywhere } from "@/lib/img-base";
import { getAllSitePages, getSitePage, getSitePageVersion, olderCaptures } from "@/lib/site-pages";

import { renderSiteBar, renderSitePage } from "../_render/document";

export const dynamicParams = false;

interface RouteParams {
  path: string[];
}

// An older capture is `/site/{stem}/{ts}/`: no stem has a 14-digit segment.
const CAPTURE_TS = /^\d{14}$/;

export async function generateStaticParams(): Promise<RouteParams[]> {
  const pages = await getAllSitePages();
  return pages.flatMap((page) => {
    const stem = page.stem.split("/");
    const older = olderCaptures(page).flatMap((v) => [
      { path: [...stem, v.ts, "index.html"] },
      ...(v.kind === "frameset" ? [{ path: [...stem, v.ts, "bar", "index.html"] }] : []),
    ]);
    return [{ path: [...stem, "index.html"] }, ...older];
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<RouteParams> },
): Promise<Response> {
  const { path } = await params;
  // `{stem}/{ts}/bar/` — a stem may itself end in `bar`, so the capture
  // time before it decides.
  const bar = path.at(-2) === "bar" && CAPTURE_TS.test(path.at(-3) ?? "");
  const rest = path.slice(0, bar ? -2 : -1);
  const ts = rest.at(-1) ?? "";
  const older = CAPTURE_TS.test(ts);
  const stem = (older ? rest.slice(0, -1) : rest).join("/");
  const [page, version] = await Promise.all([
    getSitePage(stem),
    older ? getSitePageVersion(stem, ts) : null,
  ]);
  if (!page) return new Response("Not found", { status: 404 });
  // Every `ts` a page lists has its file (02g writes both), so a gap is a
  // broken run, not a missing page.
  if (older && !version) throw new Error(`no older capture ${stem}/${ts}`);
  if (bar && version?.kind !== "frameset") throw new Error(`no frameset capture ${stem}/${ts}`);
  const html = bar && version ? renderSiteBar(page, version) : renderSitePage(page, version);
  return new Response(withImgBaseEverywhere(html), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
