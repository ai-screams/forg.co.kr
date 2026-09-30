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

import type { ListSkin } from "@/components/list-skin";
import { chromeUrl } from "@/lib/chrome";
import { formatKoreanDateTime, isUnknownDate } from "@/lib/dates";
import { withImgBase } from "@/lib/img-base";
import type { Post } from "@/types/post";

type Comment = Post["comments"][number];

function ymd(iso: string): string {
  return `${iso.slice(0, 4)}/${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
}

function mdhm(iso: string): string {
  return `${iso.slice(5, 7)}-${iso.slice(8, 10)} ${iso.slice(11, 16)}`;
}

function Body({ comment, className }: { comment: Comment; className: string }) {
  return (
    <div
      className={className}
      // nh3-sanitised at ETL Stage 2 (ADR-0008)
      dangerouslySetInnerHTML={{ __html: withImgBase(comment.bodyHtml) }}
    />
  );
}

const KRITZ_STRIP = chromeUrl("zb_kritz_title_bg.jpg");

function KritzComment({ comment }: { comment: Comment }) {
  const unknown = isUnknownDate(comment.createdAt);
  return (
    <li>
      <div
        className="flex h-[20px] items-center border border-[#dfdfdf] bg-white bg-repeat-x px-[2px] font-[Verdana,sans-serif] text-[10px] text-black"
        style={KRITZ_STRIP ? { backgroundImage: `url(${KRITZ_STRIP})` } : undefined}
      >
        comment by&nbsp;
        <b className={comment.authorMemberNo ? "font-bold" : "font-normal"}>{comment.author}</b>
        &nbsp;at&nbsp;
        <span title={formatKoreanDateTime(comment.createdAt)}>
          {unknown ? "작성일 미상" : ymd(comment.createdAt)}
        </span>
      </div>
      <Body comment={comment} className="p-[5px] text-[12px] leading-[1.4] text-[#363636]" />
    </li>
  );
}

function WebbusComment({ comment }: { comment: Comment }) {
  const unknown = isUnknownDate(comment.createdAt);
  return (
    <li className="border-b border-[#e3e3e3] pb-[2px]">
      <div className="flex items-end justify-between bg-[#cbd1d4] p-[2px] text-[11px] text-black">
        <b>{comment.author}</b>
        <span title={formatKoreanDateTime(comment.createdAt)}>
          {unknown ? "작성일 미상" : mdhm(comment.createdAt)}
        </span>
      </div>
      <Body comment={comment} className="px-[2px] pt-[5px] pb-[2px] text-[12px] text-black" />
    </li>
  );
}

function PlainComment({ comment }: { comment: Comment }) {
  return (
    <li className="border border-(--era-input-border)/50 bg-(--era-content-bg) px-3 py-2">
      <div className="text-forg-muted mb-1 flex items-baseline gap-2 text-xs">
        <span className="text-forg-ink font-bold">{comment.author}</span>
        <time dateTime={comment.createdAt}>{formatKoreanDateTime(comment.createdAt)}</time>
      </div>
      <Body comment={comment} className="text-forg-ink" />
    </li>
  );
}

export function CommentList({ comments, skin }: { comments: Comment[]; skin: ListSkin }) {
  const Item = skin === "kritz" ? KritzComment : skin === "webbus" ? WebbusComment : PlainComment;
  return (
    <ol className={skin === "plain" ? "space-y-3 text-sm" : "space-y-[6px]"}>
      {comments.map((c, i) => (
        <Item key={`${c.author}-${c.createdAt}-${String(i)}`} comment={c} />
      ))}
    </ol>
  );
}
