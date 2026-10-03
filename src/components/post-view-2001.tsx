/**
 * A post's head and comments as the 2001 Zeroboard 4.0 skins drew them
 * (ADR-0019), shown in the 2001 era in place of `<PostView>`'s own. The body
 * between them is the same element in every era; `src/styles/eras.css` gives it the
 * skin's padding and line height.
 *
 * N+gine (`Z/Q_A/3106`, 2001-07-15):
 *
 *   [title_bg: last_left · view_article · · · last_right]          23px
 *   Name    │ [OF]럽          label cell: 100px, label bg, accent text
 *   ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  dot_line (never captured: a dotted rule)
 *   Subject │ **Mirc에 대한 궁금증**
 *   body: padding 10px, line-height 160%
 *   comment rows: #f9f9f9, name (80px, bold) · ::: memo — no date
 *
 * n_board (Notice, Events; `Z/Notice/139`): a 3px #9F9F9F rule, the title
 * centred and bold in a 30px row, then the author in bold. The template had
 * the comment block commented out; the museum keeps the comments a post has,
 * in the N+gine rows.
 */

import { CommentAuthor, commentSeed, PostAuthor } from "@/components/author-name";
import { SkinImg2001 } from "@/components/skin-img-2001";

import { SanitizedHtml } from "@/components/sanitized-html";
import type { Skin2001 } from "@/lib/skins-2001";
import type { Post } from "@/types/post";

export function PostHead2001({ skin, post }: { skin: Skin2001; post: Post }) {
  const author = <PostAuthor post={post} />;
  if (skin === "n_board") {
    return (
      <header data-pagefind-ignore className="text-[12px]">
        <div className="bg-zb40-news-bar h-[3px]" />
        <p className="flex min-h-[30px] items-center justify-center px-2 text-center font-bold">
          {post.title}
        </p>
        <p className="px-2 pb-2 font-bold">{author}</p>
      </header>
    );
  }
  const labelCell =
    "w-[100px] bg-(--zb40-label) pr-2 text-right align-middle font-[Tahoma,sans-serif] text-[11px] font-bold text-(--zb40-accent)";
  return (
    <header data-pagefind-ignore data-skin-2001={skin} className="text-[12px]">
      <div className="flex h-[23px] items-center justify-between bg-(--zb40-label)">
        <span>
          <SkinImg2001 skin={skin} file="last_left.gif" />
          &nbsp;&nbsp;
          <SkinImg2001 skin={skin} file="view_article.gif" alt="View Article" />
        </span>
        <SkinImg2001 skin={skin} file="last_right.gif" />
      </div>
      <table className="w-full border-collapse">
        <tbody>
          <tr className="h-[23px]">
            <td className={labelCell}>Name</td>
            <td className="pl-2 font-bold">{author}</td>
          </tr>
          <tr>
            <td colSpan={2} className="border-zb40-dots h-px border-b border-dotted p-0" />
          </tr>
          <tr className="h-[23px]">
            <td className={labelCell}>Subject</td>
            <td className="pl-2 font-bold break-all">{post.title}</td>
          </tr>
          <tr>
            <td colSpan={2} className="border-zb40-dots h-px border-b border-dotted p-0" />
          </tr>
        </tbody>
      </table>
    </header>
  );
}

export function CommentList2001({ post }: { post: Post }) {
  if (post.comments.length === 0) return null;
  return (
    <section
      data-pagefind-ignore
      aria-label={`댓글 ${String(post.comments.length)}`}
      className="text-[12px]"
    >
      {post.comments.map((c, i) => (
        <div key={commentSeed(i)} className="bg-zb40-comment mt-px flex gap-1 p-[2px]">
          <b className="w-[80px] shrink-0 break-all">
            <CommentAuthor board={post.board} comment={c} index={i} />
          </b>
          <span className="text-zb40-dots shrink-0">:::</span>
          <SanitizedHtml html={c.bodyHtml} className="min-w-0" />
        </div>
      ))}
    </section>
  );
}
