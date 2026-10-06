import { describe, expect, it } from "vitest";

import { generateMetadata } from "./page";

async function meta(board: string, postId: string) {
  return generateMetadata({ params: Promise.resolve({ board, postId }) });
}

describe("a post's metadata", () => {
  // Fails if: a post loses its public canonical path, or a post of pictures
  // alone (no text) goes to search engines without a description.
  it("gives every post its address and a description", async () => {
    const text = await meta("UoBoard", "26397");
    expect(text.alternates?.canonical).toBe("/UoBoard/26397/");
    expect(text.description).toContain("샤워");
    const pictures = await meta("ScreenShot", "5979");
    expect(pictures.description).toBe("스크린샷에 올라온 글 — forg.co.kr");
  });
});
