/**
 * The rows `ListTable` draws (`ListRow`), one per entry for every view of a
 * list: the phone list, the 2014/2003 table and the 2001 skin.
 *
 * - `indexRows` — a page of a board index: posts the museum keeps, plus the
 *   title-only rows the index carries in from captured list pages.
 * - `listingRows` — a board known only from its captured list pages.
 */

import type { ReactNode } from "react";

import Link from "@/components/link";
import {
  CommentCount,
  NoBodyMark,
  RowMarks,
  type ListRow,
  type ListSkin,
} from "@/components/list-skin";
import type { BoardId } from "@/lib/boards";
import { formatShortDate } from "@/lib/dates";
import type { BoardIndexPage, BoardListing } from "@/types/post";

const TITLE_LAYOUT = "inline-flex items-baseline gap-[4px] leading-[1.7]";

/**
 * The 2014/2003 title cell: a link when the museum holds the post, text when
 * the row is known only from a captured list page (ADR-0017 §4). `marked`
 * greys a title-only row and adds 본문 없음 — on boards that keep posts, where
 * such a row is the exception. On a board that keeps none every row is
 * title-only, and its header says so.
 */
function RowTitle({
  href,
  marked,
  tooltip,
  children,
}: {
  href: string | null;
  marked: boolean;
  tooltip: string;
  children: ReactNode;
}) {
  if (href) {
    return (
      <Link href={href} className={`text-forg-ink ${TITLE_LAYOUT} hover:underline`}>
        {children}
      </Link>
    );
  }
  return (
    <span
      className={`${marked ? "text-forg-muted" : "text-forg-ink"} ${TITLE_LAYOUT}`}
      title={tooltip}
    >
      {children}
      {marked && <NoBodyMark />}
    </span>
  );
}

/** Category, title, comment count and the skin's marks. */
function TitleBody({
  skin,
  board,
  category,
  title,
  commentCount,
  attachmentCount,
  hits,
}: {
  skin: ListSkin;
  board: BoardId;
  category: string | null;
  title: string;
  commentCount: number;
  attachmentCount: number;
  hits: number | null;
}) {
  return (
    <>
      {category ? <span className="text-forg-muted shrink-0 text-[10px]">[{category}]</span> : null}
      <span className="truncate">{title}</span>
      <CommentCount count={commentCount} skin={skin} />
      <RowMarks skin={skin} board={board} attachmentCount={attachmentCount} hits={hits} />
    </>
  );
}

/** A date whose year was inferred: `≈` plus why, as a tooltip. */
function yearGuess(iso: string, tooltip: string): ReactNode {
  return <span title={tooltip}>≈{formatShortDate(iso)}</span>;
}

export function indexRows(board: BoardId, page: BoardIndexPage, skin: ListSkin): ListRow[] {
  const marked = page.totalWithPost > 0;
  return page.entries.map((entry) => {
    const postBoard = entry.board ?? board;
    const href = entry.hasPost ? `/${postBoard}/${entry.postId}` : null;
    return {
      key: `${postBoard}/${entry.postId}`,
      title: entry.title,
      href,
      commentCount: entry.commentCount,
      author: { board: postBoard, name: entry.author, memberNo: entry.authorMemberNo },
      createdAt: entry.createdAt,
      hits: entry.hits,
      cells: {
        title: (
          <RowTitle
            href={href}
            marked={marked}
            tooltip="본문은 캡처되지 않았습니다 — 목록에 남은 제목"
          >
            <TitleBody
              skin={skin}
              board={board}
              category={entry.categoryLabel}
              title={entry.title}
              commentCount={entry.commentCount}
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
          yearGuess(entry.createdAt, "목록에는 월/일만 있어 연도는 추정")
        ) : (
          formatShortDate(entry.createdAt)
        ),
      },
    };
  });
}

export function listingRows(board: BoardId, listing: BoardListing, skin: ListSkin): ListRow[] {
  const marked = listing.entries.some((e) => e.hasPost);
  return listing.entries.map((entry) => {
    const href = entry.hasPost ? `/${board}/${entry.no}` : null;
    return {
      key: entry.no,
      title: entry.title,
      href,
      commentCount: entry.commentCount,
      author: { board, name: entry.author, memberNo: entry.authorMemberNo },
      createdAt: entry.createdAt,
      hits: entry.hits,
      cells: {
        title: (
          <RowTitle href={href} marked={marked} tooltip="본문은 캡처되지 않았습니다">
            <TitleBody
              skin={skin}
              board={board}
              category={entry.categoryLabel}
              title={entry.title}
              commentCount={entry.commentCount}
              attachmentCount={0}
              hits={entry.hits}
            />
          </RowTitle>
        ),
        date:
          entry.createdAt === null
            ? "—"
            : entry.yearApprox
              ? yearGuess(entry.createdAt, "목록에는 월/일만 있어 연도는 캡처 시점으로 추정")
              : formatShortDate(entry.createdAt),
        hits: entry.hits === null ? "—" : entry.hits.toLocaleString("ko-KR"),
      },
    };
  });
}
