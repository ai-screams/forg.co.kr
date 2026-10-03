/**
 * Renders one paginated chunk of a board index as a semantic table.
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

import { getBoardOrThrow, isBoardId, type BoardId } from "@/lib/boards";
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
      <header className="pb-2">
        <h1 className="text-forg-ink text-[14px] font-bold">{meta.nameKr}</h1>
        {meta.description && (
          <p className="text-forg-muted mt-[2px] text-[11px]">{meta.description}</p>
        )}
        <p className="text-forg-muted mt-[2px] text-[11px]">
          전체 {page.totalPosts.toLocaleString("ko-KR")}개
          {page.totalWithPost < page.totalPosts
            ? ` (본문 보존 ${page.totalWithPost.toLocaleString("ko-KR")}개 · "본문 없음"은 목록에 제목만 남은 글)`
            : ""}{" "}
          · {page.page} / {page.totalPages} 페이지
        </p>
        {meta.continues && meta.continues.length > 0 && (
          <p className="text-forg-muted mt-[2px] text-[11px]">
            이전 게시판(
            {meta.continues.filter(isBoardId).map((id, i) => (
              <span key={id}>
                {i > 0 && " · "}
                <Link href={`/${id}`} className="underline">
                  {getBoardOrThrow(id).nameKr}
                </Link>
              </span>
            ))}
            )의 글을 이어 붙였습니다. 누르면 그 게시판의 글로 갑니다.
          </p>
        )}
      </header>

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
  // The 조회 column is dropped: `hits` is null for 99.2% of the archive, and
  // a fabricated 0 would read as "nobody ever opened this" (ADR-0016 §5).
  return (
    <ListTable
      skin={skin}
      rows={indexRows(board, page, skin)}
      withHits={false}
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
      <span className="text-forg-muted font-mono tabular-nums">
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
