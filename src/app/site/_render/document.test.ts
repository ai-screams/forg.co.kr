import { describe, expect, it } from "vitest";

import type { SitePage, SitePageVersion } from "@/lib/site-pages";

import { renderSiteBar, renderSitePage } from "./document";

const PAGE: SitePage = {
  stem: "index",
  originalPath: "/index.htm",
  originalUrl: "http://forg.co.kr/index.htm",
  kind: "page",
  title: "forg.co.kr",
  capturedAt: "2016-07-26T20:13:24",
  versions: [
    { capturedAt: "2001-09-27T08:36:44", kind: "frameset", ts: "20010927083644" },
    { capturedAt: "2016-07-26T20:13:24", kind: "page" },
  ],
  css: "",
  bodyStyle: {},
  html: "<p>2016</p>",
  redirectTo: null,
  baseTarget: null,
  mode: "no-quirks",
};

const FRAMESET: SitePageVersion = {
  kind: "frameset",
  stem: "index",
  ts: "20010927083644",
  capturedAt: "2001-09-27T08:36:44",
  originalPath: "/index.htm",
  originalUrl: "http://forg.co.kr/index.htm",
  baseTarget: null,
  mode: "no-quirks",
  css: "",
  bodyStyle: {},
  html: '<frameset cols="1*, 790, 1*"><frame name="forg_t" src="/site/forg_t/20010803100551/"></frameset>',
};

describe("an older frameset capture", () => {
  // Fails if: the frameset is drawn as a page, loses its bar frame, or
  // invites search engines in.
  it("is the frameset as it was, under a museum bar frame", () => {
    const html = renderSitePage(PAGE, FRAMESET);
    expect(html).toContain(
      '<frameset rows="28,*" border="0" frameborder="0" framespacing="0"><frame src="/site/index/20010927083644/bar/"',
    );
    expect(html).toContain(FRAMESET.html);
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).not.toContain("<body");
  });

  // Fails if: the bar's links or picker move only the bar frame, or the bar
  // wraps onto lines the 28px frame cuts off.
  it("has a bar that moves the whole window", () => {
    const bar = renderSiteBar(PAGE, FRAMESET);
    expect(bar).toContain('<base target="_top">');
    expect(bar).toContain('onchange="top.location.href=this.value"');
    expect(bar).toContain('<option value="/site/index/20010927083644/" selected>');
    expect(bar).toContain("flex-wrap:nowrap!important");
  });
});

describe("a page", () => {
  // Fails if: the picker in a page goes through `top` (a page in a frame
  // would replace the frameset around it).
  it("keeps its picker on its own window", () => {
    expect(renderSitePage(PAGE)).toContain('onchange="location.href=this.value"');
  });
});

describe("for search engines", () => {
  // Fails if: the latest capture loses its public address, its description
  // or its preview picture, or the description carries markup.
  it("gives the latest capture its address, words and preview", () => {
    const html = renderSitePage({ ...PAGE, html: "<p>던전&amp;지도</p><p>안내</p>" });
    expect(html).toContain('<link rel="canonical" href="https://forg.co.kr/site/index/">');
    expect(html).toContain('<meta name="description" content="던전&amp;지도 안내">');
    expect(html).toContain('<meta property="og:image" content="https://forg.co.kr/og.png">');
    expect(html).not.toContain('content="noindex"');
    const pictures = renderSitePage({ ...PAGE, html: '<p><img src="/img/posts/site/a.gif"></p>' });
    expect(pictures).toContain(
      '<meta name="description" content="forg.co.kr — forg.co.kr 안내 페이지">',
    );
  });

  // Fails if: an older capture, a redirect or a member-only notice can be
  // indexed, or an older capture points anywhere but the latest's public address.
  it("keeps older captures, redirects and member-only notices out", () => {
    const older = renderSitePage(PAGE, {
      stem: "index",
      ts: "20021204185904",
      capturedAt: "2002-12-04T18:59:04",
      originalPath: "/index.htm",
      originalUrl: "http://forg.co.kr/index.htm",
      baseTarget: null,
      mode: "no-quirks",
      css: "",
      bodyStyle: {},
      html: "<p>2002</p>",
    });
    expect(older).toContain(
      '<link rel="canonical" href="https://forg.co.kr/site/index/"><meta name="robots" content="noindex">',
    );
    expect(older).not.toContain('<meta name="description"');
    const redirect = renderSitePage({ ...PAGE, kind: "redirect", redirectTo: "/site/faq/" });
    const member = renderSitePage({ ...PAGE, memberOnly: true });
    for (const html of [redirect, member]) {
      expect(html).toContain('<meta name="robots" content="noindex">');
      expect(html).not.toContain('rel="canonical"');
    }
  });
});
