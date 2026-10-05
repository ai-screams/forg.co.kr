"""03 indexes a board known only from its captured list pages, like any other."""
import json
from datetime import datetime

from schemas import BoardListing, BoardListingEntry
from stages import load_stage

index = load_stage("03-build-index.py")


def _write_listing(root, board, engine, rows):
    listing = BoardListing(
        board=board, engine=engine, pagesCaptured=1, capturesRead=1,
        generatedAt=datetime(2026, 1, 1), entries=rows,
    )
    root.mkdir(exist_ok=True)
    (root / f"{board}.json").write_text(listing.model_dump_json(), encoding="utf-8")


def _row(no, **kw):
    base = dict(no=no, title=f"제목 {no}", author="kim", commentCount=0, capturedAt="20080101000000", listPage=1)
    return BoardListingEntry(**{**base, **kw})


# Fails if: the boards to index are only those with post pages.
def test_boards_with_list_pages_alone_are_indexed(tmp_path, monkeypatch):
    posts, listings = tmp_path / "posts", tmp_path / "listings"
    (posts / "Q_A").mkdir(parents=True)
    _write_listing(listings, "Q_A", "zeroboard", [_row("1")])
    _write_listing(listings, "DF", "gnuboard4", [_row("1")])
    monkeypatch.setattr(index, "POSTS_DIR", posts)
    monkeypatch.setattr(index, "LISTINGS_DIR", listings)
    assert index.board_names() == ["DF", "Q_A"]


# Fails if: a board without posts is skipped, or filed under the wrong era.
def test_a_list_only_board_gets_paged_rows_with_its_notices_first(tmp_path, monkeypatch):
    listings, out = tmp_path / "listings", tmp_path / "boards"
    _write_listing(listings, "DF", "gnuboard4", [
        _row("80", createdAt=datetime(2016, 2, 5).date(), hits=158),
        _row("2", createdAt=datetime(2007, 12, 27).date(), isNotice=True),
        _row("79", createdAt=datetime(2014, 12, 23).date()),
    ])
    monkeypatch.setattr(index, "LISTINGS_DIR", listings)
    monkeypatch.setattr(index, "INDEX_DIR", out)
    total, pages, _pruned, errors = index._build_board("DF", [], dry_run=False, now=datetime(2026, 1, 1))
    assert (total, pages, errors) == (3, 1, [])
    page = json.loads((out / "DF" / "index-1.json").read_text(encoding="utf-8"))
    assert page["totalWithPost"] == 0
    assert [(e["postId"], e["era"], e["hasPost"], e["hits"]) for e in page["entries"]] == [
        ("2", "2014", False, None),
        ("80", "2014", False, 158),
        ("79", "2014", False, None),
    ]


def test_a_board_with_neither_posts_nor_list_pages_gets_no_index(tmp_path, monkeypatch):
    monkeypatch.setattr(index, "LISTINGS_DIR", tmp_path / "listings")
    monkeypatch.setattr(index, "INDEX_DIR", tmp_path / "boards")
    assert index._build_board("Ooo", [], dry_run=False, now=datetime(2026, 1, 1)) == (0, 0, 0, [])
    assert not (tmp_path / "boards").exists()
