/**
 * A board's museum notes, kept out of the era frame. The museum bar shows
 * the board's name and an (i) button; the notes open in a popover. Inside
 * the frame a board reads as the original list did: the notes above it were
 * the museum's, not the board's.
 *
 * The popover is the native one (`popover`, `popovertarget`): the content
 * pages ship no script for it, and it closes on Escape or a press outside.
 *
 * 2026, the museum's own frame, puts the same notes inside it
 * (`<BoardListing>`) and hides the (i) and its popover (ADR-0023 §2).
 */

import type { ReactNode } from "react";

import Link from "@/components/link";

import { getBoardOrThrow, isBoardId, type BoardId, type BoardMeta } from "@/lib/boards";
import { formatWaybackTs } from "@/lib/dates";
import type { BoardIndexPage, BoardListing } from "@/types/post";

const count = (n: number) => n.toLocaleString("ko-KR");

/** The board's name and (i) in the museum bar, with its notes behind it. */
export function BoardCrumb({
  meta,
  children,
}: {
  meta: Pick<BoardMeta, "nameKr" | "description">;
  children: ReactNode;
}) {
  return (
    <div data-crumb className="flex min-w-0 items-center gap-1">
      <span aria-hidden="true" className="max-sm:hidden">
        ›
      </span>
      <span className="truncate font-bold text-forg-ink">{meta.nameKr}</span>
      <button
        type="button"
        popoverTarget="forg-board-info"
        aria-label={`${meta.nameKr} 안내`}
        className="forg-crumb-info inline-flex size-[15px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-forg-muted text-[10px] leading-none font-semibold text-forg-muted hover:text-forg-ink"
      >
        i
      </button>
      <div
        id="forg-board-info"
        popover="auto"
        className="fixed inset-auto top-[4.25rem] left-[max(1rem,calc(50vw-31rem))] m-0 max-h-[calc(100dvh-5.25rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-md border border-(--era-input-border) bg-white p-3 text-xs leading-relaxed text-forg-ink shadow-lg"
      >
        <p className="font-bold">{meta.nameKr}</p>
        {meta.description && <p className="mt-1">{meta.description}</p>}
        {children}
      </div>
    </div>
  );
}

/** Notes for a board the museum holds posts of. */
function IndexNotes({
  board,
  page,
}: {
  board: BoardId;
  page: Pick<BoardIndexPage, "totalPosts" | "totalWithPost">;
}) {
  const meta = getBoardOrThrow(board);
  const missing = page.totalWithPost < page.totalPosts;
  return (
    <>
      <p className="mt-2">
        전체 {count(page.totalPosts)}개
        {missing ? ` · 본문 보존 ${count(page.totalWithPost)}개` : ""}
      </p>
      {missing && <p className="text-forg-muted">{'"본문 없음"은 목록에 제목만 남은 글입니다.'}</p>}
      {meta.continues && meta.continues.length > 0 && (
        <p className="mt-2 text-forg-muted">
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
    </>
  );
}

/**
 * The notes for a board's list: where its rows came from when it is known
 * only from its captured list pages (`getListOnlyRecord`), else its counts.
 */
export function BoardNotes({
  board,
  page,
  listing,
}: {
  board: BoardId;
  page: Pick<BoardIndexPage, "totalPosts" | "totalWithPost">;
  listing: BoardListing | null;
}) {
  return listing ? <ListingNotes listing={listing} /> : <IndexNotes board={board} page={page} />;
}

/** Notes for a board known only from its captured list pages. */
function ListingNotes({ listing }: { listing: BoardListing }) {
  const withPost = listing.entries.filter((e) => e.hasPost).length;
  const captures = [...new Set(listing.entries.map((e) => e.capturedAt))].sort();
  return (
    <>
      <p className="mt-2">
        목록 {listing.pagesCaptured}쪽(캡처 {listing.capturesRead}번)에서{" "}
        {count(listing.entries.length)}개 제목
        {listing.totalReported !== null
          ? ` (원본 표기 전체 ${count(listing.totalReported)}개)`
          : ""}
        {withPost > 0 ? ` · 본문 보존 ${count(withPost)}개` : ""}
      </p>
      <p className="text-forg-muted">
        {withPost === 0
          ? "글 본문은 Wayback에 캡처되지 않았습니다. 목록 페이지에 남은 제목·이름·날짜·조회수만 보존합니다."
          : '"본문 없음" 표시가 붙은 글은 목록에 제목만 남았습니다.'}
      </p>
      <p className="mt-2 text-forg-muted">
        출처: Wayback Machine 목록 캡처{" "}
        {captures.map((ts, i) => (
          <span key={ts}>
            {i > 0 ? " · " : ""}
            {formatWaybackTs(ts)}
          </span>
        ))}
      </p>
    </>
  );
}
