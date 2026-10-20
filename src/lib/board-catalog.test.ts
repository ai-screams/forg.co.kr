import { describe, expect, it } from "vitest";

import { boardSummaries, datedRow, museumTotals } from "@/lib/board-catalog";
import { listBoards } from "@/lib/boards";
import { getAllPostParams } from "@/lib/posts";
import { getAllSitePages } from "@/lib/site-pages";
import type { BoardIndexEntry } from "@/types/post";

describe("board summaries", () => {
  // Fails if: a board's index rows carried in from the board it continues
  // count for it too (UoBoard's posts counted again under UoBoard2).
  it("counts every post once, under its own board", async () => {
    expect((await museumTotals()).posts).toBe((await getAllPostParams()).length);
  });

  // Fails if: UoBoard2's years take in the UoBoard rows it carries (from 2000).
  it("dates a board by its own rows", async () => {
    const years = (await boardSummaries()).get("UoBoard2")?.years;
    expect(years?.[0]).toBeGreaterThanOrEqual(2010);
  });

  // Fails if: the front page counts only the boards with an index (71),
  // while its button opens /boards/, which lists every board.
  it("counts every board, as /boards/ lists them", async () => {
    expect((await museumTotals()).boards).toBe(listBoards().length);
  });

  // Fails if: the redirect pages count as guide pages (the /site/ list leaves them out).
  it("counts the guide pages /site/ lists", async () => {
    const all = await getAllSitePages();
    const redirects = all.filter((p) => p.kind === "redirect").length;
    expect((await museumTotals()).guidePages + redirects).toBe(all.length);
  });
});

// Fails if: any stand-in date counts as a post's own year: the 1970
// placeholder, the first comment's time, a capture's day, a list's MM/DD.
it("takes a year only from a row's own date", () => {
  const row = {
    createdAt: "2003-04-27T00:52:00",
    createdAtApprox: false,
    yearApprox: false,
  } as BoardIndexEntry;
  expect(datedRow(row)).toBe(true);
  expect(datedRow({ ...row, createdAt: "1970-01-01T09:00:00" })).toBe(false);
  expect(datedRow({ ...row, createdAtApprox: true })).toBe(false);
  expect(datedRow({ ...row, datedByCapture: true })).toBe(false);
  expect(datedRow({ ...row, yearApprox: true })).toBe(false);
});
