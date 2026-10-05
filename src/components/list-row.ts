/**
 * The list-row model every view of a board list draws from, and the wording
 * its title-only rows share.
 */

import type { ReactNode } from "react";

import type { AuthorRef } from "@/components/author-name";

/** Tooltip of a title-only row's title, in every era. */
export const NO_BODY_TOOLTIP = "본문은 캡처되지 않았습니다 — 목록에 남은 제목";

/**
 * How a row's date was arrived at when no capture printed it whole, and how
 * every era marks it: `year` — the list printed MM/DD and the year was
 * inferred; `firstComment` — the post's own date was missing and its first
 * comment's time stands in.
 */
export type DateApprox = "year" | "firstComment";

export const DATE_APPROX: Readonly<Record<DateApprox, { mark: string; tooltip: string }>> = {
  year: { mark: "≈", tooltip: "목록에는 월/일만 있어 연도는 추정" },
  firstComment: { mark: "≤", tooltip: "작성일이 캡처에 없어 첫 댓글 시각으로 대신함" },
};

/**
 * One list row, for every view of it: the phone list, the 2014/2003 table and
 * the 2001 skin (`list-skin-2001`). Built by `board-rows.tsx`.
 */
export interface ListRow {
  /** Unique in the list; also the daemon-name seed of its author. */
  key: string;
  title: string;
  /** The post, or null for a row known only from a captured list page. */
  href: string | null;
  commentCount: number;
  /** Rendered by each view, so a plain name is a string in each, not a reference. */
  author: AuthorRef;
  createdAt: string | null;
  /** Set when `createdAt` is not the post's own full date (`DATE_APPROX`). */
  dateApprox: DateApprox | null;
  hits: number | null;
  /** A notice the board pinned: the rows above the rest on page 1. */
  notice: boolean;
  /** 0 for a post; a reply's depth, 1 and up. */
  replyDepth: number;
  /**
   * The 2014/2003 cells, built once: the phone list and the table share each
   * element, which the RSC payload then carries once.
   */
  cells: {
    /** A link, or plain text for a title-only row. */
    title: ReactNode;
    date: ReactNode;
    /** Only read when the table has a 조회 column. */
    hits?: ReactNode;
  };
}
