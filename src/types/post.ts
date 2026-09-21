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

  /** Title with the leading `[xxx]` category prefix stripped. */
  title: string;
  /**
   * Korean category marker the original poster prepended to the title
   * (e.g. `[질문]`, `[자료]`, `[공지]`). Stripped from `title` and stored
   * separately so listings can render it as a badge while keeping the
   * canonical title clean. Null when the original title had no prefix.
   */
  categoryLabel: string | null;
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
  /**
   * True when the capture carried no post date and `createdAt` is the
   * earliest comment's time — an upper bound, not the post's own timestamp.
   * Absent on files written before 2026-09-20; treat absent as false.
   */
  createdAtApprox?: boolean;

  /** View count if the markup exposes it. Sample posts do not — left
   *  optional until later boards prove they expose hits. */
  hits: number | null;
  recommend: number | null;

  attachments: Attachment[];
  comments: Comment[];

  /** Authored-in era (not display era — that toggles at runtime). */
  era: PostEra;
  /**
   * Real Wayback timestamp the capture came from, `YYYYMMDDHHMMSS`. Sourced
   * from `e-policy-plan.json` (1차) with `.progress.jsonl` as a fallback
   * (2차) — see ADR-0010 §Decision #7. The ETL fails loud if neither source
   * has a timestamp for this `(board, postId)`, so this field is always
   * truthful for downstream stages (image-recovery anchor, etc.).
   */
  capturedAt: string;
  /**
   * ISO 8601 timestamp the parser last wrote this JSON. Used for debugging
   * and re-run tracking — not an archival fact. Replaces the old
   * `derive_captured_at(file_mtime)` semantics that conflated parse time
   * with Wayback capture time.
   */
  parsedAt: string;
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
  /** Mirrors `Post.categoryLabel` so listing pages can show the badge
   *  without having to load the full Post JSON. */
  categoryLabel: string | null;
  author: string;
  authorMemberNo: string | null;
  createdAt: string;
  /** Mirrors `Post.createdAtApprox`; always present in index chunks. */
  createdAtApprox: boolean;
  /** Row came from a list page and the year of its MM/DD was inferred. */
  yearApprox: boolean;
  commentCount: number;
  attachmentCount: number;
  hits: number | null;
  recommend: number | null;
  era: PostEra;
  /**
   * False for a row known only from a captured list page (ADR-0017 §4):
   * there is no `/{board}/{postId}` page to link to.
   */
  hasPost: boolean;
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
  /** Every row across all pages, including list-page-only ones. */
  totalPosts: number;
  /** Rows the museum holds the post for. */
  totalWithPost: number;
  /** ISO 8601 timestamp the index was built. */
  generatedAt: string;
  entries: BoardIndexEntry[];
}

/** Page size for paginated board indexes. Mirrored in Python. */
export const BOARD_INDEX_PAGE_SIZE = 50;

/**
 * One row of a captured board list page (ADR-0017). A row is the only
 * trace of a post whose view page Wayback never captured, and for 43
 * boards the only trace of the board. Built by
 * `scripts/etl/02c-parse-listing.py`; mirrors `BoardListingEntry` there.
 */
export interface BoardListingEntry {
  /** Zeroboard `no=` / Gnuboard `wr_id=`. */
  no: string;
  title: string;
  categoryLabel: string | null;
  author: string;
  authorMemberNo: string | null;
  /** ISO date (day precision). Null when the row carried no date. */
  createdAt: string | null;
  /** The list printed MM/DD only and the year came from the capture date. */
  yearApprox: boolean;
  /** As printed in the list's 조회 column — real for these rows. */
  hits: number | null;
  commentCount: number;
  isNotice: boolean;
  /** Wayback ts of the list page this row came from. */
  capturedAt: string;
  listPage: number;
  /** True when `src/content/posts/{board}/{no}.json` exists. */
  hasPost: boolean;
}

export interface BoardListing {
  board: string;
  engine: SourceEngine;
  pagesCaptured: number;
  /** "total N" as printed on the newest captured page, when present. */
  totalReported: number | null;
  generatedAt: string;
  /** Newest first, merged across every captured page. */
  entries: BoardListingEntry[];
}
