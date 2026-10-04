import { describe, expect, test } from "vitest";

import { boardSkin, captureSkin, isHot } from "@/lib/skins";

describe("skin from engine", () => {
  test.each([
    ["zeroboard", "kritz"],
    ["gnuboard4", "webbus"],
    ["gnuboard5", "plain"],
  ] as const)("%s → %s", (engine, skin) => {
    expect(boardSkin({ engine })).toBe(skin);
    expect(captureSkin({ sourceEngine: engine })).toBe(skin);
  });
});

describe("Gnuboard4 hot rows", () => {
  test("UoBoard2 is hot from 100 hits (its hotHits)", () => {
    expect(isHot("UoBoard2", 99)).toBe(false);
    expect(isHot("UoBoard2", 100)).toBe(true);
  });

  test("other boards from 500", () => {
    expect(isHot("FunBoard", 499)).toBe(false);
    expect(isHot("FunBoard", 500)).toBe(true);
  });
});
