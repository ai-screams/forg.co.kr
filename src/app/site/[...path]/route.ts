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
import {
  getAllSiteStems,
  getSitePage,
  sectionAnchor,
  sectionOf,
  type SitePage,
} from "@/lib/site-pages";

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

// Namo WebEditor's jump menus (`namosw_goto_byselect`), kept by the ETL as
// `<select data-goto>`: choosing an option opens its URL where the original
// did — this frame (`self`), the frame around it (`parent`) or the named
// window `win1` (`blank`). Header and separator options carry no `value` and do
// nothing, where the original would have tried to open their text.
const GOTO_SCRIPT = `document.querySelectorAll("select[data-goto]").forEach(function(s){
s.addEventListener("change",function(){var o=s.options[s.selectedIndex];
if(!o.hasAttribute("value"))return;
var t=s.getAttribute("data-goto");
if(t==="blank")window.open(o.value,"win1");else(t==="parent"?window.parent:window).location.href=o.value;});});`;

// An image Wayback never kept fills the slot the page gave it, in the
// placeholder's own colours, so a column of menu buttons keeps its rhythm
// (the 64×48 picture alone left a small icon in a blank 110×20 slot). One
// that had alt text is a box with those words instead (02g).
const PLACEHOLDER_CSS = `img[data-recovery="missing"]{background:#f5f1e8;outline:1px dashed #a89e85;outline-offset:-1px;object-fit:contain}
.forg-missing{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;max-width:100%;padding:0 2px;overflow:hidden;white-space:nowrap;vertical-align:middle;background:#f5f1e8;outline:1px dashed #a89e85;outline-offset:-1px;color:#6b614b;font:bold 11px/1.2 Verdana,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}`;

// The archived documents are fixed-width table layouts (630px and up, some
// over 2000px) made for a desktop window, and forg had no mobile site to be
// faithful to. On a phone they are reflowed: tables, cells and images give up
// their fixed widths and fit the screen (`nowrap` cells wrap), absolutely
// placed blocks (the town maps cut into layers) stack, and long words
// break. From 800px up the page is exactly the original.
const VIEWPORT = "width=device-width, initial-scale=1";
const NARROW_CSS = `@media (max-width:799px){
body{margin:8px!important;min-width:0!important}
table{width:100%!important;max-width:100%!important;height:auto!important}
td,th{width:auto!important;height:auto!important;white-space:normal!important}
img{max-width:100%!important;height:auto!important}
[style*="position:absolute"],[style*="position: absolute"]{position:static!important;width:auto!important;height:auto!important}
body *{overflow-wrap:break-word;word-break:break-word}
}`;

function head(page: SitePage, extra = ""): string {
  const title = `${page.title} — forg.co.kr 박물관`;
  // The ETL keeps only `[A-Za-z0-9_]+` frame names; escaped regardless.
  const base = page.baseTarget ? `<base target="${escapeHtml(page.baseTarget)}">` : "";
  return `<head><meta charset="utf-8"><meta name="viewport" content="${VIEWPORT}">
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

// A page forg showed members only. Wayback visited as a guest and kept the
// refresh to the login notice; there is nothing else to show, so the page
// says so rather than sending the visitor to a login no one can do.
function nearby(page: SitePage): string {
  const open = page.openNearby ?? [];
  if (open.length === 0) return "";
  const items = open
    .map(
      (p) =>
        `<li><a href="/site/${escapeHtml(p.stem)}/">${escapeHtml(p.title)}</a> <span class="forg-path">/${escapeHtml(p.stem)}</span></li>`,
    )
    .join("");
  return `<p>같은 구역에서 볼 수 있는 페이지:</p><ul>${items}</ul>`;
}

function memberOnly(page: SitePage): string {
  const style = `<style>${BAR_CSS}
.forg-member-only{max-width:560px;margin:48px auto;padding:0 16px;font:14px/1.7 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#333}
.forg-member-only h1{font-size:18px;margin:0 0 12px}
.forg-member-only a{color:#8a6100}
.forg-member-only ul{margin:0 0 12px;padding-left:20px}
.forg-member-only .forg-path{color:#888;font-size:12px}</style><script>${IN_FRAME_SCRIPT}</script>`;
  return `<!doctype html><html lang="ko">${head(page, style)}<body>
${museumBar(page)}
<div class="forg-member-only">
<h1>${escapeHtml(page.title)}</h1>
<p>forg에서 회원만 볼 수 있던 페이지입니다. ${
    page.kind === "page"
      ? "Wayback이 저장할 때 회원 확인 스크립트가 오류를 내서, 이 주소에는 PHP 경고만 남았습니다."
      : "이 안내 자료는 로그인한 회원에게만 보였고, 손님에게는 로그인 안내가 떴습니다. Wayback도 손님으로 저장해서 이 주소에 남은 것은 그 안내뿐입니다."
  } 같은 내용이 로그인 없이 저장된 더 이른 캡처도 찾지 못했습니다.</p>
${nearby(page)}
<p><a href="/site/faq_1/">당시 손님에게 뜨던 로그인 안내</a> · <a href="/site/#${sectionAnchor(sectionOf(page))}">사이트 페이지 목록</a></p>
</div>
</body></html>`;
}

function render(page: SitePage): string {
  if (page.memberOnly) return memberOnly(page);
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
  const style = `<style>${BAR_CSS}\n${linkColours(page.bodyStyle)}\n${page.css}\n${PLACEHOLDER_CSS}\n${NARROW_CSS}</style><script>${IN_FRAME_SCRIPT}</script>`;
  // Search: the page body only (the bar stays out), titled and filed under
  // board "site" so results can say it is a guide page. Framesets and
  // redirects carry no body and stay out of the index. `display:contents`
  // keeps the wrapper out of the page's own layout.
  const searchable = `<div style="display:contents" data-pagefind-body data-pagefind-meta="title:${escapeHtml(page.title)}" data-pagefind-filter="board:site">`;
  return `<!doctype html><html lang="ko">${head(page, style)}<body${bodyAttrs(page.bodyStyle)}>
${museumBar(page)}
${searchable}
${page.html}
</div>${page.html.includes("data-goto") ? `\n<script>${GOTO_SCRIPT}</script>` : ""}
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
