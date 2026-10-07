import { describe, expect, it } from "vitest";

import { withFullSizeLinks } from "@/lib/full-size-links";

const TITLE = ' title="클릭하면 원본을 볼수 있습니다."';
const recovered = (file: string) =>
  `<img border="0" data-original-src="http://forg.co.kr/_zb/data/${file}" data-recovery="ok" src="https://img.example/posts/Notice/653/${file}">`;
const failed = (file: string) =>
  `<img border="0" data-original-src="http://forg.co.kr/_zb/data/${file}" data-recovery="failed" src="/img/placeholder/missing.svg">`;

describe("withFullSizeLinks", () => {
  // Fails if: the link around a recovered picture still points at the old
  // board folder (a 404 under the post's address) instead of the copy.
  it("points a recovered picture's link at its copy", () => {
    expect(withFullSizeLinks(`<a href="data/a.jpg"${TITLE}>${recovered("a.jpg")}</a>`)).toBe(
      `<a href="https://img.example/posts/Notice/653/a.jpg"${TITLE}>${recovered("a.jpg")}</a>`,
    );
  });

  // Fails if: the link around a picture Wayback never kept still leads to a
  // 404, or the anchor or the placeholder goes with it.
  it("drops the address around a picture that was not recovered", () => {
    expect(withFullSizeLinks(`<a href="data/b.jpg"${TITLE}>${failed("b.jpg")}</a>`)).toBe(
      `<a${TITLE}>${failed("b.jpg")}</a>`,
    );
  });

  // Fails if: a link to another file, to another site or to a museum path is
  // changed — only the picture's own file is the same thing — or a recovered
  // picture without a `src` gives its link an empty address.
  it("leaves every other link as the post had it", () => {
    for (const html of [
      `<a href="data/big.jpg">${recovered("small.jpg")}</a>`,
      `<a href="http://guide.uo.com/a.jpg">${failed("a.jpg")}</a>`,
      `<a href="/UoBoard/1/">${recovered("a.jpg")}</a>`,
      `<a href="data/a.jpg"><img src="/img/emoticon/a.jpg"></a>`,
      `<a href="data/a.jpg"><img data-original-src="http://forg.co.kr/_zb/data/a.jpg" data-recovery="ok"></a>`,
    ]) {
      expect(withFullSizeLinks(html)).toBe(html);
    }
  });
});
