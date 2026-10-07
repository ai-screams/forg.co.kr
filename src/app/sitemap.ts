/**
 * `/sitemap.xml`, written at build: the canonical address of every page
 * worth finding (`src/lib/sitemap.ts`), on the public host. No dates: the
 * captures do not say when a page last changed, and a guessed `lastmod` is
 * one search engines learn to ignore.
 */

import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";
import { sitemapPaths } from "@/lib/sitemap";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return (await sitemapPaths()).map((path) => ({ url: absoluteUrl(path) }));
}
