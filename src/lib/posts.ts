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
import type { BoardIndexPage, Post } from "@/types/post";

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
