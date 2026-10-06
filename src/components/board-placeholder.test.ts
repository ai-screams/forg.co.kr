import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BoardPlaceholder } from "@/components/board-placeholder";
import { getBoard } from "@/lib/boards";

function render(id: "MoNgBaT" | "bod_s_s"): string {
  return renderToStaticMarkup(createElement(BoardPlaceholder, { meta: getBoard(id) }));
}

describe("BoardPlaceholder", () => {
  // Fails if: a members-only board reads as one Wayback merely missed, or
  // another empty board reads as members-only.
  it("says why nothing survives", () => {
    expect(render("MoNgBaT")).toContain("회원만 볼 수 있던 게시판이라 남은 글이 없습니다");
    expect(render("MoNgBaT")).toContain("사용권한이 없습니다");
    expect(render("MoNgBaT")).toContain(">회원 전용</p>");
    expect(render("bod_s_s")).toContain(
      "Wayback Machine에 읽을 수 있는 글이나 목록이 남지 않았습니다",
    );
    expect(render("bod_s_s")).not.toContain("회원");
    // Its era is a skin hint, not a date anyone has.
    expect(render("MoNgBaT")).not.toContain("활동 시기");
    expect(render("bod_s_s")).toContain("활동 시기");
  });
});
