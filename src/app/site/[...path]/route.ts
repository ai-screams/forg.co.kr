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
  getAllSitePages,
  getSitePage,
  getSitePageVersion,
  sectionAnchor,
  sectionOf,
  type SitePage,
  type SitePageVersion,
} from "@/lib/site-pages";

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
    const older = page.versions.flatMap((v) =>
      v.ts === undefined ? [] : [{ path: [...stem, v.ts, "index.html"] }],
    );
    return [{ path: [...stem, "index.html"] }, ...older];
  });
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
#forg-museum-bar select{font:inherit!important;color:#222!important;background:#eee!important;border:1px solid #888!important;margin:0 0 0 4px!important;padding:0 2px!important;width:auto!important;height:auto!important}
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

// The "Catalog*******" pop-up list on the Diablo item and UO skill guides
// (`font#combos` + `div#myDIV`, "FlatStyle PopUp ComboList" in their script).
// The page hid the list with `visibility=hidden`, which is not CSS and is
// dropped, and its margins (`margin-left:-125px`) put it left of the Catalog
// box, so it showed open, over the text. Here it opens under the Catalog box
// on hover, tap or focus and closes on leaving it, as the script's
// mouseover/mouseout handlers did. Moving from the box down into the list
// leaves one and enters the other in the same pointer move, so it stays open.
// Focus moving from the box into the list keeps it open (a link in a hidden
// list could not take the focus), and the list itself takes the focus when
// clicked between its links. A mouse leaving does not close a list opened
// from the keyboard. A press anywhere else closes it (a pen hover or an
// iPhone tap may move no focus); so do Tab past it and Escape, which puts
// the focus back on the box. A resize moves an open list under the box again.
// Every page with the list is in quirks mode, where the page's own rules give
// the colours. As an inline block the box takes `.combo{width:120px}`, and
// border-box sizing (IE's) makes the box and the list both 120px wide. The
// list's `height:10` would draw a 10px box with the links spilling out (IE
// grew a box to its content). Chromium reads the box's `cursor:hand` in
// quirks mode, Firefox does not. The box is drawn as a flat combo box: its
// label ("Catalog", 02g drops the asterisks that padded it) on the left, an
// arrow cell on the right that turns the links' orange while the list is
// open. Without script the class is never set and the list stays visible.
const COMBO_HEAD_SCRIPT = "document.documentElement.className+=' forg-combo';";
const COMBO_CSS = `#combos{display:inline-block;box-sizing:border-box;cursor:pointer;position:relative;text-align:left;padding-left:6px}
#combos::before{content:"";position:absolute;top:0;bottom:0;right:14px;border-left:1px solid #666}
#combos::after{content:"";position:absolute;right:3px;top:50%;margin-top:-2px;border:4px solid transparent;border-top-color:#666;border-bottom:0}
#combos[aria-expanded=true]::after{border-top-color:#ef5900}
#myDIV{box-sizing:border-box;height:auto}
html.forg-combo #myDIV{visibility:hidden}
html.forg-combo #myDIV.forg-open{visibility:visible}`;
const COMBO_SCRIPT = `(function(){var c=document.getElementById("combos"),m=document.getElementById("myDIV");
c.tabIndex=0;m.tabIndex=-1;c.setAttribute("role","button");c.setAttribute("aria-controls","myDIV");c.setAttribute("aria-expanded","false");
function show(){var r=c.getBoundingClientRect();m.style.left="0px";m.style.top="0px";var o=m.getBoundingClientRect();
m.style.left=(r.left-o.left)+"px";m.style.top=(r.bottom-o.top)+"px";m.classList.add("forg-open");c.setAttribute("aria-expanded","true");}
function hide(){m.classList.remove("forg-open");c.setAttribute("aria-expanded","false");}
[c,m].forEach(function(e){
e.addEventListener("pointerenter",show);
e.addEventListener("pointerleave",function(v){if(v.pointerType==="mouse"&&!document.querySelector("#combos:focus-visible,#myDIV :focus-visible"))hide();});
e.addEventListener("focusin",show);
e.addEventListener("focusout",function(v){if(!m.contains(v.relatedTarget))hide();});});
document.addEventListener("pointerdown",function(v){if(!c.contains(v.target)&&!m.contains(v.target))hide();});
document.addEventListener("keydown",function(v){if(v.key!=="Escape")return;if(m.contains(document.activeElement))c.focus();hide();});
window.addEventListener("resize",function(){if(m.classList.contains("forg-open"))show();});})();`;

// An image Wayback never kept fills the slot the page gave it, in the
// placeholder's own colours, so a column of menu buttons keeps its rhythm
// (the 64×48 picture alone left a small icon in a blank 110×20 slot). One
// that had alt text, or a button whose link names its page, is a box with
// those words instead (02g). The box sits on the baseline as the picture did
// (an inline block that hides its overflow has its bottom edge as its
// baseline), with its words centred by a line height of the slot's (02g).
const PLACEHOLDER_CSS = `img[data-recovery="missing"]{background:#f5f1e8;outline:1px dashed #a89e85;outline-offset:-1px;object-fit:contain}
.forg-missing{display:inline-block;text-align:center;box-sizing:border-box;max-width:100%;padding:0 2px;overflow:hidden;white-space:nowrap;vertical-align:baseline;background:#f5f1e8;outline:1px dashed #a89e85;outline-offset:-1px;color:#6b614b;font:bold 11px/1.2 Verdana,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}`;

// The archived documents are fixed-width table layouts (630px and up, some
// over 2000px) made for a desktop window, and forg had no mobile site to be
// faithful to. On a phone they are reflowed: tables, cells and images give up
// their fixed widths and fit the screen (`nowrap` cells wrap), absolutely
// placed blocks (the town maps cut into layers) stack, and long words
// break. From 800px up the page is exactly the original. A document in a
// frame keeps its layout at any width: the frame sets it (the 2003
// frameset's columns are 100 and 680px wide), not the phone.
const VIEWPORT = "width=device-width, initial-scale=1";
const NARROW_CSS = `@media (max-width:799px){
html:not(.in-frame) body{margin:8px!important;min-width:0!important}
html:not(.in-frame) table{width:100%!important;max-width:100%!important;height:auto!important}
html:not(.in-frame) td,html:not(.in-frame) th{width:auto!important;height:auto!important;white-space:normal!important}
html:not(.in-frame) img{max-width:calc(100vw - 16px)!important;height:auto!important}
html:not(.in-frame) [style*="position:absolute"],html:not(.in-frame) [style*="position: absolute"]{position:static!important;width:auto!important;height:auto!important}
body *{overflow-wrap:break-word;word-break:break-word}
}`;

// A doctype that puts the browser in the mode it drew the capture in (02g,
// RENDERING MODE): none for quirks mode, as most of the originals had none.
const DOCTYPE: Record<SitePage["mode"], string> = {
  quirks: "",
  "limited-quirks":
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
  "no-quirks": "<!doctype html>",
};

function head(page: SitePage, extra = ""): string {
  const title = `${page.title} — forg.co.kr 박물관`;
  // The ETL keeps only `[A-Za-z0-9_]+` frame names; escaped regardless.
  const base = page.baseTarget ? `<base target="${escapeHtml(page.baseTarget)}">` : "";
  return `<head><meta charset="utf-8"><meta name="viewport" content="${VIEWPORT}">
<title>${escapeHtml(title)}</title>${base}${extra}</head>`;
}

// A page with older captures the museum can show gets a picker in place of
// the count, the latest first: the museum shows the latest by default, and
// the older ones keep the page as it looked before (a redesign, a section
// still to be written). Captures that were only a redirect or a blank page
// are not offered.
function captures(page: SitePage, version: SitePageVersion | null): string {
  const older = page.versions.flatMap((v) =>
    v.ts === undefined ? [] : [{ ts: v.ts, capturedAt: v.capturedAt }],
  );
  if (older.length === 0) {
    const others = page.versions.length - 1;
    return `<span>${formatDate(page.capturedAt)} 캡처${others > 0 ? ` · 다른 캡처 ${String(others)}개` : ""}</span>`;
  }
  const base = `/site/${page.stem}/`;
  const options = [
    `<option value="${escapeHtml(base)}"${version ? "" : " selected"}>${formatDate(page.capturedAt)} (최신)</option>`,
    ...older
      .reverse()
      .map(
        (v) =>
          `<option value="${escapeHtml(`${base}${v.ts}/`)}"${version?.ts === v.ts ? " selected" : ""}>${formatDate(v.capturedAt)}</option>`,
      ),
  ];
  return `<label>캡처<select onchange="location.href=this.value">${options.join("")}</select></label>`;
}

function museumBar(page: SitePage, version: SitePageVersion | null = null): string {
  const shown = version ?? page;
  const wayback = `https://web.archive.org/web/${shown.capturedAt.replace(/\D/g, "")}/${shown.originalUrl}`;
  return `<div id="forg-museum-bar" role="note">
<a href="/">forg.co.kr 박물관</a>
<span><b>${escapeHtml(page.title)}</b></span>
<span>원래 주소 <code>${escapeHtml(shown.originalPath)}</code></span>
${captures(page, version)}
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

function render(page: SitePage, version: SitePageVersion | null = null): string {
  if (!version) {
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
  }
  // An older capture is always a `page` (02g) and borrows the latest's name.
  const shown: SitePage = version ? { ...page, ...version } : page;
  const combo = shown.html.includes('id="myDIV"');
  // An older capture points search engines at the latest and stays out of
  // the museum's own search, which indexes each page once.
  const older = version
    ? `<link rel="canonical" href="/site/${escapeHtml(page.stem)}/"><meta name="robots" content="noindex">`
    : "";
  const style = `${older}<style>${BAR_CSS}\n${linkColours(shown.bodyStyle)}\n${shown.css}\n${combo ? `${COMBO_CSS}\n` : ""}${PLACEHOLDER_CSS}\n${NARROW_CSS}</style><script>${IN_FRAME_SCRIPT}${combo ? COMBO_HEAD_SCRIPT : ""}</script>`;
  // Search: the page body only (the bar stays out), titled and filed under
  // board "site" so results can say it is a guide page. Framesets and
  // redirects carry no body and stay out of the index. `display:contents`
  // keeps the wrapper out of the page's own layout.
  const wrapper = version
    ? `<div style="display:contents">`
    : `<div style="display:contents" data-pagefind-body data-pagefind-meta="title:${escapeHtml(page.title)}" data-pagefind-filter="board:site">`;
  return `${DOCTYPE[shown.mode]}<html lang="ko">${head(shown, style)}<body${bodyAttrs(shown.bodyStyle)}>
${museumBar(page, version)}
${wrapper}
${shown.html}
</div>${shown.html.includes("data-goto") ? `\n<script>${GOTO_SCRIPT}</script>` : ""}${combo ? `\n<script>${COMBO_SCRIPT}</script>` : ""}
</body></html>`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<RouteParams> },
): Promise<Response> {
  const { path } = await params;
  const rest = path.slice(0, -1);
  const ts = rest.at(-1) ?? "";
  const stem = (CAPTURE_TS.test(ts) ? rest.slice(0, -1) : rest).join("/");
  const page = await getSitePage(stem);
  const version = CAPTURE_TS.test(ts) ? await getSitePageVersion(stem, ts) : null;
  if (!page) return new Response("Not found", { status: 404 });
  // Every `ts` a page lists has its file (02g writes both), so a gap is a
  // broken run, not a missing page.
  if (CAPTURE_TS.test(ts) && !version) throw new Error(`no older capture ${stem}/${ts}`);
  return new Response(withImgBaseEverywhere(render(page, version)), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
