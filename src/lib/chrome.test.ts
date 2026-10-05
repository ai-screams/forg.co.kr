import { createHash } from "node:crypto";

import { describe, expect, test, vi } from "vitest";

// Controlled pools instead of the repository's public/img/chrome, so a newly
// recovered picture cannot break these tests. Keys are paths under it.
const POOLS: Record<string, string[]> = {
  "": ["shared.gif", "flat-only.gif", "empty.gif", ".DS_Store"],
  "2014": ["shared.gif"],
  "2003": [],
  "2001": [],
};

vi.mock("node:fs", () => {
  const under = (path: string) => path.split("/public/img/chrome").pop()?.replace(/^\//, "") ?? "";
  return {
    readdirSync: (dir: string) => {
      const files = POOLS[under(dir)];
      if (!files) throw new Error(`ENOENT ${dir}`);
      return files;
    },
    statSync: (path: string) => ({ isFile: () => true, size: path.endsWith("empty.gif") ? 0 : 1 }),
    // Each file's bytes name the file, so files at different paths differ.
    readFileSync: (path: string) => Buffer.from(`bytes of ${under(path)}`),
  };
});

/** The URL the lookup should give: the path and its bytes' hash. */
const v = (path: string) =>
  `${path}?v=${createHash("sha256")
    .update(`bytes of ${path.replace(/^\/img\/chrome\//, "")}`)
    .digest("hex")
    .slice(0, 10)}`;

const { chromeUrl, optionalChrome, tileStyle } = await import("@/lib/chrome");

describe("chrome lookup", () => {
  test("an era's own capture comes first", () => {
    expect(chromeUrl("shared.gif", "2014")).toBe(v("/img/chrome/2014/shared.gif"));
  });

  test("without one, the flat pool", () => {
    expect(chromeUrl("shared.gif", "2003")).toBe(v("/img/chrome/shared.gif"));
    expect(chromeUrl("flat-only.gif")).toBe(v("/img/chrome/flat-only.gif"));
  });

  test("a name that is not there stops the build", () => {
    expect(() => chromeUrl("missing.gif", "2014")).toThrow(/missing\.gif \(2014\)/);
  });

  test("an empty file or a dotfile does not count as recovered", () => {
    expect(optionalChrome("empty.gif")).toBeNull();
    expect(optionalChrome(".DS_Store")).toBeNull();
  });

  test("art Wayback never kept is asked for with optionalChrome", () => {
    expect(optionalChrome("missing.gif", "2014")).toBeNull();
    expect(optionalChrome("shared.gif", "2014")).toBe(v("/img/chrome/2014/shared.gif"));
  });
});

describe("chrome version", () => {
  // Safari draws a picture on reload only after revalidating it unless it is
  // immutable; the version is what makes a year-long immutable cache safe.
  test("the URL carries a hash of the file's bytes, different bytes a different one", () => {
    const era = chromeUrl("shared.gif", "2014");
    const flat = chromeUrl("shared.gif", "2003");
    expect(era).toMatch(/^\/img\/chrome\/2014\/shared\.gif\?v=[0-9a-f]{10}$/);
    expect(era.split("?v=")[1]).not.toBe(flat.split("?v=")[1]);
  });
});

describe("tileStyle", () => {
  test("no picture, no style", () => {
    expect(tileStyle(null)).toBeUndefined();
  });

  test("absent repeat and position are left out, not undefined", () => {
    expect(tileStyle("/a.gif")).toStrictEqual({ backgroundImage: "url(/a.gif)" });
    expect(tileStyle("/a.gif", "repeat-x", "left center")).toStrictEqual({
      backgroundImage: "url(/a.gif)",
      backgroundRepeat: "repeat-x",
      backgroundPosition: "left center",
    });
  });
});
