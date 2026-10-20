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
    expect(sidePadding(classOf(html, '<header class="forg-post-head'))).toEqual(["px-[10px]"]);
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

  // Fails if: a recovered picture in a post's body is not named after the post.
  it("names a post's pictures after the post", async () => {
    const html = await render("UoBoard", "10657");
    expect(html).toMatch(
      /<img alt="\.\.\.오메 -0-;의 그림"[^>]*src="[^"]*\/posts\/UoBoard\/10657\//,
    );
  });

  // Fails if: the 2001 name cell cuts a name mid-word where it has a space.
  it("wraps a 2001 commenter's name at its spaces", async () => {
    const html = await render("Events", "160");
    const rows = html.slice(html.indexOf('aria-label="댓글 '));
    expect(classOf(rows, "<b ")).toContain("wrap-anywhere");
    expect(classOf(rows, "<b ")).not.toContain("break-all");
  });
});

describe("the 2026 notes in a post", () => {
  // Fails if: one of the museum's 2026 notes reaches the search index (its
  // `data-pagefind-ignore` dropped), where it would show in every excerpt.
  it("keeps the museum's notes out of search", async () => {
    const html = await render("UoBoard", "29831");
    const notes = [...html.matchAll(/<[a-z0-9]+ [^>]*class="[^"]*era-2026-only[^"]*"[^>]*>/g)].map(
      (m) => m[0],
    );
    expect(notes.length).toBeGreaterThanOrEqual(4);
    expect(notes.filter((tag) => !tag.includes("data-pagefind-ignore"))).toEqual([]);
  });

  // Fails if: the record line gives the post's date for its capture's, or
  // its button leads to another era than the post's.
  it("names the capture the post came from and the era it was written in", async () => {
    const html = await render("UoBoard", "29831");
    const line = /<p class="era-2026-only forg-post-record"[\s\S]*?<\/p>/.exec(html)?.[0] ?? "";
    expect(line).toContain("2003.05.12</span> Wayback 캡처에서 옮김");
    expect(line).toMatch(/data-era-option="2003"[^>]*>2003 모습으로</);
  });

  // Fails if: a post's date notes go: the first comment's time standing in,
  // or 작성일 미상 with the capture's date.
  it("keeps the head's honest dates", async () => {
    expect(await render("Ultima", "4802")).toContain("(이전 — 첫 댓글 시각, 작성일은 캡처에 없음)");
    const undated = await render("Q_A", "100");
    expect(undated).toContain("작성일 미상");
    expect(undated).toContain("(캡처 2001.07.23)");
  });

  // Fails if: the comment count over the comments is a screen reader's alone in 2026 too.
  it("shows the comment count in 2026", async () => {
    const html = await render("UoBoard", "29831");
    expect(classOf(html, '<h2 id="comments-').split(" ")).toEqual(["forg-sr-except-2026"]);
  });
});
