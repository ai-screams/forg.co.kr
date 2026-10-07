"""02c's linked rows: posts a capture names by title outside any list."""
import json
from datetime import date, datetime

from schemas import BoardListing, BoardListingEntry
from stages import load_stage

stage = load_stage("02c-parse-listing.py")
index = load_stage("03-build-index.py")

# A Gnuboard4 front page's latest box (2011–2016): title, then its comment
# count as a link of its own, then an icon.
FRONT = """<td>
<a href="./bbs/board.php?bo_table=UoBoard2&amp;wr_id=40529" style="cursor:hand"><font>오랜만에 글올립니다 미국에 있습니다</font></a>
<a href="./bbs/board.php?bo_table=UoBoard2&amp;wr_id=40529"><span>(11)</span></a>
<img src="./skin/latest/last_forg/img/icon_new.gif"/><br/>
<a href="./bbs/board.php?bo_table=UoBoard2&amp;wr_id=40526"><font>[Video] UO An Corp 플레이 // 서버 추천 …</font></a><br/>
<a href="./bbs/board.php?bo_table=UoBoard2&amp;wr_id=40520"><font>수정 좀 부\ufffd..</font></a><br/>
<a href="./bbs/board.php?bo_table=Trash&amp;wr_id=22920"><font>\ufffd떊\ufffd꽌 << 060 300 333…</font></a>
<a href="./bbs/board.php?bo_table=Trash&amp;wr_id=22920"><span>(2)</span></a><br/>
<a href="./bbs/board.php?bo_table=UoBoard2&amp;wr_id=40500"><font>http://forg.co.kr/bbs/board.php?bo_table=UoBoard2</font></a><br/>
<a href="./bbs/board.php?bo_table=events_date&amp;wr_id=97"><font>파티플레이 PM 8:00 대장간</font></a><br/>
<a href="http://forg.uospace.net/zb/zboard.php?id=ScreenShot&amp;no=1201"><img src="best_s_7.gif"/></a>
</td>"""


def _rows(html, **kw):
    return [(r["board"], r["no"], r["title"], r["author"], r["comments"]) for r in stage.linked_rows(html, **kw)]


# Fails if: the `(11)` link is not given to the post before it, or a count whose
# title was dropped (`(2)`) becomes a row;
# if a title cut through a character keeps its broken half, or a title that never
# decoded, an address, the event calendar or an image link becomes a row.
def test_a_latest_box_gives_titles_and_comment_counts():
    assert _rows(FRONT) == [
        ("UoBoard2", "40529", "오랜만에 글올립니다 미국에 있습니다", "anonymous", 11),
        ("UoBoard2", "40526", "[Video] UO An Corp 플레이 // 서버 추천 …", "anonymous", 0),
        ("UoBoard2", "40520", "수정 좀 부..", "anonymous", 0),
    ]


# A 2001 Zeroboard 4.0 view: a link in the post's text, then its Prev row.
VIEW = """<table><tr><td>본문 <a href="view.php?id=UoBoard&amp;no=2200">여기</a></td></tr></table>
<table><tr align="center" height="22">
<td bgcolor="#f2f2f2"><b>P</b>rev</td>
<td align="left"><img src="skin/board/old_head.gif"/>
<a href="view.php?id=UoBoard&amp;page=1&amp;no=2266" onfocus="blur()">오호 통제라. [3]</a></td>
<td nowrap=""><img src="images/t.gif"/><br/> 블튼 거지왕</td>
</tr></table>"""


# Fails if: a view's other links count, or the Prev row loses its author or `[3]`.
def test_a_view_gives_only_its_prev_next_rows_with_their_authors():
    assert _rows(VIEW, prev_next_only=True) == [("UoBoard", "2266", "오호 통제라.", "블튼 거지왕", 3)]


def _linked(no, title="제목", author="anonymous", comments=0, month_day=None):
    return {
        "no": no, "board": "UoBoard2", "title": title, "author": author,
        "comments": comments, "month_day": month_day, "notice": False,
    }


# Fails if: the bound ignores the capture's Korean date (UTC 16:00 is the next
# day in Korea), or a newer post the capture shows does not tighten it — its
# title cut by the box and with a category the museum keeps apart.
def test_a_row_precedes_its_capture_and_any_newer_post_beside_it():
    linked = [("20151019160000", [_linked("40543", "[질문] 하도 답답해서 혹시나 하고 여기에 묻습…"), _linked("40529")])]
    assert stage.date_linked(linked, {"40543"}, {})["40529"]["bound"] == date(2015, 10, 20)
    known = {40543: (date(2015, 9, 26), "하도 답답해서 혹시나 하고 여기에 묻습니다")}
    assert stage.date_linked(linked, {"40543"}, known)["40529"]["bound"] == date(2015, 9, 26)


# Fails if: a newer number bounds the row although the museum's post under that
# number is another one (UOForum numbered again: its 2002 post 557, the 2006
# front page's 557 a different title).
def test_a_newer_number_holding_another_post_does_not_bound():
    linked = [("20061127000000", [_linked("557", "10주년 기념 이벤트.."), _linked("553", "10주년 아이템의 특수효과")])]
    known = {557: (date(2002, 3, 31), "마법 상점 위치")}
    assert stage.date_linked(linked, {"557"}, known)["553"]["bound"] == date(2006, 11, 27)


# Fails if: a held number (a list row or a gold post) is added again; over two
# captures, if the later bound, the cut title, fewer comments or no author wins.
def test_rows_over_several_captures_keep_the_best_of_each():
    linked = [
        ("20020101000000", [_linked("100", "긴 제목이 잘..", comments=1), _linked("90")]),
        ("20010601000000", [_linked("100", "긴 제목이 잘린 글", "kim", 2)]),
    ]
    found = stage.date_linked(linked, {"90"}, {})
    assert list(found) == ["100"]
    r = found["100"]
    assert (r["bound"], r["capturedAt"], r["title"], r["comments"], r["author"]) == (
        date(2001, 6, 1), "20010601000000", "긴 제목이 잘린 글", 2, "kim",
    )


def _entry(no, **kw):
    base = dict(no=no, title=f"제목 {no}", author="kim", commentCount=0, capturedAt="20151020172534", listPage=1)
    return BoardListingEntry(**{**base, **kw})


# Fails if: the listing writes `datedByCapture: false` on every row (a diff on
# every listing) or drops it where it is set.
def test_the_flag_is_written_only_where_set():
    listing = BoardListing(
        board="UoBoard2", engine="gnuboard4", pagesCaptured=1, capturesRead=1,
        generatedAt=datetime(2026, 1, 1),
        entries=[_entry("40543", createdAt=date(2015, 9, 26)), _entry("40529", createdAt=date(2015, 9, 26), datedByCapture=True)],
    )
    rows = stage.dump_listing(listing)["entries"]
    assert ["datedByCapture" in r for r in rows] == [False, True]


# Fails if: 03 drops the flag from the index row, or writes it on every row.
def test_the_index_carries_the_flag_on_its_rows_only(tmp_path, monkeypatch):
    listings, out = tmp_path / "listings", tmp_path / "boards"
    listings.mkdir()
    listing = BoardListing(
        board="DF", engine="gnuboard4", pagesCaptured=1, capturesRead=1,
        generatedAt=datetime(2026, 1, 1),
        entries=[_entry("80", createdAt=date(2016, 2, 5)), _entry("79", createdAt=date(2016, 1, 1), datedByCapture=True)],
    )
    (listings / "DF.json").write_text(json.dumps(stage.dump_listing(listing)), encoding="utf-8")
    monkeypatch.setattr(index, "LISTINGS_DIR", listings)
    monkeypatch.setattr(index, "INDEX_DIR", out)
    index._build_board("DF", [], dry_run=False, now=datetime(2026, 1, 1))
    page = json.loads((out / "DF" / "index-1.json").read_text(encoding="utf-8"))
    assert [(e["postId"], e.get("datedByCapture")) for e in page["entries"]] == [("80", None), ("79", True)]


# A 2003 front-page frame: Events rows print MM/DD before the link and `[N]`
# after it; the column box prints the author before the link.
FRAME = """<font size="2"><img src="./images/a.gif"/> 02/05 <a href="/_zb/zboard.php?id=Events&amp;no=423"> [발해] 치킨 파이터......!!!!!(수..</a> <img src="images/new.gif"/><font style="font-size:11px;">[2]</font><br/>
<font size="2"><img src="./images/a.gif"/> 02/04 <a href="/_zb/zboard.php?id=Events&amp;no=422"> 공성전 후기</a><br/>
<font size="2"><img src="./images/a.gif"/> [Jazz] <a href="/_zb/zboard.php?id=column&amp;no=124"> 도박꾼 이야기 ..</a> <img src="images/new.gif"/><font style="font-size:11px;">[1]</font><br/>"""


# Fails if: a frame's MM/DD, `[author]` or `[N]` is not read, or the `[1]` of
# the next row (past the `<br/>`) is given to a row that printed none.
def test_a_frame_gives_dates_authors_and_counts():
    got = [(r["board"], r["no"], r["title"], r["author"], r["comments"], r["month_day"]) for r in stage.linked_rows(FRAME)]
    assert got == [
        ("Events", "423", "[발해] 치킨 파이터......!!!!!(수..", "anonymous", 2, (2, 5)),
        ("Events", "422", "공성전 후기", "anonymous", 0, (2, 4)),
        ("column", "124", "도박꾼 이야기 ..", "Jazz", 1, None),
    ]


# Fails if: a view's own post does not bound its Prev (Q_A 2516 under 2517,
# dated 2001-03-29, would wait for the 2001-05-22 capture), or becomes a row.
def test_a_views_own_post_bounds_its_neighbour():
    own = {"no": "2517", "board": "UoBoard2", "title": None, "context": True}
    linked = [("20010522000000", [_linked("2516"), own])]
    found = stage.date_linked(linked, set(), {2517: (date(2001, 3, 29), "올드비님들 도와주셈!!!")})
    assert list(found) == ["2516"]
    assert found["2516"]["bound"] == date(2001, 3, 29)


# Fails if: a capture whose title for the number is another post's is merged in
# (its earlier day would date Events 26 back years).
def test_a_number_shown_with_another_title_is_not_merged():
    linked = [
        ("20061127000000", [_linked("26", "Decisions Over Dinner")]),
        ("20011102000000", [_linked("26", "전혀 다른 글", "kim", 5)]),
    ]
    r = stage.date_linked(linked, set(), {})["26"]
    assert (r["title"], r["bound"], r["comments"], r["author"]) == ("Decisions Over Dinner", date(2006, 11, 27), 0, "anonymous")


# Fails if: the MM/DD a capture printed is lost when another capture of the same
# post printed none, or a later capture's MM/DD replaces an earlier one's.
def test_the_earliest_printed_month_day_is_kept():
    linked = [
        ("20030101000000", [_linked("423", "치킨 파이터..")]),
        ("20030301000000", [{**_linked("423", "치킨 파이터..", month_day=(2, 5)), "page_year": 2003}]),
        ("20030207000000", [{**_linked("423", "치킨 파이터..", month_day=(2, 5)), "page_year": 2003}]),
    ]
    r = stage.date_linked(linked, set(), {})["423"]
    assert (r["month_day"], r["page_year"], r["dated_at"]) == ((2, 5), 2003, "20030207000000")


# Fails if: a list row whose year was worked out from MM/DD (UOForum 3023's
# neighbours, put in 2002) is trusted as a bound; or gold / printed full dates are not.
def test_only_gold_and_printed_full_dates_bound():
    merged = {
        "3024": {"no": "3024", "title": "UOSE 잡팁", "full_date": None},
        "2500": {"no": "2500", "title": "그누보드 글", "full_date": date(2004, 10, 1)},
    }
    known = stage.known_dates({100: date(2002, 1, 1)}, {100: "골드 글"}, merged)
    assert known == {100: (date(2002, 1, 1), "골드 글"), 2500: (date(2004, 10, 1), "그누보드 글")}


def _found(**kw):
    base = {"title": "제목", "author": "anonymous", "comments": 0, "month_day": None, "bound": date(2003, 2, 7), "capturedAt": "20030207152109"}
    return {**base, **kw}


# Fails if: a row with a printed MM/DD is still dated by its capture, loses
# `yearApprox` or its capture; or one whose MM/DD would land after its bound
# keeps it; or a row without one is not flagged `datedByCapture`.
def test_a_linked_entry_takes_a_printed_month_day_before_the_bound():
    md = _found(month_day=(2, 5), page_year=2003, dated_at="20030206000000")
    e = stage.linked_entry("423", md)
    assert (e.createdAt, e.yearApprox, e.datedByCapture, e.capturedAt) == (date(2003, 2, 5), True, False, "20030206000000")
    late = _found(month_day=(2, 5), page_year=2003, dated_at="20030206000000", bound=date(2003, 2, 1))
    e = stage.linked_entry("423", late)
    assert (e.createdAt, e.yearApprox, e.datedByCapture) == (date(2003, 2, 1), False, True)
    e = stage.linked_entry("424", _found())
    assert (e.createdAt, e.datedByCapture, e.capturedAt) == (date(2003, 2, 7), True, "20030207152109")


# Fails if: the `[7]` after the next row's link is given to a row that printed
# none (the search runs past the next link).
def test_a_count_after_the_next_link_is_that_rows():
    html = """<p>01/02 <a href="/_zb/zboard.php?id=Notice&amp;no=5">가</a> 01/01 <a href="/_zb/zboard.php?id=Notice&amp;no=4">나</a><font>[7]</font></p>"""
    assert [(r["no"], r["comments"], r["month_day"]) for r in stage.linked_rows(html)] == [("5", 0, (1, 2)), ("4", 7, (1, 1))]


# Fails if: a frame's MM/DD rows get no page year, or a view's own post is not
# added to its board's rows as context.
def test_collect_gives_page_years_and_a_views_own_post(tmp_path):
    front = tmp_path / "forg_main.html~20030207152109.html"
    front.write_text(FRAME, encoding="utf-8")
    view = tmp_path / "UoBoard" / "2265.html"
    view.parent.mkdir()
    view.write_text(VIEW, encoding="utf-8")
    got = stage.collect_linked([(front, "20030207152109", False), (view, "20010601000000", True)])
    assert [(r["no"], r["page_year"]) for _ts, rows in got["Events"] for r in rows] == [("423", 2003), ("422", 2003)]
    assert [(r["no"], r.get("context", False)) for _ts, rows in got["UoBoard"] for r in rows] == [("2266", False), ("2265", True)]
