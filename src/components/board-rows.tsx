/**
 * The rows `ListTable` draws (`ListRow`), one per entry for every view of a
 * list: the phone list, the 2014/2003 table and the 2001 skin.
 *
 * `indexRows` — a page of a board index: posts the museum keeps, plus the
 * title-only rows the index carries in from captured list pages (all of
 * them, for a board known only from its list pages).
 */

import type { ReactNode } from "react";

import { ChromeImg } from "@/components/chrome-img";
import Link from "@/components/link";
import { DATE_APPROX, NO_BODY_TOOLTIP, type DateApprox, type ListRow } from "@/components/list-row";
import type { BoardId } from "@/lib/boards";
import { chromeUrl } from "@/lib/chrome";
import { formatShortDate } from "@/lib/dates";
import { isHot, type ListSkin } from "@/lib/skins";
import type { BoardIndexPage } from "@/types/post";

const TITLE_LAYOUT = "inline-flex items-baseline gap-[4px] leading-[1.7]";

/**
 * The 2014/2003 title cell — category, title, comment count and the skin's
 * marks — as a link when the museum holds the post, text when the row is
 * known only from a captured list page (ADR-0017 §4). `marked` greys a
 * title-only row and adds 본문 없음 — on boards that keep posts, where such a
 * row is the exception. On a board that keeps none every row is title-only,
 * and its header says so.
 */
function TitleCell({
  href,
  marked,
  skin,
  board,
  category,
  title,
  commentCount,
  attachmentCount,
  hits,
}: {
  href: string | null;
  marked: boolean;
  skin: ListSkin;
  board: BoardId;
  category: string | null;
  title: string;
  commentCount: number;
  attachmentCount: number;
  hits: number | null;
}) {
  const body = (
    <>
      {category ? <span className="shrink-0 text-[10px] text-forg-muted">[{category}]</span> : null}
      <span className="truncate">{title}</span>
      <CommentCount count={commentCount} skin={skin} />
      <RowMarks skin={skin} board={board} attachmentCount={attachmentCount} hits={hits} />
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`text-forg-ink ${TITLE_LAYOUT} hover:underline`}>
        {body}
      </Link>
    );
  }
  return (
    <span
      className={`${marked ? "text-forg-muted" : "text-forg-ink"} ${TITLE_LAYOUT}`}
      title={NO_BODY_TOOLTIP}
    >
      {body}
      {marked && <NoBodyMark />}
    </span>
  );
}

/** The 2014/2003 date, with its mark and tooltip when it is approximate. */
function shortDate(iso: string, approx: DateApprox | null): ReactNode {
  if (!approx) return formatShortDate(iso);
  const { mark, tooltip } = DATE_APPROX[approx];
  return (
    <span title={tooltip}>
      {mark}
      {formatShortDate(iso)}
    </span>
  );
}

export function indexRows(board: BoardId, page: BoardIndexPage, skin: ListSkin): ListRow[] {
  const marked = page.totalWithPost > 0;
  // Hits only where every row came from a list, which printed them; a board
  // with posts has none to show (ADR-0016 §5), on the phone list either.
  const listOnly = page.totalWithPost === 0;
  return page.entries.map((entry) => {
    const postBoard = entry.board ?? board;
    const href = entry.hasPost ? `/${postBoard}/${entry.postId}` : null;
    const dateApprox: DateApprox | null = entry.createdAtApprox
      ? "firstComment"
      : entry.datedByCapture
        ? "capture"
        : entry.yearApprox
          ? "year"
          : null;
    return {
      key: `${postBoard}/${entry.postId}`,
      title: entry.title,
      href,
      commentCount: entry.commentCount,
      author: { board: postBoard, name: entry.author, memberNo: entry.authorMemberNo },
      createdAt: entry.createdAt,
      dateApprox,
      hits: entry.hits,
      notice: entry.isNotice === true,
      replyDepth: entry.replyDepth ?? 0,
      cells: {
        title: (
          <TitleCell
            href={href}
            marked={marked}
            skin={skin}
            board={board}
            category={entry.categoryLabel}
            title={entry.title}
            commentCount={entry.commentCount}
            attachmentCount={entry.attachmentCount}
            hits={entry.hits}
          />
        ),
        date: shortDate(entry.createdAt, dateApprox),
        ...(listOnly && { hits: entry.hits === null ? "—" : entry.hits.toLocaleString("ko-KR") }),
      },
    };
  });
}

/**
 * After the title of a row known only from a captured list page: there is no
 * post behind it, and greyed text alone read as a broken link (the old `title`
 * tooltip never shows on a phone). The museum's own mark.
 */
function NoBodyMark() {
  return (
    <span className="shrink-0 rounded-[2px] border border-current/40 px-[3px] text-[10px] leading-[14px] whitespace-nowrap text-forg-muted">
      본문 없음
    </span>
  );
}

/**
 * The comment count after a title, in each skin's own form: `kritz`
 * `<font style=font-family:Tahoma;font-size:7pt;>[4]</font>`, `webbus`
 * `<span style='font-family:Tahoma;font-size:10px;color:#EE5A00;'><b>(19)</b></span>`.
 */
function CommentCount({ count, skin }: { count: number; skin: ListSkin }) {
  if (count <= 0) return null;
  if (skin === "webbus") {
    return (
      <span className="shrink-0 font-[Tahoma,sans-serif] text-[10px] font-bold text-webbus-comment tabular-nums">
        ({count})
      </span>
    );
  }
  return (
    <span className="shrink-0 font-[Tahoma,sans-serif] text-[7pt] tabular-nums">[{count}]</span>
  );
}

/**
 * What follows the count. `webbus` drew `icon_file.gif` for an attachment and
 * `icon_hot.gif` for a hot post, in that order; the Zeroboard list skins drew
 * neither, and the museum keeps its `⊕N` hint there. A row whose hit count
 * did not survive gets no `icon_hot` rather than a guessed one.
 */
function RowMarks({
  skin,
  board,
  attachmentCount,
  hits,
}: {
  skin: ListSkin;
  board: BoardId;
  attachmentCount: number;
  hits: number | null;
}) {
  if (skin === "webbus") {
    return (
      <>
        {attachmentCount > 0 && (
          <MarkIcon
            url={chromeUrl("gb_icon_file.gif")}
            width={9}
            height={9}
            label={`첨부 ${attachmentCount}개`}
          />
        )}
        {isHot(board, hits) && (
          <MarkIcon url={chromeUrl("gb_icon_hot.gif")} width={11} height={9} label="조회 많음" />
        )}
      </>
    );
  }
  if (attachmentCount <= 0) return null;
  return (
    <span
      aria-label={`첨부 ${attachmentCount}개`}
      className="shrink-0 text-[10.5px] text-forg-muted tabular-nums"
    >
      ⊕{attachmentCount}
    </span>
  );
}

function MarkIcon({
  url,
  width,
  height,
  label,
}: {
  url: string;
  width: number;
  height: number;
  label: string;
}) {
  return (
    <ChromeImg
      src={url}
      alt={label}
      width={width}
      height={height}
      className="shrink-0 self-center"
    />
  );
}
