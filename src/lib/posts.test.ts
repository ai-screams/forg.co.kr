import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isBoardId, type BoardId } from "@/lib/boards";
import {
  getAdjacentPosts,
  getBoardIndex,
  getBoardView,
  getListOnlyRecord,
  getRecentPostEntries,
} from "@/lib/posts";
import type { BoardIndexEntry } from "@/types/post";

// Over the real index: a board's own notices lead page 1 (03-build-index.py
// `index_order`), and these readers must not follow them there.

const BOARDS = readdirSync(join(process.cwd(), "src", "content", "boards")).filter(
  (b): b is BoardId => isBoardId(b),
);

async function allEntries(board: BoardId): Promise<BoardIndexEntry[]> {
  const first = await getBoardIndex(board, 1);
  if (!first) return [];
  const pages = [first];
  for (let p = 2; p <= first.totalPages; p++) {
    const page = await getBoardIndex(board, p);
    if (page) pages.push(page);
  }
  return pages.flatMap((p) => p.entries);
}

describe("getRecentPostEntries", () => {
  // Fails if: the result keeps the index's order (pinned notices first), or
  // stops reading pages once pinned notices alone fill the count.
  it("gives each board's newest kept posts, newest first", async () => {
    for (const board of BOARDS) {
      const { entries } = await getRecentPostEntries(board, 8);
      const dates = entries.map((e) => e.createdAt);
      expect(dates, board).toEqual([...dates].sort().reverse());
      const oldest = dates.at(-1);
      if (oldest === undefined) continue;
      const newer = (await allEntries(board)).filter((e) => e.hasPost && e.createdAt > oldest);
      expect(
        entries.map((e) => e.postId),
        board,
      ).toEqual(expect.arrayContaining(newer.map((e) => e.postId)));
    }
  });
});

/** Newest first: the date, then the post number among rows of one date. */
function rank(e: BoardIndexEntry): [string, number] {
  return [e.createdAt, /^\d+$/.test(e.postId) ? Number(e.postId) : 0];
}

function newer(a: BoardIndexEntry, b: BoardIndexEntry): boolean {
  const [da, na] = rank(a);
  const [db, nb] = rank(b);
  return da > db || (da === db && na > nb);
}

describe("getAdjacentPosts", () => {
  // Fails if: the sequence keeps the index's order, so a pinned notice's
  // 다음글 is missing and its 이전글 is newer than it; or rows of one date
  // are not ordered by number, so undated Role 1 lands before Role's other
  // 1970 rows.
  it("puts a pinned notice between the posts of its date", async () => {
    let checked = 0;
    for (const board of BOARDS) {
      const first = await getBoardIndex(board, 1);
      const pinned = first?.entries.filter((e) => e.isNotice && !e.board && e.hasPost) ?? [];
      for (const notice of pinned) {
        const { prev, next } = await getAdjacentPosts(board, notice.postId);
        if (next) expect(newer(next, notice), `${board}/${notice.postId}`).toBe(true);
        if (prev) expect(newer(notice, prev), `${board}/${notice.postId}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("getListOnlyRecord", () => {
  // Fails if: a board with posts gets a list record, or a list-only board
  // loses it (the museum bar's "목록 N쪽(캡처 M번)").
  it("gives the list pages of a board known only from them", async () => {
    for (const board of BOARDS) {
      const view = await getBoardView(board);
      if (view.kind !== "index") continue;
      const record = await getListOnlyRecord(board, view.page);
      expect(record !== null, board).toBe(view.page.totalWithPost === 0);
    }
    const house = await getBoardView("HouseScreenshot");
    expect(house.kind === "index" && house.listing?.entries.length).toBe(346);
  });
});
