import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isBoardId } from "@/lib/boards";
import { SIDEBAR_2003, TOP_MENU_2001 } from "@/lib/era-menus";

const PAGES = path.join(process.cwd(), "src", "content", "pages");

/** The home, a board, a `/site/` page that was built, or a Wayback capture. */
function reaches(href: string): boolean {
  if (href === "/") return true;
  if (href.startsWith("https://web.archive.org/web/")) return true;
  const page = /^\/site\/(.+)\/$/.exec(href);
  if (page) {
    // `path.join` would resolve `..`, but a browser leaves `/site/` with it.
    const stem = page[1] ?? "";
    if (stem.split("/").some((part) => part === "" || part === "." || part === "..")) return false;
    return existsSync(path.join(PAGES, `${stem}.json`));
  }
  const board = /^\/([^/]+)$/.exec(href);
  return board !== null && isBoardId(board[1] ?? "");
}

// The 2014 menus and the 2003 top menu link by `BoardId`, which the type
// checker holds to the catalog; these two link by path.
const LINKS = [
  ...TOP_MENU_2001.map((item) => item.href),
  ...SIDEBAR_2003.flatMap((section) => section.links.map((link) => link.href)),
];

describe("era menu links", () => {
  it.each(LINKS)("%s leads somewhere", (href) => {
    expect(reaches(href)).toBe(true);
  });

  it("rejects a page, a board or a host that is not there", () => {
    expect(reaches("/site/skill/no_such_guide/")).toBe(false);
    expect(reaches("/site/skill/uo_newbie")).toBe(false);
    expect(reaches("/site/../pages/skill/uo_newbie/")).toBe(false);
    expect(reaches("/NoSuchBoard")).toBe(false);
    expect(reaches("/UoBoard/1/")).toBe(false);
    expect(reaches("https://www.kr.uo.com/")).toBe(false);
  });
});
