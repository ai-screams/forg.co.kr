"""02c's year for a list row that printed only MM/DD (`pin_year`)."""
from datetime import date

from stages import load_stage

pin_year = load_stage("02c-parse-listing.py").pin_year

GOLD = {100: date(2003, 4, 1), 200: date(2003, 9, 1), 300: date(2005, 1, 1)}
NOS = sorted(GOLD)
CAPTURED = date(2006, 1, 1)
HEADS = {100: ("첫 글", "lee"), 200: ("둘째 글", "lee"), 300: ("셋째 글", "lee")}
# A row whose number the museum holds no post of.
NEW = {"title": "새 글", "author": "kim", "gold_heads": HEADS}


def test_a_post_the_museum_holds_keeps_its_own_date():
    assert pin_year(200, 5, 5, 2004, CAPTURED, GOLD, NOS, title="둘째 글", author="kim", gold_heads=HEADS) == (date(2003, 9, 1), False)


def test_neighbours_that_agree_give_the_year():
    assert pin_year(150, 6, 1, 2004, CAPTURED, GOLD, NOS, **NEW) == (date(2003, 6, 1), False)


def test_neighbours_that_disagree_bound_the_page_year():
    # 200 is 2003, 300 is 2005: the page's 2009 is bounded to 2005.
    assert pin_year(250, 6, 1, 2009, CAPTURED, GOLD, NOS, **NEW) == (date(2005, 6, 1), True)


def test_a_row_never_postdates_its_capture():
    captured = date(2003, 5, 1)
    assert pin_year(150, 6, 1, 2002, captured, GOLD, NOS, **NEW) == (date(2002, 6, 1), True)


def test_an_impossible_day_gives_no_date():
    assert pin_year(250, 2, 29, 2003, CAPTURED, GOLD, NOS, **NEW) == (None, True)


# A row above the last gold post has one neighbour, below it.
# Fails if: a neighbour year that puts the row before its lower neighbour is
# kept (Newbie 2281 as 2003-02-05 below 638 of 2003-10-26), or one that fits
# is not.
def test_a_neighbour_year_the_numbering_rules_out_gives_way_to_the_page():
    # Fits: 2005-12-20 is after post 300's 2005-01-01.
    assert pin_year(350, 12, 20, 2004, CAPTURED, GOLD, NOS, **NEW) == (date(2005, 12, 20), False)
    # Ruled out: 2005-02-05 would be before the neighbour's 2005-10-26.
    assert pin_year(400, 2, 5, 2006, date(2006, 3, 1), {300: date(2005, 10, 26)}, [300], **NEW) == (
        date(2006, 2, 5),
        True,
    )


# Fails if: a row between two agreeing neighbours is moved off their year
# when it fits between them, or still marked exact when it falls outside
# them. No year can put 12/01 between 2003-04-01 and 2003-09-01, so the date
# stays and only the mark says it is a guess.
def test_agreeing_neighbours_hold_only_where_the_row_fits_between_them():
    assert pin_year(150, 6, 1, 2004, CAPTURED, GOLD, NOS, **NEW) == (date(2003, 6, 1), False)
    assert pin_year(150, 12, 1, 2004, CAPTURED, GOLD, NOS, **NEW) == (date(2003, 12, 1), True)


# Fails if: a neighbour year that has no such day (Feb 29) raises.
def test_a_neighbour_year_without_the_day_gives_no_date():
    assert pin_year(150, 2, 29, 2004, CAPTURED, GOLD, NOS, **NEW) == (None, False)


def test_a_row_whose_number_holds_another_post_takes_the_pages_year():
    # What fails this: the gold post dating a row it is not (FunBoard 239 on
    # a 2007 list printed 07/26; the museum's 239 is another, 2001 post), the
    # gold neighbours dating a row whose number holds another post (dated or
    # not), the titles compared the wrong way round (a list cuts the row's
    # title short), or a page year without the day raising.
    other = {"title": "다른 글", "author": "kim", "gold_heads": HEADS}
    assert pin_year(200, 7, 26, 2004, CAPTURED, GOLD, NOS, **other) == (date(2004, 7, 26), True)
    undated = {"title": "다른 글", "author": "kim", "gold_heads": {**HEADS, 150: ("날짜 모르는 글", "lee")}}
    assert pin_year(150, 6, 1, 2004, CAPTURED, GOLD, NOS, **undated) == (date(2004, 6, 1), True)
    assert pin_year(200, 5, 5, 2004, CAPTURED, GOLD, NOS, title="둘째..", author="kim", gold_heads=HEADS) == (date(2003, 9, 1), False)
    assert pin_year(200, 2, 29, 2003, CAPTURED, GOLD, NOS, **other) == (None, True)


# Three rows of a kritz list of FunBoard, made up after its renumbering: 239
# is another post than the museum's 2001 239; 57 is the museum's 57, its
# category in the link text and too short a title for one to hold the
# other; 56 the museum's 56, its title edited since.
KRITZ_2002 = """<table>
<tr><td width="20"><img src="skin/kritz_normal/old_head.gif"></td>
<td><a href="view_info.php?id=FunBoard&member_no=0">엔젤</a></td>
<td><a href="zboard.php?id=FunBoard&no=239">2002년의 다른 글</a></td><td>07/26</td><td>40</td></tr>
<tr><td width="20"><img src="skin/kritz_normal/old_head.gif"></td>
<td><a href="view_info.php?id=FunBoard&member_no=0">Dark_Templer</a></td>
<td><a href="zboard.php?id=FunBoard&no=57">[펌] 웃긴 짤</a></td><td>06/04</td><td>90</td></tr>
<tr><td width="20"><img src="skin/kritz_normal/old_head.gif"></td>
<td><a href="view_info.php?id=FunBoard&member_no=0">Dark_Templer</a></td>
<td><a href="zboard.php?id=FunBoard&no=56">고친 제목</a></td><td>06/03</td><td>90</td></tr>
</table>"""


def test_a_list_page_takes_the_museums_post_date_only_for_a_row_that_is_that_post(tmp_path, monkeypatch):
    # What fails this: `build_listing` handing `pin_year` no gold posts' titles,
    # the row's title with its category still on, or no author (56's title
    # was edited; its author and printed day are the post's).
    listing = load_stage("02c-parse-listing.py")
    board = tmp_path / "posts" / "FunBoard"
    board.mkdir(parents=True)
    for no, title, author, created in (("239", "우리학교 시험문제(저의 예기-ㅅ-)", "kim", "2001-10-16T23:55:04"),
                                       ("57", "웃긴 짤", "kim", "2001-06-04T08:49:34"),
                                       ("56", "처음 제목", "Dark_Templer", "2001-06-03T21:00:00")):
        (board / f"{no}.json").write_text(
            f'{{"postId": "{no}", "title": "{title}", "author": "{author}", "createdAt": "{created}"}}', encoding="utf-8")
    page = tmp_path / "page-1.html"
    page.write_text(KRITZ_2002, encoding="utf-8")
    monkeypatch.setattr(listing, "POSTS_DIR", tmp_path / "posts")
    key = ("FunBoard", "page-1")
    built = listing.build_listing("FunBoard", [page], {key: "20020801000000"}, {key: "zeroboard"})
    assert {e.no: (e.createdAt, e.yearApprox) for e in built.entries} == {
        "239": (date(2002, 7, 26), True),
        "57": (date(2001, 6, 4), False),
        "56": (date(2001, 6, 3), False),
    }


# Rows of a 2003–2004 kritz list whose post the museum holds under an
# edited title. Each printed the post's own month and day.
UOFORUM_19 = {"title": "하이딩 마사를 키워보자 :)", "author": "J^^U",
              "gold_heads": {19: ("하이딩 마사를 키워보자 :) Written by J^^U", "anonymous")}}
Q_A_2429 = {"title": "홈피 최하단에 SEARCH->Forg'S World ...", "author": "forg",
            "gold_heads": {2429: ("질문시 먼저 검색란부터 활용을 해주시면 좋겠습니다.", "Forg")}}


def test_a_row_that_printed_the_posts_day_is_its_post_when_author_or_title_hold():
    # What fails this: no edited-title rule, authors compared unfolded
    # (`forg`, `Forg`), or the title containment dropped (UOForum 19's
    # author was not parsed).
    gold = {19: date(2001, 3, 21)}
    assert pin_year(19, 3, 21, 2003, date(2003, 10, 23), gold, [19], **UOFORUM_19) == (date(2001, 3, 21), False)
    gold = {2429: date(2001, 3, 7)}
    assert pin_year(2429, 3, 7, 2004, date(2005, 2, 6), gold, [2429], **Q_A_2429) == (date(2001, 3, 7), False)


def test_an_edited_title_needs_the_posts_day_and_an_author_or_a_long_shared_title():
    # What fails this: the printed day not checked (a 2004 row of the same
    # author on another day), the author/title check dropped (UOForum 57:
    # neither the author, unparsed, nor the titles agree), or a title under
    # six folded characters counted (UOForum 51's `알케미스트`).
    gold = {2429: date(2001, 3, 7)}
    assert pin_year(2429, 4, 9, 2004, date(2005, 2, 6), gold, [2429], **Q_A_2429) == (date(2004, 4, 9), True)
    uoforum_57 = {"title": "카펜터를 키워보자", "author": "lius",
                  "gold_heads": {57: ("카펜터 경험담 [Written by lius]", "anonymous")}}
    gold = {57: date(2001, 4, 13)}
    assert pin_year(57, 4, 13, 2003, date(2004, 1, 16), gold, [57], **uoforum_57) == (date(2003, 4, 13), True)
    uoforum_51 = {"title": "알케미스트", "author": "sarevok", "gold_heads": {51: ("알케미스트(sarevok)", "anonymous")}}
    gold = {51: date(2001, 4, 9)}
    assert pin_year(51, 4, 9, 2002, date(2003, 5, 12), gold, [51], **uoforum_51) == (date(2002, 4, 9), True)


def test_a_page_year_is_never_before_the_install_the_row_belongs_to():
    # What fails this: the page year not raised to the install's start
    # (FunBoard numbered again after 2005-02-06).
    restart = {"title": "펭귄", "author": "kim", "gold_heads": {}, "not_before": date(2005, 2, 6)}
    assert pin_year(141, 1, 10, 2004, date(2007, 11, 8), {}, [], **restart) == (date(2006, 1, 10), True)
    assert pin_year(141, 3, 1, 2004, date(2007, 11, 8), {}, [], **restart) == (date(2005, 3, 1), True)


# FunBoard 1000 and 141 on two pages of a 2007 list, above two 2001 posts
# the museum holds; 18428 on the last list of the old numbering (2005-02-06 18:10 UTC,
# the 7th in Korea), between two posts of that week; and 611, the highest
# number on the first list after the drop (2005-10-16 18:55 UTC), here
# under a view.
ROW = """<tr><td width="20"><img src="skin/kritz_normal/old_head.gif"></td>
<td><a href="view_info.php?id=FunBoard&member_no=0">엔젤</a></td>
<td><a href="zboard.php?id=FunBoard&no={no}">{title}</a></td><td>{day}</td><td>40</td></tr>"""
KRITZ_2007 = "<table>" + ROW.format(no=141, title="펭귄", day="07/10") + "</table>"
KRITZ_2007_50 = "<table>" + ROW.format(no=1000, title="여름", day="07/12") + "</table>"
KRITZ_2005 = "<table>" + ROW.format(no=18428, title="로키가 돌아왔다..", day="02/05") + "</table>"
KRITZ_2005_10 = "<table>" + ROW.format(no=611, title="8초 9초 필요없다", day="10/16") + "</table>"


def test_a_row_of_a_board_numbered_again_is_dated_within_its_install(tmp_path, monkeypatch):
    # What fails this: no restart check, or the older install's posts kept
    # as neighbours (the 2001 posts 140 and 142 date the 2007 row 1000
    # 2001-07-12, whose window spans two years); the restart's own day
    # counted as the new install, where the last old list was captured
    # (18428 loses its neighbours and lands in 2006); no upper bound, or one
    # taken from the old numbering's captures, from the latest capture
    # showing the number, or from the list pages alone (141 is then dated by
    # its page, 2007), or highest numbers not carried forward (page 124's
    # 141 after 611 hides 611's own bound).
    listing = load_stage("02c-parse-listing.py")
    board = tmp_path / "posts" / "FunBoard"
    board.mkdir(parents=True)
    for no, created in (("140", "2001-07-09T10:00:00"), ("142", "2001-07-11T10:00:00"),
                        ("18427", "2005-02-04T10:00:00"), ("18429", "2005-02-05T20:00:00")):
        (board / f"{no}.json").write_text(
            f'{{"postId": "{no}", "title": "글 {no}", "author": "lee", "createdAt": "{created}"}}', encoding="utf-8")
    pages = []
    for name, html in (("page-124", KRITZ_2007), ("page-50", KRITZ_2007_50), ("page-1", KRITZ_2005)):
        pages.append(tmp_path / f"{name}.html")
        pages[-1].write_text(html, encoding="utf-8")
    view = tmp_path / "605.html"
    view.write_text(KRITZ_2005_10, encoding="utf-8")
    monkeypatch.setattr(listing, "POSTS_DIR", tmp_path / "posts")
    monkeypatch.setattr(listing, "RESTARTS", {"FunBoard": (date(2005, 2, 7),)})
    captures = {("FunBoard", "page-124"): "20071108035921", ("FunBoard", "page-50"): "20071108034512",
                ("FunBoard", "page-1"): "20050206181043"}
    built = listing.build_listing("FunBoard", pages, captures, dict.fromkeys(captures, "zeroboard"),
                                  extras=[(view, "20051016185519", 1, "zeroboard")])
    assert [(e.no, e.createdAt, e.yearApprox) for e in built.entries] == [
        ("18428", date(2005, 2, 5), False),
        ("1000", date(2007, 7, 12), True),
        ("611", date(2005, 10, 16), False),
        ("141", date(2005, 7, 10), False),
    ]


def test_a_restarted_installs_window_dates_a_row_only_when_one_day_fits():
    # What fails this: an open lower or upper end of the window (02/07 is the
    # restart's own day, 10/16 the bound's), or taking a day when several
    # years fit (ScreenShot's window runs 2005-02-07 to 2007-10-11) or when
    # none does (12/25 after the bound: the page's year stays).
    row = {"title": "글", "author": "kim", "gold_heads": {}, "not_before": date(2005, 2, 7)}
    funboard = {**row, "not_later": date(2005, 10, 16)}
    assert pin_year(141, 2, 7, 2006, date(2007, 11, 8), {}, [], **funboard) == (date(2005, 2, 7), False)
    assert pin_year(141, 10, 16, 2006, date(2007, 11, 8), {}, [], **funboard) == (date(2005, 10, 16), False)
    assert pin_year(141, 12, 25, 2006, date(2007, 11, 8), {}, [], **funboard) == (date(2006, 12, 25), True)
    screenshot = {**row, "not_later": date(2007, 10, 11)}
    assert pin_year(23, 6, 18, 2007, date(2007, 10, 31), {}, [], **screenshot) == (date(2007, 6, 18), True)


def test_a_page_is_dated_by_its_captures_korean_day():
    # What fails this: anchoring on the capture's UTC day — ScreenShot 11794,
    # listed 02/07 on a page captured 2005-02-06 18:43 UTC (the 7th in
    # Korea), went back to 2004.
    listing = load_stage("02c-parse-listing.py")
    rows = [{"no": "11794", "month_day": (2, 7), "notice": False}, {"no": "11793", "month_day": (2, 6), "notice": False}]
    listing.walk_page_years(rows, "20050206184341")
    assert [r["page_year"] for r in rows] == [2005, 2005]


def test_a_page_year_raised_past_its_own_capture_stays_the_pages():
    # What fails this: raising the page year to the restart even when that
    # dates the row after its capture (01/20 captured 2005-10-16, after a
    # 2005-02-07 restart, is not 2006-01-20); or raising a row printed on the
    # restart's own day a year past it.
    restart = {"title": "글", "author": "kim", "gold_heads": {}, "not_before": date(2005, 2, 7)}
    assert pin_year(141, 1, 20, 2005, date(2005, 10, 16), {}, [], **restart) == (date(2005, 1, 20), True)
    assert pin_year(141, 2, 7, 2004, date(2007, 11, 8), {}, [], **restart) == (date(2005, 2, 7), True)


def test_an_edited_title_counts_from_six_characters_and_only_as_the_start():
    # What fails this: a floor above six (`낚시캐릭질문` is six folded
    # characters), or a title found inside the other rather than at its start
    # (`아이디어상품` in `오늘본영화/아이디어상품`).
    six = {"title": "낚시 캐릭 질문", "author": "kim", "gold_heads": {7: ("낚시 캐릭 질문 -- 누구", "lee")}}
    assert pin_year(7, 4, 4, 2003, date(2004, 1, 16), {7: date(2001, 4, 4)}, [7], **six) == (date(2001, 4, 4), False)
    inside = {"title": "아이디어 상품", "author": "kim", "gold_heads": {9: ("오늘 본 영화/아이디어 상품", "lee")}}
    assert pin_year(9, 10, 11, 2003, date(2004, 1, 16), {9: date(2001, 10, 11)}, [9], **inside) == (date(2003, 10, 11), True)


def _board(tmp_path, monkeypatch, board, restarts, gold, pages):
    """Build `board`'s listing from `pages` ({name: (capture time, rows)}),
    its gold posts `gold` ({no: date}) and `restarts`."""
    listing = load_stage("02c-parse-listing.py")
    posts = tmp_path / "posts" / board
    posts.mkdir(parents=True)
    for no, created in gold.items():
        (posts / f"{no}.json").write_text(
            f'{{"postId": "{no}", "title": "글 {no}", "author": "lee", "createdAt": "{created}"}}', encoding="utf-8")
    files, captures = [], {}
    for name, (ts, rows) in pages.items():
        files.append(tmp_path / f"{name}.html")
        files[-1].write_text("<table>" + "".join(ROW.format(no=no, title=f"목록 {no}", day=day).replace("FunBoard", board)
                                                 for no, day in rows) + "</table>", encoding="utf-8")
        captures[(board, name)] = ts
    monkeypatch.setattr(listing, "POSTS_DIR", tmp_path / "posts")
    monkeypatch.setattr(listing, "RESTARTS", {board: restarts})
    built = listing.build_listing(board, files, captures, dict.fromkeys(captures, "zeroboard"))
    return {e.no: (e.createdAt, e.yearApprox) for e in built.entries}


def test_a_gold_post_of_the_restart_day_is_the_new_installs(tmp_path, monkeypatch):
    # What fails this: an install's posts taken from the day after its
    # restart — 900, posted on the restart day, then no longer dates 901.
    built = _board(tmp_path, monkeypatch, "FunBoard", (date(2005, 6, 14),), {900: "2005-06-14T16:00:00"},
                   {"page-50": ("20071108034512", [(901, "07/13")])})
    assert built["901"] == (date(2005, 7, 13), False)


def test_an_install_ends_where_the_next_one_starts(tmp_path, monkeypatch):
    # What fails this: a later install's post kept as a neighbour — 34 of
    # 2003 makes 33's neighbours disagree, so its year turns approximate.
    built = _board(tmp_path, monkeypatch, "Sell", (date(2001, 6, 22), date(2003, 1, 1)),
                   {32: "2002-07-20T10:00:00", 34: "2003-05-01T10:00:00"},
                   {"page-2": ("20021220030000", [(33, "07/24")])})
    assert built["33"] == (date(2002, 7, 24), False)


def test_a_post_of_the_next_restarts_day_is_still_the_earlier_installs(tmp_path, monkeypatch):
    # What fails this: an install ending the day before the next restart —
    # 34, posted on 2003-01-01 before the new install began that day, then no
    # longer dates 35 (captured the same day, 01/01 fitting 2002 and 2003),
    # whose year turns approximate.
    built = _board(tmp_path, monkeypatch, "Sell", (date(2001, 6, 22), date(2003, 1, 1)),
                   {34: "2003-01-01T09:00:00"}, {"page-1": ("20030101030000", [(35, "01/01")])})
    assert built["35"] == (date(2003, 1, 1), False)
