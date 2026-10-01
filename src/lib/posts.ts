/**
 * Build-time loaders for forg gold-tier post and board-index JSON.
 *
 * The Next.js App Router runs Server Components during `next build` so this
 * module reads `src/content/**` directly via `fs.readFile`. Anchored with
 * `process.cwd()` so the same code works under both Turbopack and webpack.
 *
 * The Pydantic parser (ETL Stage 2) already validates the full schema before
 * writing JSON. The TypeScript guard here is a *shallow* check on the eight
 * top-level fields the renderer actually depends on — it catches build-time
 * regressions, not data-correctness bugs. For deeper validation, fix the ETL.
 */

import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { cache } from "react";

import { isBoardId, type BoardId } from "@/lib/boards";
import type { BoardIndexEntry, BoardIndexPage, BoardListing, Post } from "@/types/post";

const CONTENT_ROOT = path.join(process.cwd(), "src", "content");

const REQUIRED_POST_STRING_FIELDS = [
  "board",
  "postId",
  "title",
  "bodyHtml",
  "bodyText",
  "author",
  "createdAt",
  "era",
] as const;

function assertIsPost(value: unknown): asserts value is Post {
  if (!value || typeof value !== "object") {
    throw new Error("post JSON did not parse to an object");
  }
  const v = value as Record<string, unknown>;
  for (const key of REQUIRED_POST_STRING_FIELDS) {
    if (typeof v[key] !== "string") {
      throw new Error(`post JSON missing or non-string field: ${key}`);
    }
  }
}

function isENOENT(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  );
}

/**
 * Load a single Post by board id + post id.
 * Returns `null` for missing files (caller maps to `notFound()`); other
 * errors propagate so the build fails loudly on corrupt content.
 *
 * Wrapped in `cache` so a page's `generateMetadata` and the page itself share
 * one read (the pattern the Next.js metadata guide gives).
 */
export const getPost = cache(async (board: BoardId, postId: string): Promise<Post | null> => {
  const file = path.join(CONTENT_ROOT, "posts", board, `${postId}.json`);
  try {
    const raw: unknown = JSON.parse(await readFile(file, "utf8"));
    assertIsPost(raw);
    return raw;
  } catch (err) {
    if (isENOENT(err)) return null;
    throw err;
  }
});

/**
 * Enumerate every (board, postId) pair we have content for. Used by
 * `generateStaticParams` to drive SSG output.
 */
export async function getAllPostParams(): Promise<{ board: string; postId: string }[]> {
  const postsRoot = path.join(CONTENT_ROOT, "posts");
  let entries: Dirent[];
  try {
    entries = await readdir(postsRoot, { withFileTypes: true, encoding: "utf8" });
  } catch (err) {
    if (isENOENT(err)) return [];
    throw err;
  }

  const lists = await Promise.all(
    entries
      .filter((d) => d.isDirectory() && isBoardId(d.name))
      .map(async (d) => {
        const files = await readdir(path.join(postsRoot, d.name));
        return files
          .filter((f) => f.endsWith(".json"))
          .map((f) => ({ board: d.name, postId: f.slice(0, -".json".length) }));
      }),
  );
  return lists.flat();
}

/**
 * Load one paginated chunk of a board's index, 1-indexed to match the ETL.
 * Returns `null` for missing pages; the caller decides whether to 404 or
 * fall back to page 1. Cached per render like `getPost`.
 */
export const getBoardIndex = cache(
  async (board: BoardId, page: number): Promise<BoardIndexPage | null> => {
    if (!Number.isInteger(page) || page < 1) return null;
    const file = path.join(CONTENT_ROOT, "boards", board, `index-${page}.json`);
    try {
      return JSON.parse(await readFile(file, "utf8")) as BoardIndexPage;
    } catch (err) {
      if (isENOENT(err)) return null;
      throw err;
    }
  },
);

/**
 * Load the merged list-page rows for a board (`src/content/listings/{board}.json`),
 * the museum's only record of boards whose post pages were never captured.
 * Returns `null` when no list page of the board was captured. Cached per
 * render like `getPost`.
 */
export const getBoardListing = cache(async (board: BoardId): Promise<BoardListing | null> => {
  const file = path.join(CONTENT_ROOT, "listings", `${board}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8")) as BoardListing;
  } catch (err) {
    if (isENOENT(err)) return null;
    throw err;
  }
});

/**
 * The newest `count` rows of a board that the museum holds the post for.
 *
 * Page 1 alone is not enough since the list-page merge (ADR-0017 §4): a board
 * whose captured list pages are newer than every captured post page — FunBoard
 * is the case, its 50 newest rows are all title-only — would otherwise look
 * empty. Walks pages in order and stops as soon as `count` rows are in hand,
 * so the common board still reads exactly one file.
 *
 * A page carries up to 50 rows, so the loop overshoots by design and the
 * `slice` is what holds the caller to `count`: without it seven of the eight
 * home boxes render 9 to 35 rows.
 */
export async function getRecentPostEntries(
  board: BoardId,
  count: number,
): Promise<{ entries: BoardIndexEntry[]; totalPosts: number } | null> {
  const firstPage = await getBoardIndex(board, 1);
  if (!firstPage) return null;

  const entries = firstPage.entries.filter((e) => e.hasPost);
  for (let page = 2; entries.length < count && page <= firstPage.totalPages; page++) {
    const next = await getBoardIndex(board, page);
    if (!next) break;
    entries.push(...next.entries.filter((e) => e.hasPost));
  }

  return { entries: entries.slice(0, count), totalPosts: firstPage.totalPosts };
}

export interface AdjacentPosts {
  prev: BoardIndexEntry | null; // older, "이전글"
  next: BoardIndexEntry | null; // newer, "다음글"
}

interface BoardSequence {
  /** Every row with a post page, in listing order (`createdAt` desc). */
  entries: BoardIndexEntry[];
  /** `postId` → position in `entries`. */
  position: Map<string, number>;
}

async function loadBoardSequence(board: BoardId): Promise<BoardSequence> {
  const firstPage = await getBoardIndex(board, 1);
  const rest = firstPage
    ? await Promise.all(
        Array.from({ length: firstPage.totalPages - 1 }, (_, i) => getBoardIndex(board, i + 2)),
      )
    : [];
  const entries = [firstPage, ...rest]
    .flatMap((page) => page?.entries ?? [])
    .filter((e) => e.hasPost);
  const position = new Map(entries.map((e, i) => [e.postId, i]));
  return { entries, position };
}

/**
 * One sequence per board for the life of the process. Every post page of a
 * board needs the same sequence, and building it per page read all of
 * UoBoard's 122 index pages for each of its 4,670 posts. The index does not
 * change during a build; under `pnpm dev`, restart the server after rebuilding
 * it.
 */
const boardSequences = new Map<BoardId, Promise<BoardSequence>>();

function boardSequence(board: BoardId): Promise<BoardSequence> {
  let sequence = boardSequences.get(board);
  if (!sequence) {
    sequence = loadBoardSequence(board);
    boardSequences.set(board, sequence);
  }
  return sequence;
}

/**
 * Return the chronologically adjacent posts (within the same board listing)
 * for the given postId. Ordering matches the board listing: `createdAt` desc
 * (newest first). `next` = one step newer, `prev` = one step older. A
 * neighbour carried in from an older board keeps its `board` field, so the
 * caller links it there.
 *
 * If the post is not in the listing, returns `{ prev: null, next: null }` —
 * does NOT throw.
 */
export async function getAdjacentPosts(board: BoardId, postId: string): Promise<AdjacentPosts> {
  const { entries, position } = await boardSequence(board);
  const idx = position.get(postId);
  if (idx === undefined) return { prev: null, next: null };
  return {
    next: entries[idx - 1] ?? null,
    prev: entries[idx + 1] ?? null,
  };
}
