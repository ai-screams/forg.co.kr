/**
 * Alt text for the pictures in a post or comment whose original `<img>` had
 * none (about 9,700 of 9,860 in the gold JSON, 2026-10-06): screen readers
 * and image search read it, and Lighthouse counts a picture without one.
 *
 * - an emoticon (`/img/emoticon/`, or a lost one whose Wayback address was
 *   an emoticon's): empty, as decoration;
 * - the stand-in for a picture Wayback did not keep (`/img/placeholder/`):
 *   "남지 않은 그림";
 * - a recovered picture (`/img/posts/`) or anything else: the caller's
 *   words, which for a post's body name the post.
 *
 * An `alt` the original had stays as it was.
 */

// nh3 writes tag and attribute names in lower case.
const IMG = /<img\b([^>]*)>/g;
const HAS_ALT = /\salt\s*=/;
const SRC = /(?<![-\w])src\s*=\s*["']([^"']*)/;

function attribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function withAltText(html: string, picture: string): string {
  return html.replace(IMG, (tag, attrs: string) => {
    if (HAS_ALT.test(attrs)) return tag;
    const src = SRC.exec(attrs)?.[1] ?? "";
    const alt =
      src.startsWith("/img/emoticon/") || /data-original-src="[^"]*\/emoticon\//.test(attrs)
        ? ""
        : src.startsWith("/img/placeholder/")
          ? "남지 않은 그림"
          : picture;
    return `<img alt="${attribute(alt)}"${attrs}>`;
  });
}
