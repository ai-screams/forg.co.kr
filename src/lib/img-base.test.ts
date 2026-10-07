import { afterEach, describe, expect, it, vi } from "vitest";

// The host is read when the module loads, so each case loads it afresh.
async function load(base: string) {
  vi.stubEnv("NEXT_PUBLIC_IMG_BASE", base);
  vi.resetModules();
  return import("@/lib/img-base");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the image host", () => {
  // Fails if: a space or a trailing slash around the configured host reaches
  // a picture's address.
  it("is trimmed before it joins a picture's path", async () => {
    const { postImageUrl, withImgBase } = await load(" https://img.example/ ");
    expect(postImageUrl("/img/posts/A/1/a.jpg")).toBe("https://img.example/posts/A/1/a.jpg");
    expect(withImgBase('<img src="/img/posts/A/1/a.jpg">')).toBe(
      '<img src="https://img.example/posts/A/1/a.jpg">',
    );
  });

  // Fails if: without a host the picture leaves the public address.
  it("falls back to the museum's own address", async () => {
    const { postImageUrl } = await load("");
    expect(postImageUrl("/img/posts/A/1/a.jpg")).toBe("https://forg.co.kr/img/posts/A/1/a.jpg");
  });
});
