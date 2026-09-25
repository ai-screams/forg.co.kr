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
 * once and one bar at the top is enough.
 */

import { withImgBaseEverywhere } from "@/lib/img-base";
import { getAllSiteStems, getSitePage, type SitePage } from "@/lib/site-pages";

export const dynamicParams = false;

interface RouteParams {
  path: string[];
}

export async function generateStaticParams(): Promise<RouteParams[]> {
  const stems = await getAllSiteStems();
  return stems.map((stem) => ({ path: [...stem.split("/"), "index.html"] }));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

// `!important` throughout: the archived page's own CSS follows this block and
// must not be able to restyle or hide the bar (rules naming it are also
// dropped by the ETL).
const BAR_CSS = `
#forg-museum-bar{font:12px/1.6 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif!important;
background:#2b2b2b!important;color:#eee!important;padding:4px 10px!important;display:flex!important;
flex-wrap:wrap!important;gap:4px 12px!important;align-items:center!important;visibility:visible!important}
#forg-museum-bar a{color:#ffc73b!important;text-decoration:underline!important}
#forg-museum-bar b{color:#ffc73b!important}
html.in-frame #forg-museum-bar{display:none!important}`;

const IN_FRAME_SCRIPT =
  "if(window.top!==window.self)document.documentElement.className+=' in-frame';";

function head(page: SitePage, extra = ""): string {
  const title = `${page.title} — forg.co.kr 박물관`;
  // The ETL keeps only `[A-Za-z0-9_]+` frame names; escaped regardless.
  const base = page.baseTarget ? `<base target="${escapeHtml(page.baseTarget)}">` : "";
  return `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>${base}${extra}</head>`;
}

function museumBar(page: SitePage): string {
  const others = page.versions.length - 1;
  const wayback = `https://web.archive.org/web/${page.capturedAt.replace(/\D/g, "")}/${page.originalUrl}`;
  return `<div id="forg-museum-bar" role="note">
<a href="/">forg.co.kr 박물관</a>
<span><b>${escapeHtml(page.title)}</b></span>
<span>원래 주소 <code>${escapeHtml(page.originalPath)}</code></span>
<span>${formatDate(page.capturedAt)} 캡처${others > 0 ? ` · 다른 캡처 ${String(others)}개` : ""}</span>
<a href="/site/">사이트 페이지 목록</a>
<a href="${escapeHtml(wayback)}" target="_blank" rel="noopener">Wayback 원본</a>
</div>`;
}

function bodyAttrs(style: Record<string, string>): string {
  const decl = Object.entries(style)
    .filter(([k]) => !k.startsWith("--"))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return decl ? ` style="${escapeHtml(decl)}"` : "";
}

function linkColours(style: Record<string, string>): string {
  const rules: string[] = [];
  const link = style["--link"];
  const vlink = style["--vlink"];
  const alink = style["--alink"];
  if (link) rules.push(`a:link{color:${link}}`);
  if (vlink) rules.push(`a:visited{color:${vlink}}`);
  if (alink) rules.push(`a:active{color:${alink}}`);
  return rules.join("");
}

function render(page: SitePage): string {
  if (page.kind === "redirect") {
    const to = page.redirectTo ?? "/site/";
    return `<!doctype html><html lang="ko">${head(
      page,
      `<meta http-equiv="refresh" content="0; url=${escapeHtml(to)}">`,
    )}<body><p>이 주소는 원래 <a href="${escapeHtml(to)}">다른 페이지</a>로 넘어가는 곳이었습니다.</p></body></html>`;
  }
  if (page.kind === "frameset") {
    return `<!doctype html><html lang="ko">${head(page)}${page.html}</html>`;
  }
  const style = `<style>${BAR_CSS}\n${linkColours(page.bodyStyle)}\n${page.css}</style><script>${IN_FRAME_SCRIPT}</script>`;
  return `<!doctype html><html lang="ko">${head(page, style)}<body${bodyAttrs(page.bodyStyle)}>
${museumBar(page)}
${page.html}
</body></html>`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<RouteParams> },
): Promise<Response> {
  const { path } = await params;
  const page = await getSitePage(path.slice(0, -1).join("/"));
  if (!page) return new Response("Not found", { status: 404 });
  return new Response(withImgBaseEverywhere(render(page)), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
