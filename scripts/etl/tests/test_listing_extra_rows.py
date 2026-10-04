"""02c's rows from captures that are not list pages: post views and 2001 lists."""
from datetime import date

from stages import load_stage

stage = load_stage("02c-parse-listing.py")

# A Zeroboard 4.1 post view: a link in the body, the list printed under the
# post, and a row of another board's list.
VIEW = """<html><body><table>
<tr><td>본문</td><td><a href="zboard.php?id=UoBoard&no=50">본문 속 링크</a></td></tr>
<tr><td><a href="view_info.php?id=UoBoard&member_no=7">kim</a></td>
<td><a href="zboard.php?id=UoBoard&page=3&no=120">목록 행</a> [2]</td><td>08/26</td><td>321</td></tr>
<tr><td><a href="view_info.php?id=Q_A&member_no=8">lee</a></td>
<td><a href="zboard.php?id=Q_A&page=3&no=77">다른 게시판</a></td><td>08/25</td><td>12</td></tr>
</table></body></html>"""


def test_a_view_gives_only_its_dated_rows_of_its_own_board():
    rows = stage.extra_rows(VIEW, "zeroboard", "UoBoard", "20030827120000")
    got = [(r["no"], r["title"], r["author"], r["month_day"], r["hits"], r["comments"], r["page_year"]) for r in rows]
    assert got == [("120", "목록 행", "kim", (8, 26), 321, 2, 2003)]


def test_another_boards_row_does_not_move_the_years():
    # Read first, the Q_A row's 12/31 would roll the page back a year and
    # date the UoBoard row 2003-01-02 instead of 2004.
    view = """<table>
<tr><td><a href="view_info.php?id=Q_A&member_no=8">lee</a></td>
<td><a href="zboard.php?id=Q_A&no=77">다른 게시판</a></td><td>12/31</td><td>12</td></tr>
<tr><td><a href="view_info.php?id=UoBoard&member_no=7">kim</a></td>
<td><a href="zboard.php?id=UoBoard&no=120">목록 행</a></td><td>01/02</td><td>5</td></tr>
</table>"""
    rows = stage.extra_rows(view, "zeroboard", "UoBoard", "20040103120000")
    assert [(r["no"], r["page_year"]) for r in rows] == [("120", 2004)]


# A 2001 Zeroboard 4.0 row: running count, title, author, full date, hits.
OLD = """<html><body><table>
<tr align="center"><td>173</td>
<td align="left"><a href="zboard.php?id=Q_A&amp;page=122&amp;no=174">[질문]계정신청 방법?</a> [3]</td>
<td> 코키리</td><td><span title="2000년 10월 19일 01시 07분 06초">2000/10/19</span></td><td>30</td></tr>
<tr><td>본문 속 <a href="zboard.php?id=Q_A&no=9">링크</a></td></tr>
</table></body></html>"""


def test_a_2001_row_takes_the_author_after_the_title_and_the_full_date():
    rows, _total = stage.parse_page(OLD, "zeroboard40")
    got = [(r["no"], r["board"], r["title"], r["author"], r["full_date"], r["hits"], r["comments"]) for r in rows]
    assert got == [("174", "Q_A", "[질문]계정신청 방법?", "코키리", date(2000, 10, 19), 30, 3)]
