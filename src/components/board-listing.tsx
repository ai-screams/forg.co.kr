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

import type { ReactNode } from "react";

import { AuthorName } from "@/components/author-name";
import Link from "@/components/link";
import {
  CommentCount,
  listSkinOf,
  ListTable,
  NoBodyMark,
  RowMarks,
  type ListRow,
  type ListSkin,
} from "@/components/list-skin";
import type { Row2001 } from "@/components/list-skin-2001";

import { getBoardOrThrow, isBoardId, type BoardId } from "@/lib/boards";
import { formatShortDate } from "@/lib/dates";
import { skin2001Of } from "@/lib/skins-2001";
import { BOARD_INDEX_PAGE_SIZE, type BoardIndexPage } from "@/types/post";

interface BoardListingProps {
  board: BoardId;
  page: BoardIndexPage;
}

export function BoardListing({ board, page }: BoardListingProps) {
  const meta = getBoardOrThrow(board);
  const skin = listSkinOf(meta.engine);

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

/**
 * The title cell: a link when the museum holds the post, plain text when
 * the row is known only from a captured list page (ADR-0017 §4).
 */
function RowTitle({
  board,
  entry,
  children,
}: {
  board: BoardId;
  entry: BoardIndexPage["entries"][number];
  children: ReactNode;
}) {
  const layout = "inline-flex items-baseline gap-[4px] leading-[1.7]";
  if (!entry.hasPost) {
    return (
      <span
        className={`text-forg-muted ${layout}`}
        title="본문은 캡처되지 않았습니다 — 목록에 남은 제목"
      >
        {children}
        <NoBodyMark />
      </span>
    );
  }
  return (
    <Link
      href={`/${entry.board ?? board}/${entry.postId}`}
      className={`text-forg-ink ${layout} hover:underline`}
    >
      {children}
    </Link>
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
  if (page.entries.length === 0) {
    return (
      <p className="text-forg-muted px-2 py-10 text-center text-[11px]">
        이 페이지에는 게시글이 없습니다.
      </p>
    );
  }

  // The 조회 column is dropped: `hits` is null for 99.2% of the archive, and
  // a fabricated 0 would read as "nobody ever opened this" (ADR-0016 §5).
  const rows: ListRow[] = page.entries.map((entry) => ({
    key: `${entry.board ?? board}/${entry.postId}`,
    author: (
      <AuthorName
        board={entry.board ?? board}
        name={entry.author}
        memberNo={entry.authorMemberNo}
        seed={`${entry.board ?? board}/${entry.postId}`}
      />
    ),
    title: (
      <RowTitle board={board} entry={entry}>
        {entry.categoryLabel ? (
          <span className="text-forg-muted shrink-0 text-[10px]">[{entry.categoryLabel}]</span>
        ) : null}
        <span className="truncate">{entry.title}</span>
        <CommentCount count={entry.commentCount} skin={skin} />
        <RowMarks
          skin={skin}
          board={board}
          attachmentCount={entry.attachmentCount}
          hits={entry.hits}
        />
      </RowTitle>
    ),
    date: entry.createdAtApprox ? (
      <span title="작성일이 캡처에 없어 첫 댓글 시각으로 대신함">
        ≤{formatShortDate(entry.createdAt)}
      </span>
    ) : entry.yearApprox ? (
      <span title="목록에는 월/일만 있어 연도는 추정">≈{formatShortDate(entry.createdAt)}</span>
    ) : (
      formatShortDate(entry.createdAt)
    ),
  }));

  const rows2001: Row2001[] = page.entries.map((entry) => ({
    key: `${entry.board ?? board}/${entry.postId}`,
    title: entry.title,
    href: entry.hasPost ? `/${entry.board ?? board}/${entry.postId}` : null,
    comments: entry.commentCount,
    author: (
      <AuthorName
        board={entry.board ?? board}
        name={entry.author}
        memberNo={entry.authorMemberNo}
        seed={`${entry.board ?? board}/${entry.postId}`}
      />
    ),
    createdAt: entry.createdAt,
    hits: entry.hits,
  }));

  return (
    <ListTable
      skin={skin}
      rows={rows}
      withHits={false}
      firstNumber={page.totalPosts - (page.page - 1) * BOARD_INDEX_PAGE_SIZE}
      era2001={{
        skin: skin2001Of(board),
        rows: rows2001,
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
