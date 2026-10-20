import { readFileSync } from "node:fs";
import path from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PolicyPage from "@/app/policy/page";
import { SiteFooter } from "@/components/site-footer";

/** A response time: a span with 안·이내·내·까지·만에, or a word for "at once". */
const DEADLINE =
  /(\d+\s*(시간|영업일|일|주일|주|개월|달|h|hours?|days?)|하루|이틀|사흘|나흘|닷새|열흘|일주일|(한|두|세)\s*(주|달))\s*(안|이내|내|까지|만에)|즉시|곧바로|당일|신속/;

function pageText(): string {
  return renderToStaticMarkup(createElement(PolicyPage)).replace(/<[^>]+>/g, "");
}

/** The sections of a markdown file whose heading names takedowns or policy. */
function takedownSections(file: string): string {
  const lines = readFileSync(path.join(process.cwd(), file), "utf8").split("\n");
  const kept: string[] = [];
  let level = 0;
  for (const line of lines) {
    const heading = /^(#+) (.*)$/.exec(line);
    if (heading?.[1] && heading[2] !== undefined) {
      const depth = heading[1].length;
      if (/삭제|Takedown|정책/.test(heading[2])) level = depth;
      else if (level && depth <= level) level = 0;
    }
    if (level) kept.push(line);
  }
  return kept.join("\n");
}

describe("the copyright and takedown page", () => {
  // Fails if: the footer stops leading to the page, or the page loses the
  // address requests go to.
  it("is linked from the footer and gives the address for requests", () => {
    expect(renderToStaticMarkup(createElement(SiteFooter))).toContain('href="/policy/"');
    expect(renderToStaticMarkup(createElement(PolicyPage))).toContain(
      'href="mailto:commander@ai-scream.ai"',
    );
  });

  // Fails if: the 2026 fonts' row goes, or loses their names or the licence
  // it links to (public/fonts/OFL.txt).
  it("names the 2026 fonts, their holders and their licence", () => {
    const html = renderToStaticMarkup(createElement(PolicyPage));
    const row =
      /<tr><th scope="row"[^>]*>2026 모습의 글꼴<\/th><td[^>]*>([\s\S]*?)<\/td><\/tr>/.exec(
        html,
      )?.[1];
    expect(row).toMatch(/IBM Plex Sans KR[\s\S]*Do Hyeon[\s\S]*D2Coding/);
    expect(row).toContain("SIL Open Font License 1.1");
    expect(row).toContain('href="/fonts/OFL.txt"');
  });

  // Fails if: the page, or the takedown part of CONTENT-NOTICE or README,
  // promises a response time (decided against, 2026-10-06).
  it("promises no response time, here or in CONTENT-NOTICE and README", () => {
    expect(pageText()).not.toMatch(DEADLINE);
    for (const file of ["CONTENT-NOTICE.md", "README.md"]) {
      const sections = takedownSections(file);
      expect(sections).toContain("commander@ai-scream.ai");
      expect(sections).not.toMatch(DEADLINE);
    }
  });
});
