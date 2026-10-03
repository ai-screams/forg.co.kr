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
 * - `plain` (forg.kr, Gnuboard5): the museum's own card layout.
 *
 * Dates are cut from the ISO text, not through `Date`, so the build's time
 * zone cannot move them; the full time is in the `title`.
 */

import { AuthorName, commentSeed } from "@/components/author-name";
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
  /** The post's board, for `AuthorName`. */
  board: string;
  /** `AuthorName`'s seed: the comment's place, shared with the 2001 skin's copy. */
  seed: string;
}

function Author({ comment, board, seed }: ItemProps) {
  return (
    <AuthorName board={board} name={comment.author} memberNo={comment.authorMemberNo} seed={seed} />
  );
}

function Body({ comment, className }: { comment: Comment; className: string }) {
  return <SanitizedHtml html={comment.bodyHtml} className={className} />;
}

const KRITZ_STRIP = chromeUrl("zb_kritz_title_bg.jpg");

function KritzComment({ comment, board, seed }: ItemProps) {
  const unknown = isUnknownDate(comment.createdAt);
  return (
    <li>
      <div
        className="flex h-[20px] items-center border border-[#dfdfdf] bg-white bg-repeat-x px-[2px] font-[Verdana,sans-serif] text-[10px] text-black"
        style={tileStyle(KRITZ_STRIP)}
      >
        comment by&nbsp;
        <b className={comment.authorMemberNo ? "font-bold" : "font-normal"}>
          <Author comment={comment} board={board} seed={seed} />
        </b>
        &nbsp;at&nbsp;
        <span title={formatKoreanDateTime(comment.createdAt)}>
          {unknown ? "작성일 미상" : formatSlashDate(comment.createdAt)}
        </span>
      </div>
      <Body comment={comment} className="p-[5px] text-[12px] leading-[1.4] text-[#363636]" />
    </li>
  );
}

function WebbusComment({ comment, board, seed }: ItemProps) {
  const unknown = isUnknownDate(comment.createdAt);
  return (
    <li className="border-b border-[#e3e3e3] pb-[2px]">
      <div className="flex items-end justify-between bg-[#cbd1d4] p-[2px] text-[11px] text-black">
        <b>
          <Author comment={comment} board={board} seed={seed} />
        </b>
        <span title={formatKoreanDateTime(comment.createdAt)}>
          {unknown ? "작성일 미상" : formatMonthDayTime(comment.createdAt)}
        </span>
      </div>
      <Body comment={comment} className="px-[2px] pt-[5px] pb-[2px] text-[12px] text-black" />
    </li>
  );
}

function PlainComment({ comment, board, seed }: ItemProps) {
  return (
    <li className="border border-(--era-input-border)/50 bg-(--era-content-bg) px-3 py-2">
      <div className="text-forg-muted mb-1 flex items-baseline gap-2 text-xs">
        <span className="text-forg-ink font-bold">
          <Author comment={comment} board={board} seed={seed} />
        </span>
        <time dateTime={comment.createdAt}>{formatKoreanDateTime(comment.createdAt)}</time>
      </div>
      <Body comment={comment} className="text-forg-ink" />
    </li>
  );
}

export function CommentList({
  board,
  comments,
  skin,
}: {
  board: string;
  comments: Comment[];
  skin: ListSkin;
}) {
  const Item = skin === "kritz" ? KritzComment : skin === "webbus" ? WebbusComment : PlainComment;
  return (
    <ol className={skin === "plain" ? "space-y-3 text-sm" : "space-y-[6px]"}>
      {comments.map((c, i) => (
        <Item key={commentSeed(i)} comment={c} board={board} seed={commentSeed(i)} />
      ))}
    </ol>
  );
}
