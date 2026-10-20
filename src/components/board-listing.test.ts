import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BoardCrumb, BoardNotes } from "@/components/board-info";
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
    createElement(BoardListing, {
      board: "HouseScreenshot",
      page: page(totalWithPost),
      listing: totalWithPost === 0 ? LISTING : null,
    }),
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
    const phone = (html: string) =>
      /<ul class="forg-narrow-list[^>]*>([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? "";
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

describe("the 2026 head", () => {
  type Entry = BoardIndexPage["entries"][number];
  function head(board: "Notice" | "HouseScreenshot", entries: Partial<Entry>[] = [{}]): string {
    const base = page(12);
    const html = renderToStaticMarkup(
      createElement(BoardListing, {
        board,
        page: {
          ...base,
          board,
          entries: entries.map((e, i) => ({ ...base.entries[0]!, postId: String(i + 1), ...e })),
        },
        listing: null,
      }),
    );
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    return /<div class="era-2026-only forg-board-head">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "";
  }

  // Fails if: the head loses the board's description or its notes, a board
  // without a description gets an empty paragraph, or the page a second h1.
  it("carries the board's description and notes under the one h1", () => {
    expect(head("Notice")).toContain("<p>UO 패치 노트와 운영 공지</p>");
    expect(head("Notice")).toContain("전체 346개");
    expect(head("HouseScreenshot")).not.toContain("<p></p>");
  });

  // Fails if: the key to a date mark shows on a page without that mark, or
  // is missing on a page with it.
  it("explains only the date marks the page has", () => {
    expect(head("Notice")).not.toMatch(/[≤≈]/);
    expect(head("Notice", [{ datedByCapture: true }])).toMatch(/≤ 작성일이 남지 않아/);
    expect(head("Notice", [{ datedByCapture: true }])).not.toContain("≈");
    expect(head("Notice", [{ yearApprox: true }])).toMatch(/≈ 목록에 월\/일만/);
    expect(head("Notice", [{ yearApprox: true }])).not.toContain("≤");
    expect(head("Notice", [{ createdAtApprox: true }, { yearApprox: true }])).toMatch(
      /대신함<\/span> · <span>≈/,
    );
  });

  // Fails if: the museum bar's (i) loses the class 2026 hides it by.
  it("marks the museum bar's (i) for 2026 to hide", () => {
    const crumb = renderToStaticMarkup(
      BoardCrumb({ meta: { nameKr: "공지사항" }, children: null }),
    );
    expect(crumb).toMatch(
      /<button type="button" popoverTarget="forg-board-info"[^>]* class="forg-crumb-info /,
    );
  });
});
