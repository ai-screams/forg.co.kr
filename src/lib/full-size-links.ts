/**
 * Zeroboard put a big picture inside a link to the same file,
 * `<a href="data/x.jpg" title="클릭하면 원본을 볼수 있습니다.">`, relative to the
 * board's folder. Under the museum's post address that link is a 404. Where
 * the picture was recovered the link goes to its copy (the same file); where
 * it was not (the placeholder), Wayback kept neither, so the link loses its
 * address and the anchor stays without one.
 *
 * Only a relative link whose file name is the picture's own: a link to
 * another site, or to another file, is left as the post had it.
 */

const LINKED_PICTURE = /<a\b([^>]*?)\shref="([^"]*)"([^>]*)>(\s*<img\b[^>]*>)/g;
const NOT_RELATIVE = /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i;

function attr(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

function fileName(url: string): string {
  return (url.split(/[?#]/)[0] ?? "").split("/").pop()?.toLowerCase() ?? "";
}

export function withFullSizeLinks(html: string): string {
  return html.replace(
    LINKED_PICTURE,
    (whole, before: string, href: string, after: string, img: string) => {
      const original = attr(img, "data-original-src");
      if (NOT_RELATIVE.test(href) || !original || fileName(href) !== fileName(original)) {
        return whole;
      }
      const recovery = attr(img, "data-recovery");
      const src = attr(img, "src");
      if (recovery === "ok" && src) return `<a${before} href="${src}"${after}>${img}`;
      if (recovery === "failed") return `<a${before}${after}>${img}`;
      return whole;
    },
  );
}
