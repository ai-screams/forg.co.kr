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
import { chromeUrl } from "@/lib/chrome";
import { formatShortDate } from "@/lib/dates";
import type { BoardIndexPage } from "@/types/post";

interface BoardListingProps {
  board: BoardId;
  page: BoardIndexPage;
}

export function BoardListing({ board, page }: BoardListingProps) {
  const meta = getBoardOrThrow(board);
  // The one board-list capture we have is 2007 `kritz_normal2`, a Zeroboard
  // skin. Its recovered artwork is used only for Zeroboard boards; Gnuboard
  // ones keep text headers until a capture of their own turns up (ADR-0016).
  const zeroboard = meta.engine === "zeroboard";

  return (
    <article className="text-forg-ink">
      <header className="pb-2">
        <h1 className="text-forg-ink text-[14px] font-bold">{meta.nameKr}</h1>
        {meta.description && (
          <p className="text-forg-muted mt-[2px] text-[11px]">{meta.description}</p>
        )}
        <p className="text-forg-muted mt-[2px] text-[11px]">
          전체 {page.totalPosts.toLocaleString("ko-KR")}개 · {page.page} / {page.totalPages} 페이지
        </p>
      </header>

      <PostTable board={board} entries={page.entries} zeroboard={zeroboard} />

      <Pagination board={board} currentPage={page.page} totalPages={page.totalPages} />
    </article>
  );
}

/** `<img src=t.gif height=N>` — the spacer the original used for row height. */
function RowSpacer({ height }: { height: number }) {
  const url = chromeUrl("zb_t.gif");
  if (!url) return <div style={{ height }} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element -- static export, 43 B spacer
  return <img src={url} alt="" width={1} height={height} className="block" />;
}

function PostTable({
  board,
  entries,
  zeroboard,
}: {
  board: BoardId;
  entries: BoardIndexPage["entries"];
  zeroboard: boolean;
}) {
  if (entries.length === 0) {
    return (
      <p className="text-forg-muted px-2 py-10 text-center text-[11px]">
        이 페이지에는 게시글이 없습니다.
      </p>
    );
  }

  // uoboard-2007: `border:1px solid #dfdfdf`, rows `bgcolor="#FEFDFD"`,
  // 1px `#F7F5F7` separators, columns 20 / 100 / flex / 30 / 30. The 조회
  // column is dropped: `hits` is null for 99.2% of the archive, and a
  // fabricated 0 would read as "nobody ever opened this" (ADR-0016 §5).
  const newIcon = zeroboard ? chromeUrl("zb_kritz_new_head.gif") : null;

  return (
    <div className="border border-(--era-input-border)/50 bg-white">
      <table className="w-full table-fixed border-collapse text-[12px]">
        <colgroup>
          <col className="w-[20px]" />
          <col className="hidden w-[100px] sm:table-column" />
          <col />
          <col className="w-[52px]" />
        </colgroup>
        <thead>
          <tr className="text-forg-muted bg-(--era-content-bg) text-[11px]">
            <th scope="col" className="py-[3px]">
              <span className="sr-only">상태</span>
            </th>
            <th scope="col" className="hidden py-[3px] font-normal sm:table-cell">
              이름
            </th>
            <th scope="col" className="py-[3px] font-normal">
              제목
            </th>
            <th scope="col" className="py-[3px] font-normal">
              날짜
            </th>
          </tr>
          <tr>
            <th colSpan={4} className="h-px bg-(--era-input-border)/40 p-0">
              <span className="sr-only">구분선</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.postId}
              className="border-b border-(--era-input-border)/25 last:border-0"
            >
              <td className="text-center align-middle">
                {newIcon && entry.commentCount > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element -- static export, recovered 13×13 chrome
                  <img
                    src={newIcon}
                    alt="댓글 있음"
                    width={13}
                    height={13}
                    className="mx-auto block"
                  />
                ) : (
                  <RowSpacer height={3} />
                )}
              </td>
              <td className="text-forg-muted hidden truncate px-1 text-center align-middle text-[11px] sm:table-cell">
                {entry.author}
              </td>
              <td className="px-1 align-middle break-all">
                <Link
                  href={`/${board}/${entry.postId}`}
                  className="text-forg-ink inline-flex items-baseline gap-[4px] leading-[1.7] hover:underline"
                >
                  {entry.categoryLabel ? (
                    <span className="text-forg-muted shrink-0 text-[10px]">
                      [{entry.categoryLabel}]
                    </span>
                  ) : null}
                  <span className="truncate">{entry.title}</span>
                  {entry.commentCount > 0 ? (
                    <span className="shrink-0 text-[10.5px] text-(--era-meta-fg) tabular-nums">
                      [{entry.commentCount}]
                    </span>
                  ) : null}
                  {entry.attachmentCount > 0 ? (
                    <span
                      aria-label={`첨부 ${entry.attachmentCount}개`}
                      className="text-forg-muted shrink-0 text-[10.5px] tabular-nums"
                    >
                      ⊕{entry.attachmentCount}
                    </span>
                  ) : null}
                </Link>
                <p className="text-forg-muted text-[10.5px] sm:hidden">{entry.author}</p>
              </td>
              <td className="text-forg-muted text-center align-middle text-[11px] tabular-nums">
                {entry.createdAtApprox ? (
                  <span title="작성일이 캡처에 없어 첫 댓글 시각으로 대신함">
                    ≤{formatShortDate(entry.createdAt)}
                  </span>
                ) : (
                  formatShortDate(entry.createdAt)
                )}
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
