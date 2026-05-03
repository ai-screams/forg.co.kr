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

import Link from "next/link";

import { getBoardOrThrow } from "@/lib/boards";
import type { Post } from "@/types/post";

interface PostViewProps {
  post: Post;
}

export function PostView({ post }: PostViewProps) {
  const board = getBoardOrThrow(post.board);
  const created = formatKoreanDateTime(post.createdAt);

  return (
    <article className="text-forg-ink rounded-md border border-(--era-input-border) bg-(--era-content-bg) shadow-sm">
      <header className="border-b border-(--era-input-border) px-6 py-5">
        <p className="text-forg-muted text-xs">
          <Link href={`/${board.id}`} className="text-(--era-link) hover:text-(--era-link-hover)">
            {board.nameKr}
          </Link>
        </p>
        <h1 className="text-forg-ink mt-2 text-2xl font-bold">{post.title}</h1>
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
                >
                  {post.author}
                </a>
              ) : (
                post.author
              )}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-bold">날짜</dt>
            <dd>
              <time dateTime={post.createdAt}>{created}</time>
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
          className="post-body text-forg-ink leading-relaxed"
          // nh3-sanitised at ETL Stage 2 (ADR-0008)
          dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
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
          className="border-t border-(--era-input-border) bg-(--era-page-bg) px-6 py-5"
        >
          <h2 id={`comments-${post.postId}`} className="text-forg-ink mb-3 text-sm font-bold">
            댓글 {post.comments.length}
          </h2>
          <ol className="space-y-3 text-sm">
            {post.comments.map((c, i) => (
              <li
                key={`${c.author}-${c.createdAt}-${i}`}
                className="rounded-md border border-(--era-input-border) bg-(--era-content-bg) px-3 py-2"
              >
                <div className="text-forg-muted mb-1 flex items-baseline gap-2 text-xs">
                  <span className="text-forg-ink font-bold">{c.author}</span>
                  <time dateTime={c.createdAt}>{formatKoreanDateTime(c.createdAt)}</time>
                </div>
                <div
                  className="text-forg-ink"
                  // nh3-sanitised at ETL Stage 2 (ADR-0008)
                  dangerouslySetInnerHTML={{ __html: c.bodyHtml }}
                />
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}

const KOREAN_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatKoreanDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return KOREAN_DATE_FORMATTER.format(d);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
