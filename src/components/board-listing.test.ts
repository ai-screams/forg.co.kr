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

  // Fails if: the page links lose the hook 2026 gives its 44px targets and
  // digits by, or the board's name is a screen reader's alone in 2026 too.
  it("pages like any board", () => {
    expect(render(0)).toContain("2 / 7");
    expect(render(0)).toMatch(/<nav aria-label="페이지 네비게이션" class="forg-pages /);
    expect(render(0)).toMatch(/<h1 class="forg-sr-except-2026">/);
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

/** A list-only board's record whose rows came from these captures, a row each. */
function capturedAt(stamps: string[]): Listing {
  return {
    ...LISTING,
    entries: stamps.map((ts, i) => ({
      no: String(i + 1),
      title: "집 구경 오세요",
      categoryLabel: null,
      author: "lee",
      authorMemberNo: null,
      createdAt: null,
      yearApprox: false,
      hits: null,
      commentCount: 0,
      isNotice: false,
      capturedAt: ts,
      listPage: 1,
      hasPost: false,
    })),
  };
}

/** The notes' line naming the captures. */
function sources(stamps: string[]): string | undefined {
  const html = renderToStaticMarkup(
    createElement(BoardNotes, {
      board: "HouseScreenshot",
      page: page(0),
      listing: capturedAt(stamps),
    }),
  );
  return /출처: Wayback Machine 목록 캡처 ([^<]*)</.exec(html)?.[1];
}

describe("the captures a list-only board's rows came from", () => {
  // Fails if: a day is named once per capture, a capture once per row, a
  // single capture gets a count, or the days are out of order.
  it("names each day once, with its count of captures when several", () => {
    const rows = ["20071031120000", "20031118010000", "20031118010000", "20031118020000"];
    expect(sources([...rows, "20030516000000", "20031118030000", "20071031130000"])).toBe(
      "2003.05.16 · 2003.11.18 (3번) · 2007.10.31 (2번)",
    );
  });

  // Fails if: more than six days are named one by one, so the notes grow with
  // every capture the ETL finds (2026 puts them in the board's head, which the
  // page-weight check bounds), or six days are cut short.
  it("gives the first and last day and the counts beyond six days", () => {
    const day = (d: number) => `200301${String(d).padStart(2, "0")}`;
    const forty = Array.from(
      { length: 40 },
      (_, i) => `${day((i % 12) + 1)}00${String(i).padStart(2, "0")}00`,
    );
    expect(sources(forty)).toBe("2003.01.01 – 2003.01.12 · 12일, 40번");
    const six = Array.from({ length: 6 }, (_, i) => `${day(i + 1)}000000`);
    expect(sources(six)).toBe(
      "2003.01.01 · 2003.01.02 · 2003.01.03 · 2003.01.04 · 2003.01.05 · 2003.01.06",
    );
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
