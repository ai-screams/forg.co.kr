/**
 * A board whose post pages Wayback never captured, shown from the rows of
 * its captured list pages (ADR-0017). Same table as `BoardListing`, minus
 * the link on rows the museum has no post for, plus the 조회 column: unlike
 * the post-derived index (99.2% null, ADR-0016 §5) these counts are what the
 * list printed.
 *
 * Era-invariant markup; visual delta comes from `--era-*` CSS vars.
 */

import { BoardHeader, BoardNote } from "@/components/board-header";
import { listingRows } from "@/components/board-rows";
import { ListTable } from "@/components/list-skin";
import { getBoardOrThrow, type BoardId } from "@/lib/boards";
import { formatWaybackTs } from "@/lib/dates";
import { boardSkin } from "@/lib/skins";
import { skin2001Of } from "@/lib/skins-2001";
import type { BoardListing } from "@/types/post";

interface BoardListingOnlyProps {
  board: BoardId;
  listing: BoardListing;
}

export function BoardListingOnly({ board, listing }: BoardListingOnlyProps) {
  const meta = getBoardOrThrow(board);
  const skin = boardSkin(meta);
  const captures = [...new Set(listing.entries.map((e) => e.capturedAt))].sort();
  const withPost = listing.entries.filter((e) => e.hasPost).length;

  return (
    <article className="text-forg-ink">
      <BoardHeader meta={meta}>
        <BoardNote>
          목록 {listing.pagesCaptured}쪽(캡처 {listing.capturesRead}번)에서{" "}
          {listing.entries.length.toLocaleString("ko-KR")}개 제목
          {listing.totalReported !== null
            ? ` (원본 표기 전체 ${listing.totalReported.toLocaleString("ko-KR")}개)`
            : ""}
          {withPost > 0 ? ` · 본문 보존 ${withPost.toLocaleString("ko-KR")}개` : ""}
        </BoardNote>
        <BoardNote>
          {withPost === 0
            ? "글 본문은 Wayback에 캡처되지 않았습니다. 목록 페이지에 남은 제목·이름·날짜·조회수만 보존합니다."
            : '"본문 없음" 표시가 붙은 글은 목록에 제목만 남았습니다.'}
        </BoardNote>
      </BoardHeader>

      <ListTable
        skin={skin}
        rows={listingRows(board, listing, skin)}
        withHits
        firstNumber={listing.entries.length}
        era2001={{
          skin: skin2001Of(board),
          totalPosts: listing.totalReported ?? listing.entries.length,
          page: 1,
          totalPages: listing.pagesCaptured,
        }}
      />

      <footer className="mt-2 text-[10.5px] text-forg-muted">
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
