/**
 * Where recovered post images are served from (ADR-0018).
 *
 * Gold JSON keeps `<img src="/img/posts/…">`; the bytes live in R2 behind
 * `NEXT_PUBLIC_IMG_BASE` (e.g. `https://img.forg.co.kr`, bucket key
 * `posts/…`). Unset, bodies render unchanged and the images come from
 * `public/img/posts/` — the ETL machine and local previews. Emoticons and
 * chrome stay in the repo, so only `/img/posts/` is rewritten;
 * `data-original-src` (the Wayback URL) is left alone.
 *
 * Inlined at build time like `NEXT_PUBLIC_PAGEFIND_BASE` (bracket access
 * is substituted too — verified 2026-09-17).
 */
const IMG_BASE_RAW = process.env["NEXT_PUBLIC_IMG_BASE"] ?? "";
const IMG_BASE = IMG_BASE_RAW.replace(/\/+$/, "");

const POSTS_SRC = /(<img\b[^>]*?\ssrc=")\/img\/posts\//g;

/** Rewrite `/img/posts/…` image sources in sanitised body HTML to the CDN. */
export function withImgBase(html: string): string {
  if (!IMG_BASE || !html.includes("/img/posts/")) return html;
  return html.replace(POSTS_SRC, `$1${IMG_BASE}/posts/`);
}
