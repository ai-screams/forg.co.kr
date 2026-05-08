/**
 * Board landing — page 1 of `/[board]`.
 *
 * Static export with `dynamicParams = false`. `generateStaticParams`
 * enumerates every board id from `src/lib/boards.ts` so ALL documented
 * boards have a stable URL — boards whose posts haven't been parsed yet
 * (Gnuboard4 / Phase B / forg.kr) render a `<BoardPlaceholder>` rather
 * than 404. The museum's promise: every documented board lives at a
 * URL, even if it's still empty.
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
import { getBoardIndex } from "@/lib/posts";

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

  const meta = getBoard(board);
  if (!meta) return {};

  const index = await getBoardIndex(board, 1);
  if (!index) {
    return {
      title: `${meta.nameKr} (준비 중) — forg.co.kr`,
      description: `${meta.nameKr} 게시판은 아직 박물관에 도착하지 않았습니다.`,
    };
  }

  return {
    title: `${meta.nameKr} — forg.co.kr`,
    description: `${meta.nameKr} 게시판 — ${index.totalPosts.toLocaleString("ko-KR")}개 게시글이 보존되어 있습니다.`,
  };
}

export default async function BoardPageOne({ params }: RouteProps) {
  const { board } = await params;
  if (!isBoardId(board)) notFound();

  const meta = getBoard(board);
  if (!meta) notFound();

  const index = await getBoardIndex(board, 1);
  if (!index) {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <BoardPlaceholder meta={meta} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
      <BoardListing board={board} page={index} />
    </div>
  );
}
