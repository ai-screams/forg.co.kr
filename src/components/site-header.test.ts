import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { SiteHeader } from "@/components/site-header";
import { ERAS } from "@/lib/era";
import { cssRules } from "@/styles/css-rules";

// Fails if: below 410px the search link loses its word for screen readers
// (`max-[410px]:sr-only` dropped), shows the word beside the magnifier, or the
// magnifier is read aloud or shown from 410px up.
it("reads the search link as 검색 when it is a magnifier below 410px", () => {
  const html = renderToStaticMarkup(createElement(SiteHeader));
  const link = /<a href="\/search\/"[^>]*>([\s\S]*?)<\/a>/.exec(html)?.[1] ?? "";
  expect(link).toMatch(/<svg aria-hidden="true"[^>]* class="size-5 min-\[410px\]:hidden"/);
  expect(link).toContain('<span class="max-[410px]:sr-only">검색</span>');
});

// Fails if: below 360px the four buttons are not folded away (the toggle's
// `max-[360px]:hidden` dropped) or the fold misses an era, its summary does
// not name the era shown, or the fold shows from 360px up.
it("folds the era buttons into one control below 360px", () => {
  const html = renderToStaticMarkup(createElement(SiteHeader));
  expect(html).toMatch(
    /<div role="group" aria-label="디자인 시기 전환" class="[^"]* max-\[360px\]:hidden"/,
  );
  const fold = /<details class="forg-era-fold">([\s\S]*?)<\/details>/.exec(html)?.[1] ?? "";
  const summary = /<summary>([\s\S]*?)<\/summary>/.exec(fold)?.[1] ?? "";
  for (const era of ERAS) {
    expect(summary).toContain(`<b class="era-${era}-only">${era}</b>`);
    expect(fold).toMatch(
      new RegExp(`<button type="button" aria-pressed="(true|false)" data-era-option="${era}">`),
    );
  }
  const shown = cssRules("base.css").filter(
    (r) => r.selectors.includes(".forg-era-fold") && /display:\s*none/.test(r.body),
  );
  expect(shown.map((r) => r.at.at(-1))).toEqual(["@media (width >= 360px)"]);
});

// Fails if: the open fold's panel sits at or below the first-visit hint's
// layer, where the hint, later in the header, covers its buttons on a phone.
it("lays the open fold's buttons above the first-visit hint", () => {
  const html = renderToStaticMarkup(createElement(SiteHeader));
  const hint = /<div role="note" class="forg-era-hint [^"]* z-(\d+) /.exec(html)?.[1];
  const panel = cssRules("base.css").find((r) => r.selectors.includes(".forg-era-fold > div"));
  const z = /z-index:\s*(\d+)/.exec(panel?.body ?? "")?.[1];
  expect(Number(z)).toBeGreaterThan(Number(hint));
});
