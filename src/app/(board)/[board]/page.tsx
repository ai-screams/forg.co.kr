/**
 * Board landing — page 1 of `/[board]`.
 *
 * Static export with `dynamicParams = false`. `generateStaticParams`
 * enumerates every board id from `src/lib/boards.ts`, so every documented
 * board has a stable URL (ADR-0013): `getBoardView` picks its index — of its
 * posts and list rows, or of its list rows alone — else `<BoardPlaceholder>`
 * for a board Wayback kept nothing readable of.
 *
 * Page 1 is canonical at `/{board}/`; pages 2+ live under
 * `/{board}/page/{N}/` to avoid colliding with the post route at
 * `/{board}/{postId}/`.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BoardListing } from "@/components/board-listing";
import { BoardPlaceholder } from "@/components/board-placeholder";
import { getBoard, isBoardId, listBoards } from "@/lib/boards";
import { getBoardView } from "@/lib/posts";

export const dynamicParams = false;

interface RouteParams {
  board: string;
}

interface RouteProps {
  params: Promise<RouteParams>;
}

export async function generateStaticParams(): Promise<RouteParams[]> {
  // All registered boards get a /{board} URL, parsed or not.
  return listBoards().map((b) => ({ board: b.id }));
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { board } = await params;
  if (!isBoardId(board)) return {};

  const { nameKr } = getBoard(board);
  const view = await getBoardView(board);
  switch (view.kind) {
    case "index": {
      const count = view.page.totalPosts.toLocaleString("ko-KR");
      return {
        title: `${nameKr} — forg.co.kr`,
        description: view.listing
          ? `${nameKr} 게시판 — 목록에 남은 ${count}개 제목이 보존되어 있습니다.`
          : `${nameKr} 게시판 — ${count}개 게시글이 보존되어 있습니다.`,
      };
    }
    case "placeholder":
      return {
        title: `${nameKr} — forg.co.kr`,
        description: `${nameKr} 게시판 — Wayback Machine에 읽을 수 있는 글이나 목록이 남지 않았습니다.`,
      };
  }
}

export default async function BoardPageOne({ params }: RouteProps) {
  const { board } = await params;
  if (!isBoardId(board)) notFound();

  const view = await getBoardView(board);
  return view.kind === "index" ? (
    <BoardListing board={board} page={view.page} />
  ) : (
    <BoardPlaceholder meta={getBoard(board)} />
  );
}
