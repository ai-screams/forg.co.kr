import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { SiteHeader } from "@/components/site-header";

// Fails if: below 400px the search link loses its word for screen readers
// (`max-[400px]:sr-only` dropped), shows the word beside the magnifier, or the
// magnifier is read aloud or shown from 400px up.
it("reads the search link as 검색 when it is a magnifier below 400px", () => {
  const html = renderToStaticMarkup(createElement(SiteHeader));
  const link = /<a href="\/search\/"[^>]*>([\s\S]*?)<\/a>/.exec(html)?.[1] ?? "";
  expect(link).toMatch(/<svg aria-hidden="true"[^>]* class="size-5 min-\[400px\]:hidden"/);
  expect(link).toContain('<span class="max-[400px]:sr-only">검색</span>');
});
