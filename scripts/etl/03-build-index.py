#!/usr/bin/env python3
"""ETL Stage 3 — Aggregate parsed Post JSON into paginated board indexes.

Reads `src/content/posts/{board}/*.json` (Stage 2 gold tier) and writes
paginated summary chunks to `src/content/boards/{board}/index-{N}.json`.
Each chunk contains up to BOARD_INDEX_PAGE_SIZE entries, sorted by
`createdAt` desc (newest first).

Rows from the board's captured list pages (`src/content/listings/{board}.json`,
Stage 2c, ADR-0017 §4) are merged in: a row with no post becomes an
entry with `hasPost: false` — a title the museum can show but not open —
and a row for a post we hold fills `hits` when the post page had none.

The index entries are deliberately lightweight — no `bodyHtml` /
`bodyText` — so the listing page bundle stays tiny even when a board
has 1k+ posts.

USAGE:
    python3 scripts/etl/03-build-index.py [options]

OPTIONS:
    --board BOARD      restrict to one board id
    --dry-run          validate and report; do not write to disk
    --print-every N    progress cadence (default 5 boards)
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parent))
from schemas import (  # noqa: E402
    BOARD_INDEX_PAGE_SIZE,
    BoardIndexEntry,
    BoardIndexPage,
    BoardListing,
    Post,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
POSTS_DIR = PROJECT_ROOT / "src" / "content" / "posts"
LISTINGS_DIR = PROJECT_ROOT / "src" / "content" / "listings"
INDEX_DIR = PROJECT_ROOT / "src" / "content" / "boards"
UNKNOWN_DATE = datetime(1970, 1, 1)  # the "작성일 미상" sentinel the UI knows
# A board that took over from older ones lists their rows after its own. The
# rows keep their own board, so they link to its posts.
#   UoBoard2 (Gnuboard free board, 2008–2016, 23 captured posts) followed
#     UoBoard (Zeroboard free board, 2000–2007): same name and first menu
#     button, the older board's last post before the newer one's first.
#   Shop (Gnuboard trade board, from 2006-11) followed the Zeroboard trade
#     boards: Sell (2001-03–2002-10, "장터란"), then the per-shard Tarirang
#     (–2003-10) and Tbalhae (–2006-10). Vendor, the ads for players' own
#     in-game shops, is another kind of board and stays apart.
CONTINUES: dict[str, tuple[str, ...]] = {
    "UoBoard2": ("UoBoard",),
    "Shop": ("Tbalhae", "Tarirang", "Sell"),
}
SUMMARY_FILE = PROJECT_ROOT / "scripts" / "etl" / ".index-summary.json"


def _load_post(path: Path) -> Post:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return Post.model_validate(raw)


def _entry_from_post(post: Post) -> BoardIndexEntry:
    return BoardIndexEntry(
        postId=post.postId,
        title=post.title,
        categoryLabel=post.categoryLabel,
        author=post.author,
        authorMemberNo=post.authorMemberNo,
        createdAt=post.createdAt,
        createdAtApprox=post.createdAtApprox,
        commentCount=len(post.comments),
        attachmentCount=len(post.attachments),
        hits=post.hits,
        recommend=post.recommend,
        era=post.era,
    )


def _load_listing(board: str) -> BoardListing | None:
    path = LISTINGS_DIR / f"{board}.json"
    if not path.exists():
        return None
    return BoardListing.model_validate(json.loads(path.read_text(encoding="utf-8")))


def _merge_listing(
    board: str, entries: list[BoardIndexEntry], era: str
) -> tuple[list[BoardIndexEntry], int, int]:
    """Add list-page rows the posts do not cover; fill missing hits.

    Returns `(entries, rows_added, hits_filled)`.
    """
    listing = _load_listing(board)
    if listing is None:
        return entries, 0, 0
    by_id = {e.postId: e for e in entries}
    added = filled = 0
    for row in listing.entries:
        have = by_id.get(row.no)
        if have is not None:
            if have.hits is None and row.hits is not None:
                have.hits = row.hits
                filled += 1
            continue
        created = (
            datetime(row.createdAt.year, row.createdAt.month, row.createdAt.day)
            if row.createdAt is not None
            else UNKNOWN_DATE
        )
        entries.append(
            BoardIndexEntry(
                postId=row.no,
                title=row.title,
                categoryLabel=row.categoryLabel,
                author=row.author,
                authorMemberNo=row.authorMemberNo,
                createdAt=created,
                yearApprox=row.yearApprox,
                commentCount=row.commentCount,
                attachmentCount=0,
                hits=row.hits,
                recommend=None,
                era=era,  # type: ignore[arg-type]
                hasPost=False,
            )
        )
        added += 1
    return entries, added, filled


def _same_but_stamp(previous: str, current: str) -> bool:
    """True when the two chunk payloads differ only in `generatedAt`."""
    try:
        a, b = json.loads(previous), json.loads(current)
    except json.JSONDecodeError:
        return False
    a.pop("generatedAt", None)
    b.pop("generatedAt", None)
    return a == b


def _atomic_write(path: Path, payload: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(payload, encoding="utf-8")
    tmp.replace(path)


def _prune_stale_pages(board_dir: Path, valid_pages: int) -> int:
    """Delete `index-N.json` files whose N exceeds the new page count."""
    if not board_dir.exists():
        return 0
    removed = 0
    for f in board_dir.glob("index-*.json"):
        try:
            n = int(f.stem.split("-", 1)[1])
        except (ValueError, IndexError):
            continue
        if n < 1 or n > valid_pages:
            f.unlink()
            removed += 1
    return removed


def _board_entries(board: str, post_files: list[Path], errors: list[str]) -> list[BoardIndexEntry]:
    """A board's own rows: its posts plus its list-only rows."""
    posts: list[Post] = []
    for f in post_files:
        try:
            posts.append(_load_post(f))
        except (json.JSONDecodeError, ValidationError, OSError) as exc:
            errors.append(f"{f.relative_to(PROJECT_ROOT)}: {exc}")
    if not posts:
        return []
    entries = [_entry_from_post(p) for p in posts]
    entries, _added, _filled = _merge_listing(board, entries, posts[0].era)
    return entries


def _dump_page(page: BoardIndexPage) -> str:
    """The chunk JSON, with `board` written only on rows that carry one, so
    boards without a predecessor keep their files byte for byte."""
    data = page.model_dump(mode="json")
    for e in data["entries"]:
        if e.get("board") is None:
            e.pop("board", None)
    return json.dumps(data, ensure_ascii=False, indent=2)


def _build_board(
    board: str,
    post_files: list[Path],
    *,
    dry_run: bool,
    now: datetime,
    carried: list[BoardIndexEntry] | None = None,
) -> tuple[int, int, int, list[str]]:
    """Build all paginated index files for a single board.

    `carried` are the rows of the board it continues (CONTINUES).
    Returns (post_count, page_count, pruned_count, errors).
    """
    errors: list[str] = []
    posts: list[Post] = []
    for f in post_files:
        try:
            posts.append(_load_post(f))
        except (json.JSONDecodeError, ValidationError, OSError) as exc:
            errors.append(f"{f.relative_to(PROJECT_ROOT)}: {exc}")

    if not posts:
        return 0, 0, 0, errors

    entries = [_entry_from_post(p) for p in posts]
    entries, added, filled = _merge_listing(board, entries, posts[0].era)
    if added or filled:
        print(f"  {board}: +{added} list-only rows, {filled} hits filled", file=sys.stderr)
    if carried:
        entries += carried
        print(f"  {board}: +{len(carried)} rows carried from {', '.join(CONTINUES[board])}",
              file=sys.stderr)
    # Newest first; a title-only row with no date carries the 1970 sentinel
    # and sinks to the end like an undated post does.
    entries.sort(key=lambda e: (e.createdAt, int(e.postId) if e.postId.isdigit() else 0), reverse=True)
    total = len(entries)
    with_post = sum(e.hasPost for e in entries)

    total_pages = max(1, (total + BOARD_INDEX_PAGE_SIZE - 1) // BOARD_INDEX_PAGE_SIZE)
    board_dir = INDEX_DIR / board

    for page_num in range(1, total_pages + 1):
        start = (page_num - 1) * BOARD_INDEX_PAGE_SIZE
        chunk = entries[start : start + BOARD_INDEX_PAGE_SIZE]
        try:
            page = BoardIndexPage(
                board=board,
                page=page_num,
                totalPages=total_pages,
                totalPosts=total,
                totalWithPost=with_post,
                generatedAt=now,
                entries=chunk,
            )
        except ValidationError as exc:
            errors.append(f"{board} page {page_num}: {exc}")
            continue

        if dry_run:
            continue

        out = board_dir / f"index-{page_num}.json"
        payload = _dump_page(page)
        if out.exists() and _same_but_stamp(out.read_text(encoding="utf-8"), payload):
            continue  # nothing but generatedAt would change; keep git quiet
        _atomic_write(out, payload + "\n")

    pruned = 0 if dry_run else _prune_stale_pages(board_dir, total_pages)
    return total, total_pages, pruned, errors


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build paginated board index JSON from parsed posts.",
    )
    parser.add_argument("--board", help="Restrict to one board id")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--print-every", type=int, default=5)
    args = parser.parse_args()

    if not POSTS_DIR.exists():
        print(f"error: {POSTS_DIR} does not exist", file=sys.stderr)
        return 1

    boards = sorted(d for d in POSTS_DIR.iterdir() if d.is_dir())
    if args.board:
        boards = [b for b in boards if b.name == args.board]
        if not boards:
            print(f"error: board '{args.board}' not found", file=sys.stderr)
            return 1

    now = datetime.now(timezone.utc).replace(microsecond=0)
    started = time.monotonic()
    total_posts = 0
    total_pages = 0
    total_pruned = 0
    all_errors: list[str] = []
    per_board: dict[str, dict[str, int]] = {}

    for i, board_dir in enumerate(boards, 1):
        post_files = sorted(board_dir.glob("*.json"))
        carried = None
        if board_dir.name in CONTINUES:
            carried = [
                e.model_copy(update={"board": older})
                for older in CONTINUES[board_dir.name]
                for e in _board_entries(older, sorted((POSTS_DIR / older).glob("*.json")), all_errors)
            ]
        posts, pages, pruned, errors = _build_board(
            board_dir.name,
            post_files,
            dry_run=args.dry_run,
            now=now,
            carried=carried,
        )
        total_posts += posts
        total_pages += pages
        total_pruned += pruned
        all_errors.extend(errors)
        per_board[board_dir.name] = {
            "posts": posts,
            "pages": pages,
            "pruned": pruned,
            "errors": len(errors),
        }
        if i % args.print_every == 0 or i == len(boards):
            print(
                f"  [{i}/{len(boards)}] {board_dir.name}: "
                f"{posts} posts → {pages} pages"
                + (f" ({pruned} pruned)" if pruned else "")
                + (f" [{len(errors)} errors]" if errors else "")
            )

    elapsed = time.monotonic() - started
    print()
    print(f"Done in {elapsed:.1f}s")
    print(f"  boards : {len(boards)}")
    print(f"  posts  : {total_posts}")
    print(f"  pages  : {total_pages}")
    if total_pruned:
        print(f"  pruned : {total_pruned} stale page file(s)")
    if all_errors:
        print(f"  errors : {len(all_errors)}", file=sys.stderr)
        for err in all_errors[:20]:
            print(f"    {err}", file=sys.stderr)
        if len(all_errors) > 20:
            print(f"    … and {len(all_errors) - 20} more", file=sys.stderr)

    if not args.dry_run:
        summary = {
            "generatedAt": now.isoformat(),
            "elapsedS": round(elapsed, 2),
            "boards": per_board,
            "totals": {
                "posts": total_posts,
                "pages": total_pages,
                "pruned": total_pruned,
                "errors": len(all_errors),
            },
        }
        SUMMARY_FILE.write_text(
            json.dumps(summary, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

    return 1 if all_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
