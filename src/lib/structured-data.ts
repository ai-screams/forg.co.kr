/**
 * Structured data (JSON-LD) for search engines: the site's name on the home
 * page, and each post as a `DiscussionForumPosting` with its comments and the
 * trail home › board › post.
 *
 * Google reads a forum post's markup only with an author and a date
 * (developers.google.com/search/docs/appearance/structured-data/discussion-forum),
 * so a post whose date the captures did not keep gets none, and a comment
 * without its date is left out of the list.
 */

import type { Board } from "@/lib/boards";
import { isUnknownDate } from "@/lib/dates";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo";
import type { Post } from "@/types/post";

type JsonLd = Record<string, unknown>;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  nbsp: " ",
};

/** A numeric character reference's character; a space for one that names none. */
function character(code: number): string {
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
}

/**
 * Sanitised HTML as plain text: styles dropped, a line or block boundary as
 * a space, the common entities decoded and any other dropped.
 */
export function plainText(html: string): string {
  return html
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?(br|p|div|li|tr|td|th|h[1-6]|table|center|blockquote)\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n: string) => character(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => character(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (_, name: string) => ENTITIES[name] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: ["forg.co.kr", "forg"],
    url: `${SITE_URL}/`,
    inLanguage: "ko",
  };
}

function person(name: string): JsonLd {
  return { "@type": "Person", name };
}

/** The post, or null when the captures kept no date for it. */
export function postJsonLd(post: Post, board: Board): JsonLd | null {
  if (isUnknownDate(post.createdAt)) return null;
  const url = absoluteUrl(`/${board.id}/${post.postId}/`);
  const comments = post.comments
    .filter((c) => !isUnknownDate(c.createdAt))
    .map((c) => ({
      "@type": "Comment",
      author: person(c.author),
      datePublished: c.createdAt,
      text: plainText(c.bodyHtml),
    }));
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    "@id": url,
    url,
    headline: post.title,
    text: post.bodyText,
    author: person(post.author),
    datePublished: post.createdAt,
    inLanguage: "ko",
    isPartOf: { "@type": "WebPage", name: board.nameKr, url: absoluteUrl(`/${board.id}/`) },
    commentCount: post.comments.length,
    comment: comments,
    ...(post.hits === null
      ? {}
      : {
          interactionStatistic: {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/ViewAction",
            userInteractionCount: post.hits,
          },
        }),
  };
}

export function breadcrumbJsonLd(post: Post, board: Board): JsonLd {
  const crumbs = [
    { name: SITE_NAME, path: "/" },
    { name: board.nameKr, path: `/${board.id}/` },
    { name: post.title, path: `/${board.id}/${post.postId}/` },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

/** JSON-LD for a `<script>`: `<` escaped so a post's text cannot close the tag. */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
