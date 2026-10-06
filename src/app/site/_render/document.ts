/**
 * Assembles a `/site/` document: the archived page (ETL Stage 2g) in its own
 * rendering mode, with the museum bar, the page's own CSS and the assets
 * from `assets.ts`. Redirects, framesets and member-only pages get their own
 * small documents.
 */

import { absoluteUrl, OG_IMAGE, SITE_NAME } from "@/lib/seo";
import {
  olderCaptures,
  sectionAnchor,
  sectionOf,
  type SitePage,
  type SitePageVersion,
} from "@/lib/site-pages";
import { plainText } from "@/lib/structured-data";

import {
  BAR_CSS,
  COMBO_CSS,
  COMBO_HEAD_SCRIPT,
  COMBO_SCRIPT,
  DOCTYPE,
  FIT_SCRIPT,
  GOTO_SCRIPT,
  IN_FRAME_SCRIPT,
  NARROW_CSS,
  PLACEHOLDER_CSS,
  VIEWPORT,
} from "./assets";

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
function captures(page: SitePage, version: SitePageVersion | null, nav: string): string {
  const older = olderCaptures(page);
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
  return `<label>캡처<select onchange="${nav}.href=this.value">${options.join("")}</select></label>`;
}

/**
 * `nav` is what the picker moves: `location` in a page, `top.location` in the
 * bar frame over an older frameset (`renderSiteBar`).
 */
function museumBar(
  page: SitePage,
  version: SitePageVersion | null = null,
  nav = "location",
): string {
  const shown = version ?? page;
  const wayback = `https://web.archive.org/web/${shown.capturedAt.replace(/\D/g, "")}/${shown.originalUrl}`;
  return `<div id="forg-museum-bar" role="note">
<a href="/">forg.co.kr 박물관</a>
<span><b>${escapeHtml(page.title)}</b></span>
<span>원래 주소 <code>${escapeHtml(shown.originalPath)}</code></span>
${captures(page, version, nav)}
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
  return `<!doctype html><html lang="ko">${head(page, `${NOINDEX}${style}`)}<body>
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

// An older frameset capture (the front page before 2011, 02g): a frameset has
// no body to carry the museum bar, so a thin frame above the frameset holds
// it (`renderSiteBar`) and the frameset below is as it was.
const BAR_FRAME_ROWS = 28;

function canonicalOf(page: SitePage): string {
  return absoluteUrl(`/site/${page.stem}/`);
}

function olderHead(page: SitePage): string {
  return `<link rel="canonical" href="${escapeHtml(canonicalOf(page))}"><meta name="robots" content="noindex">`;
}

const NOINDEX = `<meta name="robots" content="noindex">`;

/** How many characters of a page's text its description carries. */
const DESCRIPTION_LENGTH = 150;

/**
 * The latest capture of a page, for search engines and link previews: its
 * canonical address on forg.co.kr, the start of its text as the description,
 * and the museum's preview picture.
 */
function shareHead(page: SitePage): string {
  const url = escapeHtml(canonicalOf(page));
  const title = escapeHtml(page.title);
  // A page of pictures alone has no words: its title says what it is.
  const description = escapeHtml(
    plainText(page.html).slice(0, DESCRIPTION_LENGTH) || `${page.title} — forg.co.kr 안내 페이지`,
  );
  return [
    `<link rel="canonical" href="${url}">`,
    `<meta name="description" content="${description}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">`,
    `<meta property="og:locale" content="ko_KR">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${escapeHtml(absoluteUrl(OG_IMAGE.url))}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join("");
}

function framesetCapture(page: SitePage, version: SitePageVersion): string {
  const bar = `/site/${page.stem}/${version.ts}/bar/`;
  return `<!doctype html><html lang="ko">${head({ ...page, baseTarget: null }, olderHead(page))}<frameset rows="${String(BAR_FRAME_ROWS)},*" border="0" frameborder="0" framespacing="0"><frame src="${escapeHtml(bar)}" name="forg-museum-bar" scrolling="no" noresize marginwidth="0" marginheight="0">${version.html}</frameset></html>`;
}

/**
 * The bar frame over an older frameset: the museum bar alone, on one line
 * (it scrolls sideways on a phone rather than outgrow the frame), every link
 * and the capture picker changing the whole window.
 */
export function renderSiteBar(page: SitePage, version: SitePageVersion): string {
  const style = `${olderHead(page)}<style>${BAR_CSS}
html,body{margin:0;height:100%;background:#2b2b2b}
#forg-museum-bar{flex-wrap:nowrap!important;white-space:nowrap;overflow-x:auto;height:100%;box-sizing:border-box}</style>`;
  return `<!doctype html><html lang="ko">${head({ ...page, baseTarget: "_top" }, style)}<body>
${museumBar(page, version, "top.location")}
</body></html>`;
}

export function renderSitePage(page: SitePage, version: SitePageVersion | null = null): string {
  if (version?.kind === "frameset") return framesetCapture(page, version);
  if (!version) {
    if (page.memberOnly) return memberOnly(page);
    if (page.kind === "redirect") {
      const to = page.redirectTo ?? "/site/";
      return `<!doctype html><html lang="ko">${head(
        page,
        `${NOINDEX}<meta http-equiv="refresh" content="0; url=${escapeHtml(to)}">`,
      )}<body><p>이 주소는 원래 <a href="${escapeHtml(to)}">다른 페이지</a>로 넘어가는 곳이었습니다.</p></body></html>`;
    }
    if (page.kind === "frameset") {
      return `<!doctype html><html lang="ko">${head(page)}${page.html}</html>`;
    }
  }
  // An older capture here is a `page` and borrows the latest's name.
  const shown: SitePage = version ? { ...page, ...version, kind: "page" } : page;
  const combo = shown.html.includes('id="myDIV"');
  // An older capture points search engines at the latest and stays out of
  // the museum's own search, which indexes each page once; the latest tells
  // them its address and what it is about.
  const older = version ? olderHead(page) : shareHead(page);
  const style = `${older}<style>${BAR_CSS}\n${linkColours(shown.bodyStyle)}\n${shown.css}\n${combo ? `${COMBO_CSS}\n` : ""}${PLACEHOLDER_CSS}\n${NARROW_CSS}</style><script>${IN_FRAME_SCRIPT}${combo ? COMBO_HEAD_SCRIPT : ""}</script>`;
  // Search: the page body only (the bar stays out), titled and filed under
  // board "site" so results can say it is a guide page. Framesets and
  // redirects carry no body and stay out of the index. `display:contents`
  // keeps the wrapper out of the page's own layout; `FIT_SCRIPT` finds it by
  // its id to scale the document on a phone.
  const wrapper = version
    ? `<div id="forg-doc" style="display:contents">`
    : `<div id="forg-doc" style="display:contents" data-pagefind-body data-pagefind-meta="title:${escapeHtml(page.title)}" data-pagefind-filter="board:site">`;
  return `${DOCTYPE[shown.mode]}<html lang="ko">${head(shown, style)}<body${bodyAttrs(shown.bodyStyle)}>
${museumBar(page, version)}
${wrapper}
${shown.html}
</div>${shown.html.includes("data-goto") ? `\n<script>${GOTO_SCRIPT}</script>` : ""}${combo ? `\n<script>${COMBO_SCRIPT}</script>` : ""}
<script>${FIT_SCRIPT}</script>
</body></html>`;
}
