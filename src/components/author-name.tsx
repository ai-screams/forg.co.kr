import type { ReactNode } from "react";

import { DaemonName } from "@/components/daemon-name";
import { getBoard } from "@/lib/boards";

/**
 * A post's or comment's author as its board showed it: a non-member on a
 * `daemonGuestNames` board gets a random daemon name per view, everyone else
 * the captured name. `board` is the board the post lives in, which differs
 * from the listing's for rows a board carries in (`BoardMeta.continues`).
 */
export function AuthorName({
  board,
  name,
  memberNo,
}: {
  board: string;
  name: string;
  memberNo: string | null;
}): ReactNode {
  return getBoard(board)?.daemonGuestNames && !memberNo ? <DaemonName name={name} /> : name;
}
