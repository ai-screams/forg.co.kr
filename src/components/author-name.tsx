import type { ReactNode } from "react";

import { DaemonName } from "@/components/daemon-name";
import { getBoard } from "@/lib/boards";

/** Who wrote a row: what `AuthorName` needs besides the seed. */
export interface AuthorRef {
  board: string;
  name: string;
  memberNo: string | null;
}

/** The seed of a post's own author. */
export const POST_SEED = "post";

/** The seed of the `index`-th comment, in `post.comments` order. */
export function commentSeed(index: number): string {
  return `c${String(index)}`;
}

/**
 * A post's or comment's author as its board showed it: a non-member on a
 * `daemonGuestNames` board gets a random daemon name per view, everyone else
 * the captured name. `board` is the board the post lives in, which differs
 * from the listing's for rows a board carries in (`BoardMeta.continues`).
 * `seed` names the post or comment on the page; its copies share one draw,
 * so every copy passes the same one: `POST_SEED`, `commentSeed(i)`, or the
 * list row's key.
 */
export function AuthorName({
  board,
  name,
  memberNo,
  seed,
}: {
  board: string;
  name: string;
  memberNo: string | null;
  seed: string;
}): ReactNode {
  return getBoard(board)?.daemonGuestNames && !memberNo ? (
    <DaemonName name={name} seed={seed} />
  ) : (
    name
  );
}
