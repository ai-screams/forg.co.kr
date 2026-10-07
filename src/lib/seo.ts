/**
 * The museum's public address and the metadata every page shares: its
 * canonical URL, the link-preview card and the site's name.
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

/**
 * A forg timestamp with its time zone. forg's clock was Korean time and the
 * content keeps it without an offset; a date alone, or one that already has
 * an offset, is left as it is.
 */
export function kst(iso: string): string {
  return /T\d{2}:\d{2}(:\d{2})?$/.test(iso) ? `${iso}+09:00` : iso;
}

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
  /** Out of search engines, its links still followed (a board with nothing in it). */
  noindex?: boolean;
}

export function pageMeta({
  title,
  description,
  path,
  shareTitle = title,
  article,
  noindex = false,
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
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: article
      ? {
          ...shared,
          type: "article",
          images: [OG_IMAGE],
          authors: article.authors,
          publishedTime: article.publishedTime && kst(article.publishedTime),
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
