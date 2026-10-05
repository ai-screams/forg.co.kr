/** The museum bar's board name and notes for `/[board]/page/[N]`. */

import { BoardCrumb, BoardNotes } from "@/components/board-info";
import { getBoard, isBoardId } from "@/lib/boards";
import { getBoardIndex, getListOnlyRecord } from "@/lib/posts";

export { generateStaticParams } from "@/app/(board)/[board]/page/[pageNumber]/page";

export const dynamicParams = false;

interface RouteProps {
  params: Promise<{ board: string; pageNumber: string }>;
}

export default async function BoardCrumbPageN({ params }: RouteProps) {
  const { board, pageNumber } = await params;
  if (!isBoardId(board)) return null;
  const index = await getBoardIndex(board, Number(pageNumber));
  if (!index) return null;
  return (
    <BoardCrumb meta={getBoard(board)}>
      <BoardNotes board={board} page={index} listing={await getListOnlyRecord(board, index)} />
    </BoardCrumb>
  );
}
