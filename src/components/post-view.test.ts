import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PostView } from "@/components/post-view";
import type { BoardId } from "@/lib/boards";
import { getAdjacentPosts, getPost } from "@/lib/posts";

async function render(board: BoardId, postId: string): Promise<string> {
  const post = await getPost(board, postId);
  if (!post) throw new Error(`${board}/${postId} is gone from the content`);
  const adjacent = await getAdjacentPosts(board, postId);
  return renderToStaticMarkup(createElement(PostView, { post, adjacent }));
}

/** The class attribute of the first tag that opens with `start`. */
function classOf(html: string, start: string): string {
  const at = html.indexOf(start);
  if (at < 0) throw new Error(`no ${start}`);
  const tag = html.slice(at, html.indexOf(">", at));
  return /class="([^"]*)"/.exec(tag)?.[1] ?? "";
}

/** Every class setting a side padding, under any variant (`sm:px-6`, `ps-6`, `p-[10px]`). */
function sidePadding(classes: string): string[] {
  return classes.split(" ").filter((c) => /^([\w-]+:)*p[xlrse]?-/.test(c));
}

describe("PostView", () => {
  // Events/160 has a head, a body, attachments, comments and neighbours:
  // every part of the box.
  // Fails if: the head, body, attachments or prev/next goes back to its own
  // inset (24px) or gains a second one beside the 10px, or the comments get a
  // side inset again, on their section or on their list.
  it("keeps the original's 10px edge, with the comments across the box", async () => {
    const html = await render("Events", "160");
    expect(sidePadding(classOf(html, '<header class="era-not-2001'))).toEqual(["px-[10px]"]);
    expect(sidePadding(classOf(html, '<div class="forg-post-body-cell'))).toEqual(["p-[10px]"]);
    expect(sidePadding(classOf(html, '<section aria-labelledby="attachments-'))).toEqual([
      "px-[10px]",
    ]);
    expect(sidePadding(classOf(html, '<nav aria-label="게시글 네비게이션"'))).toEqual([
      "px-[10px]",
    ]);
    const comments = html.slice(html.indexOf('<section aria-labelledby="comments-'));
    expect(sidePadding(classOf(comments, "<section "))).toEqual([]);
    expect(sidePadding(classOf(comments, "<ol"))).toEqual([]);
  });

  // kr_free/10 is a forg.kr (Gnuboard5) post: the museum's own comment rows.
  // Fails if: a forg.kr comment is boxed again, or its text leaves the
  // body's 10px edge.
  it("draws a forg.kr comment between two rules, its text on the body's edge", async () => {
    const html = await render("kr_free", "10");
    const comments = html.slice(html.indexOf('<section aria-labelledby="comments-'));
    const li = classOf(comments, "<li");
    expect(li.split(" ")).toContain("border-y");
    expect(li.split(" ")).not.toContain("border");
    expect(sidePadding(li)).toEqual(["px-[10px]"]);
  });

  // Fails if: the 2001 name cell cuts a name mid-word where it has a space.
  it("wraps a 2001 commenter's name at its spaces", async () => {
    const html = await render("Events", "160");
    const rows = html.slice(html.indexOf('aria-label="댓글 '));
    expect(classOf(rows, "<b ")).toContain("wrap-anywhere");
    expect(classOf(rows, "<b ")).not.toContain("break-all");
  });
});
