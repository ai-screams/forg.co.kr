/**
 * The museum's public address and the metadata every page shares: its
 * canonical URL, the link-preview card and the site's name (TODO D4,
 * `.docs/decisions/2026-10-06-seo.md`).
 *
 * A route builds its metadata with `pageMeta`, not by hand: Next.js replaces
 * a parent's `openGraph` and `twitter` wholesale when a page sets its own, so
 * a page that wrote only a title there would lose the preview picture.
 * Canonical URLs are per page and never set in the root layout, where every
 * page without its own would inherit the home page's.
 */

import type { Metadata } from "next";

export const SITE_URL = "https://forg.co.kr";
export const SITE_NAME = "forg.co.kr 디지털 박물관";
export const SITE_DESCRIPTION =
  "한국 울티마 온라인 최대 팬사이트 forg.co.kr (1998–2016) 재현 아카이브";

/** The link-preview picture: the 2003/2014 front page's dragon banner (`public/og.png`). */
export const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "forg.co.kr 디지털 박물관 — 한국 울티마 온라인 팬사이트, 1998–2016",
} as const;

/** `path` (from the site root, with its trailing slash) on the public address. */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).href;
}

interface PageMetaInput {
  /** The document title. */
  title: string;
  description?: string | undefined;
  /** The page's own path, with its trailing slash: its canonical URL. */
  path: string;
  /** The title on a link preview, when shorter than the document's. */
  shareTitle?: string;
  /** `article` for a post, with its date and author. */
  article?: { publishedTime?: string | undefined; authors: string[] };
}

export function pageMeta({
  title,
  description,
  path,
  shareTitle = title,
  article,
}: PageMetaInput): Metadata {
  const shared = {
    title: shareTitle,
    description,
    url: path,
    siteName: SITE_NAME,
    locale: "ko_KR",
  };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: article
      ? {
          ...shared,
          type: "article",
          images: [OG_IMAGE],
          authors: article.authors,
          publishedTime: article.publishedTime,
        }
      : { ...shared, type: "website", images: [OG_IMAGE] },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: [OG_IMAGE.url],
    },
  };
}
