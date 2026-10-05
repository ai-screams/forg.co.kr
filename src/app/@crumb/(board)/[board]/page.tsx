/**
 * The museum bar's board name and notes for page 1 of `/[board]`
 * (`components/board-info.tsx`). A board Wayback kept nothing readable of
 * has its own page that says so, and no notes here.
 */

import { BoardCrumb, IndexNotes, ListingNotes } from "@/components/board-info";
import { getBoard, isBoardId, listBoards } from "@/lib/boards";
import { getBoardView } from "@/lib/posts";

export const dynamicParams = false;

interface RouteProps {
  params: Promise<{ board: string }>;
}

export function generateStaticParams(): { board: string }[] {
  return listBoards().map((b) => ({ board: b.id }));
}

export default async function BoardCrumbPageOne({ params }: RouteProps) {
  const { board } = await params;
  if (!isBoardId(board)) return null;
  const view = await getBoardView(board);
  if (view.kind === "placeholder") return null;
  return (
    <BoardCrumb meta={getBoard(board)}>
      {view.kind === "index" ? (
        <IndexNotes board={board} page={view.page} />
      ) : (
        <ListingNotes listing={view.listing} />
      )}
    </BoardCrumb>
  );
}
