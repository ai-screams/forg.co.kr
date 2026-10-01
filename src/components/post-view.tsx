/**
 * Renders a fully sanitised forg post.
 *
 * Markup is era-invariant — the visual delta between 2014 and 2003 is
 * driven entirely by `<html data-era>` and the CSS variables defined in
 * `globals.css`. This component never branches on the era.
 *
 * `bodyHtml` and comment `bodyHtml` are pre-sanitised by nh3 (ETL Stage 2,
 * ADR-0008). We render them with `dangerouslySetInnerHTML`; React 19 ships
 * no built-in HTML primitive, and re-sanitising on the client adds nothing
 * for a static-export read-only museum.
 */

import { CommentList } from "@/components/comment-list";
import Link from "@/components/link";
import { listSkinOf } from "@/components/list-skin";

import { getBoardOrThrow, type BoardId } from "@/lib/boards";
import { formatKoreanDateTime, formatWaybackTs, isUnknownDate } from "@/lib/dates";
import { withImgBase } from "@/lib/img-base";
import type { AdjacentPosts } from "@/lib/posts";
import type { BoardIndexEntry, Post } from "@/types/post";

interface PostViewProps {
  post: Post;
  adjacent?: AdjacentPosts;
}

export function PostView({ post, adjacent }: PostViewProps) {
  const board = getBoardOrThrow(post.board);
  const created = formatKoreanDateTime(post.createdAt);
  // 작성일이 1970년인 Zeroboard NULL placeholder는 캡처 시점을 보조 표시.
  const createdUnknown = isUnknownDate(post.createdAt);
  const capturedDate = createdUnknown ? formatWaybackTs(post.capturedAt) : null;

  return (
    <article
      className="text-forg-ink border border-(--era-input-border)/50 bg-white"
      data-pagefind-body
      data-pagefind-sort={`date:${post.createdAt}`}
    >
      {/* Pagefind filter/meta attributes — screen-reader-only, not visible */}
      <span className="sr-only" data-pagefind-filter="board">
        {post.board}
      </span>
      <span className="sr-only" data-pagefind-filter="era">
        {post.era}
      </span>

      <header className="border-b border-(--era-input-border) px-6 py-5">
        <p className="text-forg-muted text-xs" data-pagefind-ignore>
          <Link href={`/${board.id}`} className="text-(--era-link) hover:text-(--era-link-hover)">
            {board.nameKr}
          </Link>
        </p>
        <h1
          className="text-forg-ink mt-2 text-2xl font-bold"
          data-pagefind-meta="title"
          data-pagefind-weight="2"
        >
          {post.title}
        </h1>
        <dl className="text-forg-muted mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <div className="flex gap-1">
            <dt className="font-bold">작성</dt>
            <dd>
              {post.authorHomepage ? (
                <a
                  href={post.authorHomepage}
                  rel="nofollow noreferrer external"
                  target="_blank"
                  className="text-(--era-link) hover:text-(--era-link-hover)"
                  data-pagefind-meta="author"
                >
                  {post.author}
                </a>
              ) : (
                <span data-pagefind-meta="author">{post.author}</span>
              )}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-bold">날짜</dt>
            <dd>
              <time dateTime={post.createdAt}>{created}</time>
              {post.createdAtApprox && (
                <span className="text-forg-muted/70 ml-1.5 text-[0.7rem]">
                  (이전 — 첫 댓글 시각, 작성일은 캡처에 없음)
                </span>
              )}
              {capturedDate && (
                <span className="text-forg-muted/70 ml-1.5 text-[0.7rem]">
                  (캡처 {capturedDate})
                </span>
              )}
            </dd>
          </div>
          {post.hits !== null && (
            <div className="flex gap-1">
              <dt className="font-bold">조회</dt>
              <dd>{post.hits.toLocaleString("ko-KR")}</dd>
            </div>
          )}
          {post.recommend !== null && post.recommend > 0 && (
            <div className="flex gap-1">
              <dt className="font-bold">추천</dt>
              <dd>{post.recommend.toLocaleString("ko-KR")}</dd>
            </div>
          )}
          <div className="flex gap-1">
            <dt className="font-bold">시기</dt>
            <dd>{post.era}</dd>
          </div>
        </dl>
      </header>

      <div className="px-6 py-6">
        <div
          // break-word: divider lines of "____" and long URLs have no break
          // point and pushed a phone-width page sideways (the Zeroboard body
          // cell had `word-break:break-all` for the same reason). A table
          // too wide for the column scrolls inside the body, not the page.
          // Below 800px only: on a desktop both changed the original layout.
          className="post-body text-forg-ink leading-relaxed max-[799px]:overflow-x-auto max-[799px]:[overflow-wrap:break-word]"
          // nh3-sanitised at ETL Stage 2 (ADR-0008)
          dangerouslySetInnerHTML={{ __html: withImgBase(post.bodyHtml) }}
        />
      </div>

      {post.attachments.length > 0 && (
        <section
          aria-labelledby={`attachments-${post.postId}`}
          className="border-t border-(--era-input-border) px-6 py-4"
        >
          <h2 id={`attachments-${post.postId}`} className="text-forg-ink mb-2 text-sm font-bold">
            첨부파일
          </h2>
          <ul className="text-forg-muted space-y-1 text-sm">
            {post.attachments.map((att) => (
              <li key={att.fileNum}>
                <span className="font-mono">{att.name}</span>
                {att.sizeBytes !== null && (
                  <span className="text-forg-muted ml-2 text-xs">
                    ({formatBytes(att.sizeBytes)})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {post.comments.length > 0 && (
        <section
          aria-labelledby={`comments-${post.postId}`}
          className="border-t border-(--era-input-border) px-6 py-5"
        >
          {/* The originals printed no heading over the comments. */}
          <h2 id={`comments-${post.postId}`} className="sr-only">
            댓글 {post.comments.length}
          </h2>
          <CommentList comments={post.comments} skin={listSkinOf(post.sourceEngine)} />
        </section>
      )}

      {adjacent && (adjacent.prev ?? adjacent.next) ? (
        <div data-pagefind-ignore>
          <PostNavigation
            board={board.id as BoardId}
            boardKr={board.nameKr}
            prev={adjacent.prev}
            next={adjacent.next}
          />
        </div>
      ) : null}
    </article>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PostNavigation({
  board,
  boardKr,
  prev,
  next,
}: {
  board: BoardId;
  boardKr: string;
  prev: BoardIndexEntry | null;
  next: BoardIndexEntry | null;
}) {
  if (!prev && !next) return null;

  return (
    <nav aria-label="게시글 네비게이션" className="border-t border-(--era-input-border) px-6 py-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {/* 이전글 — older, higher array index */}
        <div className="flex min-w-0 flex-col gap-0.5">
          {prev ? (
            <Link
              href={`/${prev.board ?? board}/${prev.postId}`}
              className="group flex items-start gap-2 text-sm"
            >
              <span className="text-forg-muted mt-0.5 shrink-0 text-xs">← 이전글</span>
              <span className="line-clamp-1 min-w-0 text-(--era-link) group-hover:text-(--era-link-hover)">
                {prev.title}
              </span>
            </Link>
          ) : (
            <span className="text-forg-muted text-sm">처음 글입니다</span>
          )}
        </div>

        {/* 다음글 — newer, lower array index */}
        <div className="flex min-w-0 flex-col items-end gap-0.5">
          {next ? (
            <Link
              href={`/${next.board ?? board}/${next.postId}`}
              className="group flex items-start gap-2 text-sm"
            >
              <span className="line-clamp-1 min-w-0 text-right text-(--era-link) group-hover:text-(--era-link-hover)">
                {next.title}
              </span>
              <span className="text-forg-muted mt-0.5 shrink-0 text-xs">다음글 →</span>
            </Link>
          ) : (
            <span className="text-forg-muted text-sm">마지막 글입니다</span>
          )}
        </div>
      </div>

      <div className="mt-3 border-t border-(--era-input-border) pt-3">
        <Link
          href={`/${board}`}
          className="text-sm text-(--era-link) hover:text-(--era-link-hover)"
        >
          ← {boardKr} 게시판
        </Link>
      </div>
    </nav>
  );
}
