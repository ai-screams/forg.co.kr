import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PolicyPage from "@/app/policy/page";
import { SiteFooter } from "@/components/site-footer";

describe("the copyright and takedown page", () => {
  // Fails if: the footer stops leading to the page, or the page loses the
  // address requests go to.
  it("is reached from every page's footer and gives the address for requests", () => {
    expect(renderToStaticMarkup(createElement(SiteFooter))).toContain('href="/policy/"');
    expect(renderToStaticMarkup(createElement(PolicyPage))).toContain(
      'href="mailto:commander@ai-scream.ai"',
    );
  });

  // Fails if: the page promises a response time (decided against, 2026-10-06).
  it("promises no response time", () => {
    const text = renderToStaticMarkup(createElement(PolicyPage)).replace(/<[^>]+>/g, "");
    expect(text).not.toMatch(/\d+\s*(시간|일|영업일)\s*(안|이내)|즉시/);
  });
});
