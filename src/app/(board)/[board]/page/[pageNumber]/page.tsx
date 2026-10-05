/**
 * Board listing — paginated chunk at `/[board]/page/[pageNumber]`.
 *
 * Page 1 is intentionally NOT generated here — it lives at the canonical
 * `/[board]` route. `generateStaticParams` returns pages 2..totalPages
 * for each board with content. With `dynamicParams = false`,
 * `/Notice/page/1` and `/Notice/page/999` both 404 at build time.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BoardListing } from "@/components/board-listing";
import { getBoard, isBoardId, listBoards } from "@/lib/boards";
import { getBoardIndex } from "@/lib/posts";

export const dynamicParams = false;

interface RouteParams {
  board: string;
  pageNumber: string;
}

interface RouteProps {
  params: Promise<RouteParams>;
}

export async function generateStaticParams(): Promise<RouteParams[]> {
  const boards = listBoards();
  const lists = await Promise.all(
    boards.map(async (b) => {
      const first = await getBoardIndex(b.id, 1);
      if (!first || first.totalPages <= 1) return [];
      // Pages 2..totalPages — page 1 is the canonical /[board] route
      return Array.from({ length: first.totalPages - 1 }, (_, i) => ({
        board: b.id,
        pageNumber: String(i + 2),
      }));
    }),
  );
  return lists.flat();
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { board, pageNumber } = await params;
  if (!isBoardId(board)) return {};

  const n = pageOf(pageNumber);
  if (n === null) return {};

  const meta = getBoard(board);
  const index = await getBoardIndex(board, n);
  if (!index) return {};

  return {
    title: `${meta.nameKr} (${n}/${index.totalPages}) — forg.co.kr`,
    description: `${meta.nameKr} ${n}페이지 — ${index.totalPosts.toLocaleString("ko-KR")}개 ${index.totalWithPost === 0 ? "제목" : "게시글"} 중 ${n}페이지`,
  };
}

export default async function BoardPaginatedPage({ params }: RouteProps) {
  const { board, pageNumber } = await params;
  if (!isBoardId(board)) notFound();

  const n = pageOf(pageNumber);
  if (n === null) notFound();

  const index = await getBoardIndex(board, n);
  if (!index) notFound();

  return <BoardListing board={board} page={index} />;
}

/** Page 2 and up; page 1 is `/[board]`. */
function pageOf(segment: string): number | null {
  const n = Number.parseInt(segment, 10);
  return Number.isInteger(n) && n >= 2 ? n : null;
}
