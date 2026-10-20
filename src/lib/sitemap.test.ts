import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getAllPostParams } from "@/lib/posts";
import { pageMeta } from "@/lib/seo";
import { getAllSitePages } from "@/lib/site-pages";
import { sitemapPaths } from "@/lib/sitemap";

describe("the sitemap", () => {
  // Fails if: a post, a board's later list page, a /site/ page or the list
  // of boards goes missing, a path repeats, or one lacks the trailing slash the canonical
  // address has (the sitemap would list a redirect).
  it("lists every page worth finding once, by its canonical path", async () => {
    const paths = await sitemapPaths();
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.every((p) => p.startsWith("/") && p.endsWith("/"))).toBe(true);
    for (const p of [
      "/",
      "/policy/",
      "/site/",
      "/boards/",
      "/UoBoard/",
      "/UoBoard/page/2/",
      "/UoBoard/26397/",
    ]) {
      expect(paths).toContain(p);
    }
    const listed = new Set(paths);
    const posts = await getAllPostParams();
    expect(posts.filter((q) => listed.has(`/${q.board}/${q.postId}/`))).toHaveLength(posts.length);
  });

  // Fails if: the sitemap lists a page kept out of search engines or one
  // with nothing to read: search, an empty board, an older capture, a
  // frameset, a redirect or a member-only notice.
  it("leaves out what is not worth finding", async () => {
    const paths = await sitemapPaths();
    expect(paths).not.toContain("/search/");
    expect(paths).not.toContain("/MoNgBaT/");
    const site = new Map((await getAllSitePages()).map((p) => [`/site/${p.stem}/`, p]));
    const listed = paths.filter((p) => p.startsWith("/site/") && p !== "/site/");
    expect(listed.length).toBeGreaterThan(0);
    for (const p of listed) {
      const page = site.get(p);
      expect(page?.kind).toBe("page");
      expect(page?.memberOnly).toBeUndefined();
    }
    expect(
      [...site.values()].some((p) => p.kind !== "page" && paths.includes(`/site/${p.stem}/`)),
    ).toBe(false);
  });
});

describe("pageMeta", () => {
  // Fails if: a page's own metadata drops the preview picture (Next replaces
  // the layout's openGraph wholesale) or its canonical address.
  it("keeps the canonical address and the preview picture on every page", () => {
    for (const meta of [
      pageMeta({ title: "t", path: "/x/" }),
      pageMeta({
        title: "t",
        path: "/x/1/",
        article: { authors: ["a"], publishedTime: undefined },
      }),
    ]) {
      expect(meta.alternates?.canonical).toMatch(/^\/x\//);
      expect(JSON.stringify(meta.openGraph)).toContain("/og.png");
      expect(JSON.stringify(meta.twitter)).toContain("/og.png");
    }
    const undated = pageMeta({ title: "t", path: "/x/1/", article: { authors: ["a"] } });
    expect(JSON.stringify(undated.openGraph)).not.toContain("publishedTime");
  });
});

describe("robots.txt and the pages.dev headers", () => {
  const robots = readFileSync(path.join(process.cwd(), "public", "robots.txt"), "utf8");
  const groups = robots.split(/\n\s*\n/);
  const blocked = groups.find((g) => g.includes("Disallow: /")) ?? "";

  // Fails if: search engines, AI search or a crawler that also feeds AI
  // answers is shut out, a training-only crawler is let in, or the sitemap
  // is not named on the public host.
  it("welcomes search and AI search, not AI training", () => {
    expect(robots).toMatch(/User-agent: \*\nContent-Signal: [^\n]*ai-train=no[^\n]*\nAllow: \//);
    for (const bot of ["GPTBot", "ClaudeBot", "CCBot"]) {
      expect(blocked).toContain(`User-agent: ${bot}\n`);
    }
    // Google-Extended and meta-externalagent also feed Gemini's and Meta AI's
    // answers: let in, as finding the museum comes first (2026-10-07).
    for (const bot of [
      "Googlebot",
      "Yeti",
      "Daumoa",
      "bingbot",
      "OAI-SearchBot",
      "Claude-SearchBot",
      "Google-Extended",
      "meta-externalagent",
    ]) {
      expect(blocked).not.toContain(bot);
    }
    expect(robots).toContain("Sitemap: https://forg.co.kr/sitemap.xml");
  });

  // Fails if: a preview deployment can be indexed, or the production alias
  // gets noindex beside its canonical to forg.co.kr.
  it("keeps previews out of search engines, the alias to its canonical", () => {
    const headers = readFileSync(path.join(process.cwd(), "public", "_headers"), "utf8");
    expect(headers).toMatch(
      /https:\/\/:version\.:project\.pages\.dev\/\*\n\s+X-Robots-Tag: noindex/,
    );
    expect(headers).not.toMatch(/^https:\/\/:project\.pages\.dev/m);
  });
});
