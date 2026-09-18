/**
 * Renders one paginated chunk of a board index as a semantic table.
 *
 * Used by both `/[board]` (page 1) and `/[board]/page/[N]` (page 2+).
 * Era-invariant markup; visual delta comes from `--era-*` CSS vars.
 *
 * Pagination URLs:
 *   page 1 → `/{board}/`        (canonical)
 *   page N → `/{board}/page/N/` (literal `page` segment to keep
 *                                 `/{board}/{postId}` route disambiguated)
 */

import Link from "@/components/link";

import { getBoardOrThrow, type BoardId } from "@/lib/boards";
import { formatShortDate } from "@/lib/dates";
import type { BoardIndexPage } from "@/types/post";

interface BoardListingProps {
  board: BoardId;
  page: BoardIndexPage;
}

export function BoardListing({ board, page }: BoardListingProps) {
  const meta = getBoardOrThrow(board);
  return (
    <article className="text-forg-ink rounded-md border border-(--era-input-border) bg-(--era-content-bg) shadow-sm">
      <header className="border-b border-(--era-input-border) px-6 py-5">
        <p className="text-forg-muted font-mono text-[10px] tracking-wider uppercase">
          {meta.id} · {meta.engine} · {meta.era}
        </p>
        <h1 className="text-forg-ink mt-1 text-2xl font-bold tracking-tight">{meta.nameKr}</h1>
        {meta.description && <p className="text-forg-muted mt-2 text-sm">{meta.description}</p>}
        <p className="text-forg-muted mt-3 text-xs">
          전체 <strong className="text-forg-ink">{page.totalPosts.toLocaleString("ko-KR")}</strong>{" "}
          개 게시글 ·{" "}
          <strong className="text-forg-ink">
            {page.page} / {page.totalPages}
          </strong>{" "}
          페이지
        </p>
      </header>

      <PostTable board={board} entries={page.entries} />

      <Pagination board={board} currentPage={page.page} totalPages={page.totalPages} />
    </article>
  );
}

function PostTable({ board, entries }: { board: BoardId; entries: BoardIndexPage["entries"] }) {
  if (entries.length === 0) {
    return (
      <p className="text-forg-muted px-6 py-10 text-center text-sm">
        이 페이지에는 게시글이 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="text-forg-muted border-b border-(--era-input-border) text-xs">
          <tr>
            <th scope="col" className="px-6 py-2 text-left font-bold">
              제목
            </th>
            <th
              scope="col"
              className="hidden px-3 py-2 text-left font-bold whitespace-nowrap sm:table-cell"
            >
              작성자
            </th>
            <th scope="col" className="px-6 py-2 text-right font-bold whitespace-nowrap">
              날짜
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.postId}
              className="border-b border-(--era-input-border)/60 last:border-b-0"
            >
              <td className="px-6 py-2.5">
                <Link
                  href={`/${board}/${entry.postId}`}
                  className="text-forg-ink inline-flex items-baseline gap-2 leading-snug hover:text-(--era-link-hover)"
                >
                  {entry.categoryLabel ? (
                    <span className="bg-forg-gold/15 text-forg-ink border-forg-gold/30 shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase">
                      {entry.categoryLabel}
                    </span>
                  ) : null}
                  <span className="line-clamp-1">{entry.title}</span>
                  {entry.commentCount > 0 ? (
                    <span className="text-forg-muted font-mono text-[11px] tabular-nums">
                      [{entry.commentCount}]
                    </span>
                  ) : null}
                  {entry.attachmentCount > 0 ? (
                    <span
                      aria-label={`첨부 ${entry.attachmentCount}개`}
                      className="text-forg-muted font-mono text-[11px] tabular-nums"
                    >
                      ⊕{entry.attachmentCount}
                    </span>
                  ) : null}
                </Link>
                <p className="text-forg-muted mt-0.5 text-xs sm:hidden">
                  {entry.author} · {formatShortDate(entry.createdAt)}
                </p>
              </td>
              <td className="text-forg-muted hidden px-3 py-2.5 text-xs whitespace-nowrap sm:table-cell">
                {entry.author}
              </td>
              <td className="text-forg-muted px-6 py-2.5 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                {formatShortDate(entry.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({
  board,
  currentPage,
  totalPages,
}: {
  board: BoardId;
  currentPage: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const prevHref = pageHref(board, currentPage - 1);
  const nextHref = pageHref(board, currentPage + 1);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      aria-label="페이지 네비게이션"
      className="flex items-center justify-between gap-3 border-t border-(--era-input-border) px-6 py-4 text-xs"
    >
      <PageLink href={prevHref} disabled={!hasPrev} label="← 이전" />
      <span className="text-forg-muted font-mono tabular-nums">
        {currentPage} / {totalPages}
      </span>
      <PageLink href={nextHref} disabled={!hasNext} label="다음 →" />
    </nav>
  );
}

function PageLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  if (disabled) {
    return (
      <span aria-disabled className="text-forg-muted/50 select-none">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="font-bold text-(--era-link) underline-offset-2 hover:text-(--era-link-hover) hover:underline"
    >
      {label}
    </Link>
  );
}

function pageHref(board: BoardId, page: number): string {
  if (page <= 1) return `/${board}`;
  return `/${board}/page/${page}`;
}
