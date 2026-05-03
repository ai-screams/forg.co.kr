/**
 * Board landing — page 1 of `/[board]`.
 *
 * Static export with `dynamicParams = false`. `generateStaticParams`
 * lists every board id whose `index-1.json` exists, so unparsed boards
 * just 404 (and quietly start working once their parser lands).
 *
 * Page 1 is canonical at `/{board}/`; pages 2+ live under
 * `/{board}/page/{N}/` to avoid colliding with the post route at
 * `/{board}/{postId}/`.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BoardListing } from "@/components/board-listing";
import { getBoard, isBoardId, listBoards, type BoardId } from "@/lib/boards";
import { getBoardIndex } from "@/lib/posts";

export const dynamicParams = false;

interface RouteParams {
  board: string;
}

interface RouteProps {
  params: Promise<RouteParams>;
}

export async function generateStaticParams(): Promise<RouteParams[]> {
  const boards = listBoards();
  const checks = await Promise.all(
    boards.map(async (b) => {
      const index = await getBoardIndex(b.id as BoardId, 1);
      return index ? { board: b.id } : null;
    }),
  );
  return checks.filter((p): p is RouteParams => p !== null);
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { board } = await params;
  if (!isBoardId(board)) return {};

  const meta = getBoard(board);
  const index = await getBoardIndex(board, 1);
  if (!meta || !index) return {};

  return {
    title: `${meta.nameKr} — forg.co.kr`,
    description: `${meta.nameKr} 게시판 — ${index.totalPosts.toLocaleString("ko-KR")}개 게시글이 보존되어 있습니다.`,
  };
}

export default async function BoardPageOne({ params }: RouteProps) {
  const { board } = await params;
  if (!isBoardId(board)) notFound();

  const index = await getBoardIndex(board, 1);
  if (!index) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
      <BoardListing board={board} page={index} />
    </div>
  );
}
