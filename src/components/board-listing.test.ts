import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BoardNotes } from "@/components/board-info";
import { BoardListing } from "@/components/board-listing";
import type { BoardIndexPage, BoardListing as Listing } from "@/types/post";

// A board known only from its captured list pages is indexed like any other
// (03-build-index.py `board_names`); these pin what it keeps of its old view.

function page(totalWithPost: number): BoardIndexPage {
  return {
    board: "HouseScreenshot",
    page: 2,
    totalPages: 7,
    totalPosts: 346,
    totalWithPost,
    generatedAt: "2026-10-06T00:00:00Z",
    entries: [
      {
        postId: "1203",
        title: "집 구경 오세요",
        categoryLabel: null,
        author: "lee",
        authorMemberNo: null,
        createdAt: "2004-03-01T00:00:00",
        createdAtApprox: false,
        yearApprox: false,
        commentCount: 0,
        attachmentCount: 0,
        hits: 1234,
        recommend: null,
        era: "2003",
        hasPost: totalWithPost > 0,
      },
    ],
  };
}

const LISTING: Listing = {
  board: "HouseScreenshot",
  engine: "zeroboard",
  pagesCaptured: 7,
  capturesRead: 9,
  totalReported: 350,
  generatedAt: "2026-10-06T00:00:00Z",
  entries: [],
};

function render(totalWithPost: number): string {
  return renderToStaticMarkup(
    createElement(BoardListing, { board: "HouseScreenshot", page: page(totalWithPost) }),
  );
}

describe("a list-only board's index", () => {
  // Fails if: the 조회 column is dropped for a board known only from its
  // lists, or kept for a board with posts (ADR-0016 §5).
  it("keeps the 조회 column only where every row came from a list", () => {
    expect(render(0)).toContain("zb_kritz_title_hit.gif");
    expect(render(0)).toContain("1,234");
    expect(render(12)).not.toContain("zb_kritz_title_hit.gif");
  });

  // Fails if: the phone list prints 조회 on a board with posts.
  it("prints hits on the phone list only for a list-only board", () => {
    const phone = (html: string) => /<ul[^>]*>([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? "";
    expect(phone(render(0))).toContain("조회 1,234");
    expect(phone(render(12))).not.toContain("조회");
  });

  it("pages like any board", () => {
    expect(render(0)).toContain("2 / 7");
  });
});

describe("BoardNotes", () => {
  // Fails if: a list-only board loses where its rows came from, or a board
  // with posts shows a list record.
  it("tells where a list-only board's rows came from, else the counts", () => {
    const listOnly = renderToStaticMarkup(
      createElement(BoardNotes, { board: "HouseScreenshot", page: page(0), listing: LISTING }),
    );
    expect(listOnly).toContain("목록 7쪽(캡처 9번)에서");
    expect(listOnly).toContain("원본 표기 전체 350개");
    const withPosts = renderToStaticMarkup(
      createElement(BoardNotes, { board: "HouseScreenshot", page: page(12), listing: null }),
    );
    expect(withPosts).toContain("전체 346개");
    expect(withPosts).not.toContain("목록 7쪽");
  });
});
