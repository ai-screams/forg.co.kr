/**
 * A board whose post pages Wayback never captured, shown from the rows of
 * its captured list pages (ADR-0017). Same table as `BoardListing`, minus
 * the link on rows the museum has no post for, plus the 조회 column: unlike
 * the post-derived index (99.2% null, ADR-0016 §5) these counts are what the
 * list printed.
 *
 * Era-invariant markup; visual delta comes from `--era-*` CSS vars.
 */

import { listingRows } from "@/components/board-rows";
import { ListTable } from "@/components/list-skin";
import { getBoardOrThrow, type BoardId } from "@/lib/boards";
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

  return (
    <article className="text-forg-ink">
      <h1 className="sr-only">{meta.nameKr}</h1>

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
    </article>
  );
}
