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

import {
  CommentCount,
  listSkinOf,
  ListTable,
  NoBodyMark,
  RowMarks,
  type ListRow,
} from "@/components/list-skin";
import { getBoardOrThrow, type BoardId } from "@/lib/boards";
import { formatShortDate, formatWaybackTs } from "@/lib/dates";
import type { BoardListing } from "@/types/post";

interface BoardListingOnlyProps {
  board: BoardId;
  listing: BoardListing;
}

export function BoardListingOnly({ board, listing }: BoardListingOnlyProps) {
  const meta = getBoardOrThrow(board);
  const skin = listSkinOf(meta.engine);
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
            : '"본문 없음" 표시가 붙은 글은 목록에 제목만 남았습니다.'}
        </p>
      </header>

      <ListTable
        skin={skin}
        rows={listing.entries.map((entry): ListRow => {
          const title = (
            <>
              {entry.categoryLabel ? (
                <span className="text-forg-muted shrink-0 text-[10px]">
                  [{entry.categoryLabel}]
                </span>
              ) : null}
              <span className="truncate">{entry.title}</span>
              <CommentCount count={entry.commentCount} skin={skin} />
              <RowMarks skin={skin} board={board} attachmentCount={0} hits={entry.hits} />
            </>
          );
          const layout = "text-forg-ink inline-flex items-baseline gap-[4px] leading-[1.7]";
          return {
            key: entry.no,
            author: entry.author,
            title: entry.hasPost ? (
              <Link href={`/${board}/${entry.no}`} className={`${layout} hover:underline`}>
                {title}
              </Link>
            ) : (
              <span className={layout} title="본문은 캡처되지 않았습니다">
                {title}
                {/* Every row lacks a body when none was captured; the header says so. */}
                {withPost > 0 && <NoBodyMark />}
              </span>
            ),
            date:
              entry.createdAt === null ? (
                "—"
              ) : entry.yearApprox ? (
                <span title="목록에는 월/일만 있어 연도는 캡처 시점으로 추정">
                  ≈{formatShortDate(entry.createdAt)}
                </span>
              ) : (
                formatShortDate(entry.createdAt)
              ),
            hits: entry.hits === null ? "—" : entry.hits.toLocaleString("ko-KR"),
          };
        })}
        withHits
        firstNumber={listing.entries.length}
      />

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
