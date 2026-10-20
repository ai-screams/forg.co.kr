import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { indexRows } from "@/components/board-rows";
import { DATE_APPROX, type ListRow } from "@/components/list-row";
import { ListTable } from "@/components/list-skin";
import { ListTable2001 } from "@/components/list-skin-2001";
import type { ListSkin } from "@/lib/skins";
import type { Skin2001 } from "@/lib/skins-2001";
import type { BoardIndexPage } from "@/types/post";

// Each mark below is pinned by a mutation that turns its test red: dropping
// it, drawing it for another skin, or losing the depth.

type IndexEntry = BoardIndexPage["entries"][number];

function indexEntry(postId: string, extra: Partial<IndexEntry> = {}): IndexEntry {
  return {
    postId,
    title: `글 ${postId}`,
    categoryLabel: null,
    author: "kim",
    authorMemberNo: null,
    createdAt: "2003-05-01T10:00:00",
    createdAtApprox: false,
    yearApprox: false,
    commentCount: 0,
    attachmentCount: 0,
    hits: 10,
    recommend: null,
    era: "2003",
    hasPost: true,
    ...extra,
  };
}

function page(entries: IndexEntry[]): BoardIndexPage {
  return {
    board: "Q_A",
    page: 1,
    totalPages: 1,
    totalPosts: entries.length,
    totalWithPost: entries.length,
    generatedAt: "2026-10-06T00:00:00Z",
    entries,
  };
}

const ROWS_INDEX = [
  indexEntry("1", { isNotice: true }),
  indexEntry("9", { replyDepth: 2 }),
  indexEntry("8"),
];

function table(skin: ListSkin, rows: ListRow[]): string {
  return renderToStaticMarkup(
    createElement(ListTable, {
      skin,
      rows,
      withHits: true,
      firstNumber: 100,
      era2001: { skin: "skyblue", totalPosts: 3, page: 1, totalPages: 1 },
    }),
  );
}

/** The desktop table's body rows (not the phone list or the 2001 view). */
function tableRows(html: string): string[] {
  const body =
    /<tbody>([\s\S]*?)<\/tbody>/.exec(html.slice(html.indexOf("forg-skin-table")))?.[1] ?? "";
  return body.split("</tr>").filter((r) => r.includes("<tr"));
}

function rows2001(skin: Skin2001, rows: ListRow[]): string[] {
  const html = renderToStaticMarkup(
    createElement(ListTable2001, {
      skin,
      rows,
      firstNumber: 100,
      totalPosts: 3,
      page: 1,
      totalPages: 1,
    }),
  );
  const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(html)?.[1] ?? "";
  return body.split("</tr>").filter((r) => r.includes("h-[20px]"));
}

describe("list rows", () => {
  it("carry an index row's notice and reply marks", () => {
    const rows = indexRows("Q_A", page(ROWS_INDEX), "kritz");
    expect(rows.map((r) => [r.notice, r.replyDepth])).toEqual([
      [true, 0],
      [false, 2],
      [false, 0],
    ]);
  });
});

describe("kritz table", () => {
  const [notice, reply, plain] = tableRows(
    table("kritz", indexRows("Q_A", page(ROWS_INDEX), "kritz")),
  );

  it("greys a notice's row and puts list_notice.gif in its status cell", () => {
    expect(notice).toContain("bg-kritz-notice-row");
    expect(notice).toContain("zb_kritz_list_notice.gif");
  });

  it("puts reply_head.gif in a reply's status cell, and no Gnuboard icon", () => {
    expect(reply).toContain("zb_kritzn_reply_head.gif");
    expect(reply).not.toContain("bg-kritz-notice-row");
    expect(reply).not.toContain("gb_icon_reply.gif");
  });

  it("leaves a post's status cell blank", () => {
    expect(plain).not.toMatch(/list_notice|reply_head/);
  });
});

describe("webbus table", () => {
  const [notice, reply, plain] = tableRows(
    table("webbus", indexRows("Q_A", page(ROWS_INDEX), "webbus")),
  );

  it("prints icon_notice.gif for a notice's number", () => {
    expect(notice).toContain("gb_icon_notice.gif");
    expect(notice).toContain("bg-webbus-notice-row");
    expect(notice).not.toContain(">100<");
  });

  it("indents a reply two &nbsp; a level before icon_reply.gif", () => {
    expect(reply).toContain("    <img");
    expect(reply).not.toContain("     ");
    expect(reply).toContain("gb_icon_reply.gif");
    expect(reply).toContain(">99<");
  });

  it("numbers a post", () => {
    expect(plain).toContain(">98<");
    expect(plain).not.toMatch(/icon_notice|icon_reply/);
  });
});

describe("phone list", () => {
  const html = table("plain", indexRows("Q_A", page(ROWS_INDEX), "plain"));
  const items = (/<ul[^>]*>([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? "").split("</li>");

  it("tags a notice and arrows a reply, indented past the first level", () => {
    expect(items[0]).toContain("공지");
    expect(items[0]).toContain("bg-(--era-content-bg)");
    expect(items[1]).toContain('<span class="sr-only">답글</span>');
    expect(items[1]).toContain("padding-left:0.75rem");
    expect(items[2]).not.toMatch(/공지|답글/);
  });

  it("draws no kritz icons in a plain (forg.kr) table", () => {
    expect(tableRows(html).join("")).not.toMatch(/zb_kritz/);
  });
});

describe("2001 N+gine list", () => {
  const rows = indexRows("Q_A", page(ROWS_INDEX), "kritz");

  it("marks a notice with list_notice.gif for its number and notice_head.gif", () => {
    const [notice] = rows2001("skyblue", rows);
    expect(notice).toContain("bg-(--zb40-label)");
    expect(notice).toMatch(/list_notice\.gif[\s\S]*notice_head\.gif/);
    expect(notice).not.toContain(">100<");
    expect(notice?.match(/공지/g)).toHaveLength(1);
  });

  it("indents a reply &nbsp; a level before reply_head.gif", () => {
    const [, reply] = rows2001("skyblue", rows);
    expect(reply).toContain("    <img");
    expect(reply).toContain("skyblue/reply_head.gif");
  });

  it("borrows yellow's reply_head.gif for y, and shows the indent alone where none survives", () => {
    const y = rows2001("y", rows);
    expect(y[1]).toContain("yellow/reply_head.gif");
    expect(y[2]).toContain("y/old_head.gif");
    const board = rows2001("board", rows)[1];
    expect(board).toContain("    ");
    expect(board).not.toContain("reply_head");
    expect(board).toContain('<span class="sr-only">답글</span>');
  });
});

describe("a row no capture dated", () => {
  // Fails if: `datedByCapture` is not read (the row shows a bare date), or
  // reads as the year guess or the first-comment stand-in.
  const rows = indexRows(
    "Q_A",
    page([
      indexEntry("7", { hasPost: false, datedByCapture: true }),
      indexEntry("6", { hasPost: false, yearApprox: true }),
    ]),
    "kritz",
  );

  it("marks its date as one the post precedes, with its own tooltip", () => {
    expect(rows.map((r) => r.dateApprox)).toEqual(["capture", "year"]);
    const [dated] = tableRows(table("kritz", rows));
    expect(dated).toContain(
      'title="작성일이 캡처에 없어 이 글이 실린 화면이나 함께 실린 더 새 글의 날짜로 대신함"',
    );
    expect(dated).toContain("≤");
  });
});

describe("the phone list, which 2026 draws at every width", () => {
  const listOnly: BoardIndexPage = {
    ...page([
      indexEntry("7", { hasPost: false, datedByCapture: true }),
      indexEntry("6", { hasPost: false, yearApprox: true }),
      indexEntry("5", { hasPost: false, commentCount: 3 }),
    ]),
    totalWithPost: 0,
  };
  const phone = (rows: ListRow[]) =>
    /<ul class="forg-narrow-list[^>]*>([\s\S]*?)<\/ul>/.exec(table("kritz", rows))?.[1] ?? "";
  const items = (rows: ListRow[]) =>
    phone(rows)
      .split("</li>")
      .filter((li) => li.includes("<li"));

  // Fails if: the list loses the class 2026 shows it by, or its date and
  // hits lose the hook the 2026 digits take.
  it("carries the hooks 2026 dresses it by", () => {
    const [, , plain] = items(indexRows("Q_A", listOnly, "kritz"));
    expect(plain).toMatch(/<span class="forg-num shrink-0">03\.05\.01\.<\/span>/);
    expect(plain).toMatch(/<span class="forg-num shrink-0">조회 10<\/span>/);
    expect(plain).toMatch(/<span class="forg-cc /);
  });

  // Fails if: a notice's row in the phone list loses the hook 2026 colours it by.
  it("marks a notice's row for 2026", () => {
    const [notice, reply] = items(indexRows("Q_A", page(ROWS_INDEX), "kritz"));
    expect(notice).toMatch(/<li class="[^"]* forg-notice /);
    expect(reply).not.toContain("forg-notice");
  });

  // Fails if: the phone list prints a bare date where the table marks it
  // (`NarrowList` formatting `createdAt` itself).
  it("marks a stand-in date as the table does", () => {
    const [capture, year] = items(indexRows("Q_A", listOnly, "kritz"));
    expect(capture).toContain(`title="${DATE_APPROX.capture.tooltip}">≤`);
    expect(year).toContain(`title="${DATE_APPROX.year.tooltip}">≈`);
  });
});
