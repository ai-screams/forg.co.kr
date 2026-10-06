import { describe, expect, it } from "vitest";

import { withAltText } from "@/lib/img-alt";

describe("withAltText", () => {
  // Fails if: an emoticon is described, a lost picture is not said to be
  // lost, a recovered one does not get the caller's words, or a self-closing
  // tag or another attribute is damaged.
  it("describes each kind of picture that had no alt", () => {
    expect(withAltText('<img src="/img/emoticon/a.gif" border="0">', "글")).toBe(
      '<img alt="" src="/img/emoticon/a.gif" border="0">',
    );
    expect(
      withAltText('<img data-recovery="failed" src="/img/placeholder/missing.svg"/>', "글"),
    ).toBe('<img alt="남지 않은 그림" data-recovery="failed" src="/img/placeholder/missing.svg"/>');
    expect(withAltText("<img src='/img/posts/UoBoard/1/a.jpg'>", "던전 지도의 그림")).toBe(
      "<img alt=\"던전 지도의 그림\" src='/img/posts/UoBoard/1/a.jpg'>",
    );
  });

  // Fails if: an original alt is replaced, the Wayback address is read as the
  // picture's source, or a title's quote breaks out of the attribute.
  it("keeps what the original said and escapes the caller's words", () => {
    expect(withAltText('<img alt="원본" src="/img/posts/a.jpg">', "x")).toBe(
      '<img alt="원본" src="/img/posts/a.jpg">',
    );
    expect(
      withAltText('<img data-original-src="http://x/e.gif" src="/img/emoticon/e.gif">', "x"),
    ).toContain('alt=""');
    // A lost emoticon is still decoration, not a lost picture.
    expect(
      withAltText(
        '<img data-original-src="http://forg.co.kr/_zb/emoticon/a.gif" data-recovery="failed" src="/img/placeholder/missing.svg">',
        "x",
      ),
    ).toContain('alt=""');
    expect(withAltText('<img src="/img/posts/a.jpg">', 'say "hi" <b>')).toContain(
      'alt="say &quot;hi&quot; &lt;b>"',
    );
  });
});
