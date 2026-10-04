import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InertJumpMenu } from "@/components/chrome-primitives";

/** What a screen reader hears for a jump menu to these sites. */
function note(sites: string[]): string | undefined {
  const html = renderToStaticMarkup(
    createElement(InertJumpMenu, {
      id: "n",
      label: "Family Site",
      options: sites,
      sites,
      className: "",
    }),
  );
  return /<span id="n" class="sr-only">(.*?)<\/span>/.exec(html)?.[1];
}

describe("InertJumpMenu", () => {
  it("names the sites and counts them in Korean", () => {
    expect(note(["Zeme", "Kritz", "Cindee"])).toBe(
      "Family Site 목록: Zeme, Kritz, Cindee. 세 사이트 모두 사라져 이동할 수 없습니다.",
    );
    expect(note(["a", "b", "c", "d", "e", "f", "g"])).toMatch(/\. 일곱 사이트 모두/);
  });

  it("falls back to digits past ten", () => {
    expect(note(Array.from({ length: 12 }, (_, i) => String(i)))).toMatch(/\. 12 사이트 모두/);
  });
});
