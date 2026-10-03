/**
 * The list-row model every view of a board list draws from, and the wording
 * its title-only rows share.
 */

import type { ReactNode } from "react";

import type { AuthorRef } from "@/components/author-name";

/** Tooltip of a title-only row's title, in every era. */
export const NO_BODY_TOOLTIP = "본문은 캡처되지 않았습니다 — 목록에 남은 제목";

/** Tooltip of a date whose year was inferred (`≈`). */
export const YEAR_GUESS_TOOLTIP = "목록에는 월/일만 있어 연도는 추정";

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
  hits: number | null;
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
