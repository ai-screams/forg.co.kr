import { describe, expect, it } from "vitest";

import { generateStaticParams, GET } from "./route";

// Over the real pages: the front page's older framesets (02g) and their bar frames.

async function get(path: string[]): Promise<string> {
  const res = await GET(new Request("http://localhost/"), { params: Promise.resolve({ path }) });
  return res.text();
}

describe("/site/ older frameset captures", () => {
  // Fails if: a frameset capture gets no bar document, or a page capture gets one.
  it("writes a bar document for each older frameset, and only for those", async () => {
    const paths = (await generateStaticParams()).map((p) => p.path.join("/"));
    expect(paths).toContain("index/20010927083644/index.html");
    expect(paths).toContain("index/20010927083644/bar/index.html");
    expect(paths).toContain("index/20010301213553/index.html");
    expect(paths).not.toContain("index/20010301213553/bar/index.html");
  });

  // Fails if: the route reads `bar` as part of the stem or the capture time.
  it("serves the frameset at its address and the bar at /bar/", async () => {
    const frameset = await get(["index", "20010927083644", "index.html"]);
    expect(frameset).toContain('src="/site/index/20010927083644/bar/"');
    const bar = await get(["index", "20010927083644", "bar", "index.html"]);
    expect(bar).toContain('id="forg-museum-bar"');
    expect(bar).toContain('<base target="_top">');
  });

  // Fails if: a stem ending in `bar` (no capture time before it) is read as
  // a bar frame, which throws instead of a plain not-found.
  it("takes `bar` for a bar frame only after a capture time", async () => {
    const res = await GET(new Request("http://localhost/"), {
      params: Promise.resolve({ path: ["index", "bar", "index.html"] }),
    });
    expect(res.status).toBe(404);
  });
});
