/**
 * A post's comments, drawn the way the post's own board drew them.
 *
 * - `kritz` (Zeroboard, 2000–2007): each comment opens with a 20px strip —
 *   `border:1px solid #dfdfdf; background:white url(skin/kritz_normal/title_bg.jpg)`
 *   holding "comment by <name> at <YYYY/MM/DD>" in Verdana 10px, a member's name
 *   bold (its `#EF5900` font lost to the link style) and a guest's plain — then the text,
 *   unboxed, in `#363636`.
 * - `webbus` (Gnuboard4, 2008–2016): a `#cbd1d4` bar with the name in bold on
 *   the left and "MM-DD HH:mm" on the right, the text below it and a 1px rule.
 * - `plain` (forg.kr, Gnuboard5): the museum's own layout, each comment
 *   between two rules across the post box, its text on the body's 10px edge.
 *
 * Dates are cut from the ISO text, not through `Date`, so the build's time
 * zone cannot move them; the full time is in the `title`.
 */

import type { ReactNode } from "react";

import { CommentAuthor, commentSeed } from "@/components/author-name";
import { SanitizedHtml } from "@/components/sanitized-html";
import { chromeUrl, tileStyle } from "@/lib/chrome";
import {
  formatKoreanDateTime,
  formatMonthDayTime,
  formatSlashDate,
  isUnknownDate,
} from "@/lib/dates";
import type { ListSkin } from "@/lib/skins";
import type { Comment } from "@/types/post";

interface ItemProps {
  comment: Comment;
  /** The post's board, for its author's name. */
  board: string;
  /** The comment's place in `post.comments`, shared with the 2001 skin's copy. */
  index: number;
}

/** A comment strip's date in the skin's own short form, the full time as a tooltip. */
function StripDate({ iso, format }: { iso: string; format: (iso: string) => string }) {
  return (
    <span title={formatKoreanDateTime(iso)}>
      {isUnknownDate(iso) ? "작성일 미상" : format(iso)}
    </span>
  );
}

const KRITZ_STRIP = chromeUrl("zb_kritz_title_bg.jpg");

function KritzComment({ comment, board, index }: ItemProps) {
  return (
    <li>
      <div
        className="flex h-[20px] items-center border border-kritz-comment-border bg-white bg-repeat-x px-[2px] font-[Verdana,sans-serif] text-[10px] text-black"
        style={tileStyle(KRITZ_STRIP)}
      >
        comment by&nbsp;
        <b className={comment.authorMemberNo ? "font-bold" : "font-normal"}>
          <CommentAuthor board={board} comment={comment} index={index} />
        </b>
        &nbsp;at&nbsp;
        <StripDate iso={comment.createdAt} format={formatSlashDate} />
      </div>
      <SanitizedHtml
        html={comment.bodyHtml}
        className="p-[5px] text-[12px] leading-[1.4] text-kritz-comment-text"
      />
    </li>
  );
}

function WebbusComment({ comment, board, index }: ItemProps) {
  return (
    <li className="border-b border-webbus-comment-rule pb-[2px]">
      <div className="flex items-end justify-between bg-webbus-comment-bar p-[2px] text-[11px] text-black">
        <b>
          <CommentAuthor board={board} comment={comment} index={index} />
        </b>
        <StripDate iso={comment.createdAt} format={formatMonthDayTime} />
      </div>
      <SanitizedHtml
        html={comment.bodyHtml}
        className="px-[2px] pt-[5px] pb-[2px] text-[12px] text-black"
      />
    </li>
  );
}

function PlainComment({ comment, board, index }: ItemProps) {
  return (
    <li className="border-y border-(--era-input-border)/50 bg-(--era-content-bg) px-[10px] py-2">
      <div className="mb-1 flex items-baseline gap-2 text-xs text-forg-muted">
        <span className="font-bold text-forg-ink">
          <CommentAuthor board={board} comment={comment} index={index} />
        </span>
        <time dateTime={comment.createdAt}>{formatKoreanDateTime(comment.createdAt)}</time>
      </div>
      <SanitizedHtml html={comment.bodyHtml} className="text-forg-ink" />
    </li>
  );
}

const ITEM: Record<ListSkin, (props: ItemProps) => ReactNode> = {
  kritz: KritzComment,
  webbus: WebbusComment,
  plain: PlainComment,
};

export function CommentList({
  board,
  comments,
  skin,
}: {
  board: string;
  comments: Comment[];
  skin: ListSkin;
}) {
  const Item = ITEM[skin];
  return (
    <ol className={skin === "plain" ? "space-y-3 text-sm" : "space-y-[6px]"}>
      {comments.map((c, i) => (
        <Item key={commentSeed(i)} comment={c} board={board} index={i} />
      ))}
    </ol>
  );
}
