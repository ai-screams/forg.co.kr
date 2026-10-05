/**
 * Renders one paginated chunk of a board index as a semantic table — a
 * board's posts and the rows its captured list pages add, or for a board
 * Wayback kept no post of, those list rows alone.
 *
 * Used by both `/[board]` (page 1) and `/[board]/page/[N]` (page 2+).
 * Era-invariant markup; visual delta comes from `--era-*` CSS vars.
 *
 * Pagination URLs:
 *   page 1 → `/{board}/`        (canonical)
 *   page N → `/{board}/page/N/` (literal `page` segment to keep
 *                                 `/{board}/{postId}` route disambiguated)
 */

import { indexRows } from "@/components/board-rows";
import Link from "@/components/link";
import { ListTable } from "@/components/list-skin";

import { getBoardOrThrow, type BoardId } from "@/lib/boards";
import { boardSkin, type ListSkin } from "@/lib/skins";
import { skin2001Of } from "@/lib/skins-2001";
import { BOARD_INDEX_PAGE_SIZE, type BoardIndexPage } from "@/types/post";

interface BoardListingProps {
  board: BoardId;
  page: BoardIndexPage;
}

export function BoardListing({ board, page }: BoardListingProps) {
  const meta = getBoardOrThrow(board);
  const skin = boardSkin(meta);

  return (
    <article className="text-forg-ink">
      <h1 className="sr-only">{meta.nameKr}</h1>

      <PostTable board={board} page={page} skin={skin} />

      <Pagination board={board} currentPage={page.page} totalPages={page.totalPages} />
    </article>
  );
}

function PostTable({
  board,
  page,
  skin,
}: {
  board: BoardId;
  page: BoardIndexPage;
  skin: ListSkin;
}) {
  // The 조회 column is dropped where the board has posts: `hits` is null for
  // 99.2% of the archive, and a fabricated 0 would read as "nobody ever
  // opened this" (ADR-0016 §5). A board known only from its list pages keeps
  // it: every row's count is what a list printed.
  return (
    <ListTable
      skin={skin}
      rows={indexRows(board, page, skin)}
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
