/**
 * A board whose post pages Wayback never captured, shown from the rows of
 * its captured list pages (ADR-0017). Same table as `BoardListing`, minus
 * the link on rows the museum has no post for, plus the 조회 column: unlike
 * the post-derived index (99.2% null, ADR-0016 §5) these counts are what the
 * list printed.
 *
 * Era-invariant markup; visual delta comes from `--era-*` CSS vars.
 */

import Link from "@/components/link";

import { CommentCount, KRITZ_COLUMNS, ListHeadRow } from "@/components/list-skin";
import { getBoardOrThrow, type BoardId } from "@/lib/boards";
import { formatShortDate, formatWaybackTs } from "@/lib/dates";
import type { BoardListing } from "@/types/post";

interface BoardListingOnlyProps {
  board: BoardId;
  listing: BoardListing;
}

export function BoardListingOnly({ board, listing }: BoardListingOnlyProps) {
  const meta = getBoardOrThrow(board);
  // The status column stays empty — see `BoardListing` on `new_head.gif`.
  const zeroboard = meta.engine === "zeroboard";
  const captures = [...new Set(listing.entries.map((e) => e.capturedAt))].sort();
  const withPost = listing.entries.filter((e) => e.hasPost).length;

  return (
    <article className="text-forg-ink">
      <header className="pb-2">
        <h1 className="text-forg-ink text-[14px] font-bold">{meta.nameKr}</h1>
        {meta.description && (
          <p className="text-forg-muted mt-[2px] text-[11px]">{meta.description}</p>
        )}
        <p className="text-forg-muted mt-[2px] text-[11px]">
          목록 {listing.pagesCaptured}쪽에서 {listing.entries.length.toLocaleString("ko-KR")}개 제목
          {listing.totalReported !== null
            ? ` (원본 표기 전체 ${listing.totalReported.toLocaleString("ko-KR")}개)`
            : ""}
          {withPost > 0 ? ` · 본문 보존 ${withPost.toLocaleString("ko-KR")}개` : ""}
        </p>
        <p className="text-forg-muted mt-[2px] text-[11px]">
          {withPost === 0
            ? "글 본문은 Wayback에 캡처되지 않았습니다. 목록 페이지에 남은 제목·이름·날짜·조회수만 보존합니다."
            : "본문이 없는 글은 제목만 남았습니다 — 링크가 없는 줄이 그것입니다."}
        </p>
      </header>

      <div className="border border-(--era-input-border)/50 bg-white">
        <table className="w-full table-fixed border-collapse text-[12px]">
          <colgroup>
            <col className="w-[20px]" />
            <col className="hidden w-[100px] sm:table-column" />
            <col />
            <col className="w-[52px]" />
            <col className="w-[44px]" />
          </colgroup>
          <thead>
            <ListHeadRow
              zeroboard={zeroboard}
              columns={[
                KRITZ_COLUMNS.icon,
                KRITZ_COLUMNS.name,
                KRITZ_COLUMNS.title,
                KRITZ_COLUMNS.date,
                KRITZ_COLUMNS.hit,
              ]}
            />
            <tr>
              <th colSpan={5} className="h-px bg-(--era-input-border)/40 p-0">
                <span className="sr-only">구분선</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {listing.entries.map((entry) => {
              const title = (
                <>
                  {entry.categoryLabel ? (
                    <span className="text-forg-muted shrink-0 text-[10px]">
                      [{entry.categoryLabel}]
                    </span>
                  ) : null}
                  <span className="truncate">{entry.title}</span>
                  <CommentCount count={entry.commentCount} zeroboard={zeroboard} />
                </>
              );
              return (
                <tr
                  key={entry.no}
                  className="border-b border-(--era-input-border)/25 last:border-0"
                >
                  <td className="text-center align-middle" />
                  <td className="text-forg-muted hidden truncate px-1 text-center align-middle text-[11px] sm:table-cell">
                    {entry.author}
                  </td>
                  <td className="px-1 align-middle break-all">
                    {entry.hasPost ? (
                      <Link
                        href={`/${board}/${entry.no}`}
                        className="text-forg-ink inline-flex items-baseline gap-[4px] leading-[1.7] hover:underline"
                      >
                        {title}
                      </Link>
                    ) : (
                      <span
                        className="text-forg-ink inline-flex items-baseline gap-[4px] leading-[1.7]"
                        title="본문은 캡처되지 않았습니다"
                      >
                        {title}
                      </span>
                    )}
                  </td>
                  <td className="text-forg-muted text-center align-middle text-[11px] tabular-nums">
                    {entry.createdAt === null ? (
                      "—"
                    ) : entry.yearApprox ? (
                      <span title="목록에는 월/일만 있어 연도는 캡처 시점으로 추정">
                        ≈{formatShortDate(entry.createdAt)}
                      </span>
                    ) : (
                      formatShortDate(entry.createdAt)
                    )}
                  </td>
                  <td className="text-forg-muted text-center align-middle text-[11px] tabular-nums">
                    {entry.hits === null ? "—" : entry.hits.toLocaleString("ko-KR")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="text-forg-muted mt-2 text-[10.5px]">
        출처: Wayback Machine 목록 캡처{" "}
        {captures.map((ts, i) => (
          <span key={ts}>
            {i > 0 ? " · " : ""}
            {formatWaybackTs(ts)}
          </span>
        ))}
      </footer>
    </article>
  );
}
