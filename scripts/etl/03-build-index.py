#!/usr/bin/env python3
"""ETL Stage 3 — Aggregate parsed Post JSON into paginated board indexes.

Reads `src/content/posts/{board}/*.json` (Stage 2 gold tier) and writes
paginated summary chunks to `src/content/boards/{board}/index-{N}.json`.
Each chunk contains up to BOARD_INDEX_PAGE_SIZE entries, sorted by
`createdAt` desc (newest first).

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
    Post,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
POSTS_DIR = PROJECT_ROOT / "src" / "content" / "posts"
INDEX_DIR = PROJECT_ROOT / "src" / "content" / "boards"
SUMMARY_FILE = PROJECT_ROOT / "scripts" / "etl" / ".index-summary.json"


def _load_post(path: Path) -> Post:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return Post.model_validate(raw)


def _entry_from_post(post: Post) -> BoardIndexEntry:
    return BoardIndexEntry(
        postId=post.postId,
        title=post.title,
        author=post.author,
        authorMemberNo=post.authorMemberNo,
        createdAt=post.createdAt,
        commentCount=len(post.comments),
        attachmentCount=len(post.attachments),
        hits=post.hits,
        recommend=post.recommend,
        era=post.era,
    )


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


def _build_board(
    board: str,
    post_files: list[Path],
    *,
    dry_run: bool,
    now: datetime,
) -> tuple[int, int, int, list[str]]:
    """Build all paginated index files for a single board.

    Returns (post_count, page_count, pruned_count, errors).
    """
    errors: list[str] = []
    posts: list[Post] = []
    for f in post_files:
        try:
            posts.append(_load_post(f))
        except (json.JSONDecodeError, ValidationError, OSError) as exc:
            errors.append(f"{f.relative_to(PROJECT_ROOT)}: {exc}")

    posts.sort(key=lambda p: p.createdAt, reverse=True)
    total = len(posts)
    if total == 0:
        return 0, 0, 0, errors

    total_pages = max(1, (total + BOARD_INDEX_PAGE_SIZE - 1) // BOARD_INDEX_PAGE_SIZE)
    board_dir = INDEX_DIR / board

    for page_num in range(1, total_pages + 1):
        start = (page_num - 1) * BOARD_INDEX_PAGE_SIZE
        chunk = posts[start : start + BOARD_INDEX_PAGE_SIZE]
        try:
            page = BoardIndexPage(
                board=board,
                page=page_num,
                totalPages=total_pages,
                totalPosts=total,
                generatedAt=now,
                entries=[_entry_from_post(p) for p in chunk],
            )
        except ValidationError as exc:
            errors.append(f"{board} page {page_num}: {exc}")
            continue

        if dry_run:
            continue

        out = board_dir / f"index-{page_num}.json"
        payload = page.model_dump_json(indent=2, exclude_none=False)
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
        posts, pages, pruned, errors = _build_board(
            board_dir.name,
            post_files,
            dry_run=args.dry_run,
            now=now,
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
