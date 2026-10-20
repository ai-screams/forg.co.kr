/**
 * What the museum holds of each board, counted from the board indexes
 * (`src/content/boards/{board}/index-*.json`): for the 2026 front page and
 * the list of every board (`/boards/`).
 *
 * A board that continues older ones (`BoardMeta.continues`) carries their
 * rows in its index; they are counted for the board they belong to, so
 * UoBoard2's years are its own (2010–2016), not UoBoard's.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { listBoards, type BoardId } from "@/lib/boards";
import { isUnknownDate } from "@/lib/dates";
import { getAllSitePages } from "@/lib/site-pages";
import type { BoardIndexEntry, BoardIndexPage } from "@/types/post";

const BOARDS_ROOT = path.join(process.cwd(), "src", "content", "boards");

export interface BoardSummary {
  board: BoardId;
  /** Its own index rows, list-page rows included. */
  rows: number;
  /** Rows the museum holds the post of. */
  posts: number;
  /** Comments on those posts. */
  comments: number;
  /** First and last year of its own rows with a date of their own; null when none has one. */
  years: [number, number] | null;
}

/**
 * A row whose date is the post's own: not the 1970 placeholder, not the first
 * comment's time standing in for it, not a capture's day it precedes, not a
 * list's MM/DD given the capture's year.
 */
export function datedRow(e: BoardIndexEntry): boolean {
  return !isUnknownDate(e.createdAt) && !e.createdAtApprox && !e.datedByCapture && !e.yearApprox;
}

async function summarise(board: BoardId): Promise<BoardSummary | null> {
  let files: string[];
  try {
    files = (await readdir(path.join(BOARDS_ROOT, board))).filter((f) =>
      /^index-\d+\.json$/.test(f),
    );
  } catch {
    // No index: a board Wayback kept nothing readable of, members-only ones included.
    return null;
  }
  const summary: BoardSummary = { board, rows: 0, posts: 0, comments: 0, years: null };
  for (const file of files) {
    const page = JSON.parse(
      await readFile(path.join(BOARDS_ROOT, board, file), "utf8"),
    ) as BoardIndexPage;
    for (const e of page.entries) {
      if (e.board !== undefined && e.board !== board) continue;
      summary.rows++;
      if (e.hasPost) {
        summary.posts++;
        summary.comments += e.commentCount;
      }
      if (datedRow(e)) {
        const year = Number(e.createdAt.slice(0, 4));
        const [first, last] = summary.years ?? [year, year];
        summary.years = [Math.min(first, year), Math.max(last, year)];
      }
    }
  }
  return summary;
}

let summaries: Promise<ReadonlyMap<BoardId, BoardSummary>> | undefined;

/** Every board with an index, by id; read once per process (1,243 files). */
export function boardSummaries(): Promise<ReadonlyMap<BoardId, BoardSummary>> {
  summaries ??= Promise.all(listBoards().map((b) => summarise(b.id))).then(
    (list) => new Map(list.filter((s) => s !== null).map((s) => [s.board, s])),
  );
  return summaries;
}

/** The museum in four numbers, for the 2026 front page: every board has a page (ADR-0013). */
export async function museumTotals(): Promise<{
  posts: number;
  comments: number;
  boards: number;
  guidePages: number;
}> {
  const all = [...(await boardSummaries()).values()];
  // The pages `/site/` lists: a redirect page is not one.
  const pages = (await getAllSitePages()).filter((p) => p.kind !== "redirect");
  return {
    posts: all.reduce((n, s) => n + s.posts, 0),
    comments: all.reduce((n, s) => n + s.comments, 0),
    boards: listBoards().length,
    guidePages: pages.length,
  };
}
