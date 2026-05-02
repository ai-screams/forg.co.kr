/**
 * forg.co.kr post schema (ADR-0004, ADR-0008).
 *
 * The Pydantic models in `scripts/etl/schemas.py` mirror these interfaces
 * 1:1 — the parser validates against Pydantic, the React side reads with
 * these TypeScript types. Keep the two in lock-step.
 */

/** Era a post was authored in. Used for historical labeling in the UI. */
export type PostEra = "2003" | "2014";

/** Engine that produced the original markup. Drives parser selection. */
export type SourceEngine = "zeroboard" | "gnuboard4" | "gnuboard5";

export interface Attachment {
  /** Filename as displayed by the original site, e.g. "screenshot.jpg". */
  name: string;
  /** Zeroboard `filenum` query parameter — stable identifier within a post. */
  fileNum: number;
  /**
   * Human-readable size parsed from "(102.1 KB)". Null when forg did not
   * surface a size in the markup. Best-effort: bytes are approximate.
   */
  sizeBytes: number | null;
}

export interface Comment {
  /** Display name of the comment author. */
  author: string;
  /** Zeroboard `member_no`, useful for cross-referencing the author. */
  authorMemberNo: string | null;
  /** ISO 8601 with second precision when available, day precision otherwise. */
  createdAt: string;
  /** Sanitised HTML — vintage tags (font/center) preserved on purpose. */
  bodyHtml: string;
}

export interface Post {
  /** Original Zeroboard / Gnuboard board id, e.g. "UoBoard", "Q_A". */
  board: string;
  /** Korean display name of the board, sourced from `src/lib/boards.ts`. */
  boardKr: string;
  /** Post id within the board (`no=` / `wr_id=`). */
  postId: string;

  title: string;
  bodyHtml: string;
  /** Plain-text projection of bodyHtml for search indexing and previews. */
  bodyText: string;

  author: string;
  authorMemberNo: string | null;
  /** "in <homepage>" link from the meta line. Null when the placeholder
   *  "http://" was used (no homepage). */
  authorHomepage: string | null;

  /** ISO 8601 — second precision from `<span title="…">` when present,
   *  otherwise day precision from the visible date. */
  createdAt: string;

  /** View count if the markup exposes it. Sample posts do not — left
   *  optional until later boards prove they expose hits. */
  hits: number | null;
  recommend: number | null;

  attachments: Attachment[];
  comments: Comment[];

  /** Authored-in era (not display era — that toggles at runtime). */
  era: PostEra;
  /** Wayback timestamp the capture came from, YYYYMMDDHHMMSS. */
  capturedAt: string;
  /** The forg.co.kr URL we got the capture from. */
  originalUrl: string;
  sourceEngine: SourceEngine;
}

/**
 * Lightweight summary used by board listing pages. Built from `Post` JSON
 * by `scripts/etl/03-build-index.py`. Excludes `bodyHtml`/`bodyText` so the
 * client bundle for a listing page stays small even when a board has 1k+
 * posts.
 */
export interface BoardIndexEntry {
  postId: string;
  title: string;
  author: string;
  authorMemberNo: string | null;
  createdAt: string;
  commentCount: number;
  attachmentCount: number;
  hits: number | null;
  recommend: number | null;
  era: PostEra;
}

/**
 * One paginated chunk of a board index. Boards are paginated at
 * `BOARD_INDEX_PAGE_SIZE` entries per chunk, sorted by `createdAt` desc
 * (newest first). Page numbers are 1-indexed; `index-1.json` is the
 * landing page for `/board/{board}`.
 */
export interface BoardIndexPage {
  /** Board id (e.g. "Notice", "Q_A"). */
  board: string;
  /** 1-indexed page number. */
  page: number;
  /** Total number of pages produced for this board. */
  totalPages: number;
  /** Total post count across all pages. */
  totalPosts: number;
  /** ISO 8601 timestamp the index was built. */
  generatedAt: string;
  entries: BoardIndexEntry[];
}

/** Page size for paginated board indexes. Mirrored in Python. */
export const BOARD_INDEX_PAGE_SIZE = 50;
