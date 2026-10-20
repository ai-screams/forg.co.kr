import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import BoardsPage from "@/app/boards/page";
import { listBoards } from "@/lib/boards";

const html = renderToStaticMarkup(await BoardsPage());
/** Each board's row: its link's text and the line under it. */
const rows = new Map(
  [
    ...html.matchAll(
      /<li[^>]*><a href="\/(\w+)\/"[^>]*>[^<]*<\/a><span[^>]*>([^<]*)<\/span><\/li>/g,
    ),
  ].map((m) => [m[1] ?? "", (m[2] ?? "").replace(/&#x27;/g, "'")]),
);

describe("the list of boards", () => {
  // Fails if: a board is left out (the members-only ones filtered away), or
  // a category heading goes.
  it("lists all 77 boards in five categories, the members-only ones too", () => {
    expect(rows.size).toBe(listBoards().length);
    expect(rows.size).toBe(77);
    expect([...html.matchAll(/<h2 /g)]).toHaveLength(5);
    const memberOnly = listBoards().filter((b) => b.memberOnly);
    expect(memberOnly).toHaveLength(5);
    for (const b of memberOnly) expect(rows.get(b.id)).toBe("Zeroboard 4.1pl4 · 회원 전용");
  });

  // Fails if: one year prints as a range ("2019–2019"), or a board with no
  // dated row gets a year.
  it("gives each board the years of its own dated rows", () => {
    expect(rows.get("UoBoard")).toMatch(/^Zeroboard 4\.1pl4 · 2000–2007 · 글 4,\d{3} · 제목 /);
    expect(rows.get("kr_free")).toMatch(/^Gnuboard5 · 2019 · /);
    expect(rows.get("WOWNotice")).toMatch(/ · — · 글 0 · 제목 \d/);
  });

  // Fails if: a board with no index (not members-only) loses the line that
  // says nothing of it is left.
  it("says when nothing of a board is left", () => {
    expect(rows.get("bod_s_s")).toBe("Zeroboard 4.1pl4 · 남은 글 없음");
  });
});
