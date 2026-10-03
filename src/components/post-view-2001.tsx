/**
 * A post's head and comments as the 2001 Zeroboard 4.0 skins drew them
 * (ADR-0019), shown in the 2001 era in place of `<PostView>`'s own. The body
 * between them is the same element in every era; `globals.css` gives it the
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

import { AuthorName, commentSeed, POST_SEED } from "@/components/author-name";
import { SkinImg2001 } from "@/components/list-skin-2001";

import { SanitizedHtml } from "@/components/sanitized-html";
import { PALETTE_2001, type Skin2001 } from "@/lib/skins-2001";
import type { Post } from "@/types/post";

export function ViewHead2001({ skin, post }: { skin: Skin2001; post: Post }) {
  const author = (
    <AuthorName
      board={post.board}
      name={post.author}
      memberNo={post.authorMemberNo}
      seed={POST_SEED}
    />
  );
  if (skin === "n_board") {
    return (
      <header data-pagefind-ignore className="text-[12px]">
        <div className="h-[3px] bg-[#9f9f9f]" />
        <p className="flex min-h-[30px] items-center justify-center px-2 text-center font-bold">
          {post.title}
        </p>
        <p className="px-2 pb-2 font-bold">{author}</p>
      </header>
    );
  }
  const { label, accent } = PALETTE_2001[skin];
  const labelCell =
    "w-[100px] pr-2 text-right align-middle font-[Tahoma,sans-serif] text-[11px] font-bold";
  return (
    <header data-pagefind-ignore className="text-[12px]">
      <div className="flex h-[23px] items-center justify-between" style={{ background: label }}>
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
            <td className={labelCell} style={{ background: label, color: accent }}>
              Name
            </td>
            <td className="pl-2 font-bold">{author}</td>
          </tr>
          <tr>
            <td colSpan={2} className="h-px border-b border-dotted border-[#bbbbbb] p-0" />
          </tr>
          <tr className="h-[23px]">
            <td className={labelCell} style={{ background: label, color: accent }}>
              Subject
            </td>
            <td className="pl-2 font-bold break-all">{post.title}</td>
          </tr>
          <tr>
            <td colSpan={2} className="h-px border-b border-dotted border-[#bbbbbb] p-0" />
          </tr>
        </tbody>
      </table>
    </header>
  );
}

export function Comments2001({ post }: { post: Post }) {
  if (post.comments.length === 0) return null;
  return (
    <section
      data-pagefind-ignore
      aria-label={`댓글 ${String(post.comments.length)}`}
      className="text-[12px]"
    >
      {post.comments.map((c, i) => (
        <div
          key={`${c.author}-${c.createdAt}-${String(i)}`}
          className="mt-px flex gap-1 bg-[#f9f9f9] p-[2px]"
        >
          <b className="w-[80px] shrink-0 break-all">
            <AuthorName
              board={post.board}
              name={c.author}
              memberNo={c.authorMemberNo}
              seed={commentSeed(i)}
            />
          </b>
          <span className="shrink-0 text-[#bbbbbb]">:::</span>
          <SanitizedHtml html={c.bodyHtml} className="min-w-0" />
        </div>
      ))}
    </section>
  );
}
