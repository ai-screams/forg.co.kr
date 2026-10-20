/**
 * Renders one paginated chunk of a board index as a semantic table — a
 * board's posts and the rows its captured list pages add, or for a board
 * Wayback kept no post of, those list rows alone.
 *
 * Used by both `/[board]` (page 1) and `/[board]/page/[N]` (page 2+).
 * Era-invariant markup; visual delta comes from `--era-*` CSS vars. In 2026,
 * the museum's own frame, the head is in it too (ADR-0023 §2): the board's
 * place in the museum, its name (a screen reader's alone in the other eras),
 * a button to the era it wore, its description and notes (in the other eras
 * behind the museum bar's (i)), and what the page's date marks mean.
 *
 * Pagination URLs:
 *   page 1 → `/{board}/`        (canonical)
 *   page N → `/{board}/page/N/` (literal `page` segment to keep
 *                                 `/{board}/{postId}` route disambiguated)
 */

import { BoardNotes } from "@/components/board-info";
import { indexRows } from "@/components/board-rows";
import Link from "@/components/link";
import { DATE_APPROX, type ListRow } from "@/components/list-row";
import { ListTable } from "@/components/list-skin";

import { BOARD_CATEGORY_LABELS, getBoardOrThrow, type BoardId } from "@/lib/boards";
import { DEFAULT_ERA } from "@/lib/era";
import { boardSkin, type ListSkin } from "@/lib/skins";
import { skin2001Of } from "@/lib/skins-2001";
import { BOARD_INDEX_PAGE_SIZE, type BoardIndexPage, type BoardListing } from "@/types/post";

interface BoardListingProps {
  board: BoardId;
  page: BoardIndexPage;
  /** The captured list pages of a board known only from them (`getListOnlyRecord`). */
  listing: BoardListing | null;
}

export function BoardListing({ board, page, listing }: BoardListingProps) {
  const meta = getBoardOrThrow(board);
  const skin = boardSkin(meta);
  const rows = indexRows(board, page, skin);

  return (
    <article className="forg-board text-forg-ink">
      <p className="era-2026-only forg-board-path">
        <span>옛 게시판 › {BOARD_CATEGORY_LABELS[meta.category]}</span>
        <button
          type="button"
          aria-pressed={meta.era === DEFAULT_ERA}
          data-era-option={meta.era}
          suppressHydrationWarning
          className="w26-ghost"
        >
          {meta.era} 모습으로
        </button>
      </p>
      <h1 className="forg-sr-except-2026">
        {meta.nameKr}
        <span className="era-2026-only w26-tag">기록</span>
      </h1>
      <div className="era-2026-only forg-board-head">
        {meta.description && <p>{meta.description}</p>}
        <BoardNotes board={board} page={page} listing={listing} />
        <DateMarks rows={rows} />
      </div>

      <PostTable board={board} page={page} skin={skin} rows={rows} />

      <Pagination board={board} currentPage={page.page} totalPages={page.totalPages} />
    </article>
  );
}

/** What the page's approximate dates are marked with, for the marks it has. */
function DateMarks({ rows }: { rows: readonly ListRow[] }) {
  const has = (...kinds: (keyof typeof DATE_APPROX)[]) =>
    rows.some((r) => r.dateApprox !== null && kinds.includes(r.dateApprox));
  const before = has("firstComment", "capture");
  const year = has("year");
  if (!before && !year) return null;
  return (
    <p>
      {before && <span>≤ 작성일이 남지 않아 그 뒤의 날짜(첫 댓글, 캡처)로 대신함</span>}
      {before && year && " · "}
      {year && <span>≈ 목록에 월/일만 있어 연도는 추정</span>}
    </p>
  );
}

function PostTable({
  board,
  page,
  skin,
  rows,
}: {
  board: BoardId;
  page: BoardIndexPage;
  skin: ListSkin;
  rows: ListRow[];
}) {
  // The 조회 column is dropped where the board has posts: `hits` is null for
  // 99.2% of the archive, and a fabricated 0 would read as "nobody ever
  // opened this" (ADR-0016 §5). A board known only from its list pages keeps
  // it: every row's count is what a list printed.
  return (
    <ListTable
      skin={skin}
      rows={rows}
      withHits={page.totalWithPost === 0}
      firstNumber={page.totalPosts - (page.page - 1) * BOARD_INDEX_PAGE_SIZE}
      era2001={{
        skin: skin2001Of(board),
        totalPosts: page.totalPosts,
        page: page.page,
        totalPages: page.totalPages,
      }}
    />
  );
}

function Pagination({
  board,
  currentPage,
  totalPages,
}: {
  board: BoardId;
  currentPage: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const prevHref = pageHref(board, currentPage - 1);
  const nextHref = pageHref(board, currentPage + 1);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      aria-label="페이지 네비게이션"
      className="flex items-center justify-between gap-3 border-t border-(--era-input-border) px-6 py-4 text-xs"
    >
      <PageLink href={prevHref} disabled={!hasPrev} label="← 이전" />
      <span className="font-mono text-forg-muted tabular-nums">
        {currentPage} / {totalPages}
      </span>
      <PageLink href={nextHref} disabled={!hasNext} label="다음 →" />
    </nav>
  );
}

function PageLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  if (disabled) {
    return (
      <span aria-disabled className="text-forg-muted/50 select-none">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="font-bold text-(--era-link) underline-offset-2 hover:text-(--era-link-hover) hover:underline"
    >
      {label}
    </Link>
  );
}

function pageHref(board: BoardId, page: number): string {
  if (page <= 1) return `/${board}`;
  return `/${board}/page/${page}`;
}
