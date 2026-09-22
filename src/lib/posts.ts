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
 */
export async function getPost(board: BoardId, postId: string): Promise<Post | null> {
  const file = path.join(CONTENT_ROOT, "posts", board, `${postId}.json`);
  try {
    const raw: unknown = JSON.parse(await readFile(file, "utf8"));
    assertIsPost(raw);
    return raw;
  } catch (err) {
    if (isENOENT(err)) return null;
    throw err;
  }
}

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
 * fall back to page 1.
 */
export async function getBoardIndex(board: BoardId, page: number): Promise<BoardIndexPage | null> {
  if (!Number.isInteger(page) || page < 1) return null;
  const file = path.join(CONTENT_ROOT, "boards", board, `index-${page}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8")) as BoardIndexPage;
  } catch (err) {
    if (isENOENT(err)) return null;
    throw err;
  }
}

/**
 * Load the merged list-page rows for a board (`src/content/listings/{board}.json`),
 * the museum's only record of boards whose post pages were never captured.
 * Returns `null` when no list page of the board was captured.
 */
export async function getBoardListing(board: BoardId): Promise<BoardListing | null> {
  const file = path.join(CONTENT_ROOT, "listings", `${board}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8")) as BoardListing;
  } catch (err) {
    if (isENOENT(err)) return null;
    throw err;
  }
}

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

/**
 * Return the chronologically adjacent posts (within the same board) for the
 * given postId. Ordering matches the board listing: `createdAt` desc
 * (newest first). `next` = one step newer (lower array index), `prev` = one
 * step older (higher array index).
 *
 * Walks every paginated index file for the board. If the post is not found in
 * any page, returns `{ prev: null, next: null }` — does NOT throw.
 */
export async function getAdjacentPosts(board: BoardId, postId: string): Promise<AdjacentPosts> {
  // Load page 1 first to learn totalPages, then fetch the rest in parallel.
  const firstPage = await getBoardIndex(board, 1);
  if (!firstPage) return { prev: null, next: null };

  const { totalPages } = firstPage;

  // Fetch remaining pages (2..totalPages) in parallel.
  const remainingPages =
    totalPages > 1
      ? await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) => getBoardIndex(board, i + 2)),
        )
      : [];

  // Flatten all entries into one array (createdAt desc, same as the listing),
  // keeping only rows that have a page to navigate to.
  const allEntries: BoardIndexEntry[] = [
    ...firstPage.entries,
    ...remainingPages.flatMap((page) => page?.entries ?? []),
  ].filter((e) => e.hasPost);

  const idx = allEntries.findIndex((e) => e.postId === postId);
  if (idx === -1) return { prev: null, next: null };

  return {
    next: idx > 0 ? (allEntries[idx - 1] ?? null) : null,
    prev: idx < allEntries.length - 1 ? (allEntries[idx + 1] ?? null) : null,
  };
}
