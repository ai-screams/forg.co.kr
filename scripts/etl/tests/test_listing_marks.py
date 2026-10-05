"""Notice and reply marks: what 02c reads off a list row, and how 03 puts
them on the index (only onto the post the row is, own notices first)."""
from datetime import datetime

from schemas import BoardIndexEntry, BoardIndexPage, BoardListingEntry
from stages import load_stage

listing = load_stage("02c-parse-listing.py")
index = load_stage("03-build-index.py")

# A 2001 Zeroboard 4.0 list (`Z/Q_A/2744`): a notice, a post, and replies one
# and two levels deep. The indent is `&nbsp; ` a level after the spacer's
# `<br>`; the `&nbsp;` before the spacer is not part of it, and neither are
# the markup's own line breaks.
OLD = """<table>
<tr><td><img src="skin/skyblue/list_notice.gif"></td>
<td>&nbsp;<img src="images/t.gif"><br><img src="skin/skyblue/notice_head.gif"> <a href="zboard.php?id=Q_A&no=2429">공지</a></td>
<td>Forg</td><td>2001/03/07</td><td>9</td></tr>
<tr><td>12</td>
<td>&nbsp;<img src="images/t.gif"><br><img src="skin/skyblue/old_head.gif">&nbsp;<a href="zboard.php?id=Q_A&no=270">질문</a></td>
<td>kim</td><td>2000/10/23</td><td>40</td></tr>
<tr><td>11</td>
<td>&nbsp;<img src="images/t.gif"><br>
   &nbsp; <img src="skin/skyblue/reply_head.gif"> <a href="zboard.php?id=Q_A&no=272">[RE] 질문</a></td>
<td>lee</td><td>2000/10/24</td><td>53</td></tr>
<tr><td>10</td>
<td>&nbsp;<img src="images/t.gif"><br>
   &nbsp; &nbsp; <img src="skin/skyblue/reply_head.gif"> <a href="zboard.php?id=Q_A&no=273">[RE] 질문</a></td>
<td>kim</td><td>2000/10/25</td><td>20</td></tr>
<tr><td>9</td>
<td>&nbsp;<img src="images/t.gif"><br>
   &nbsp; <img src="skin/skyblue/reply_new_head.gif"> <a href="zboard.php?id=Q_A&no=3137">감사합니다</a></td>
<td>park</td><td>2001/05/27</td><td>3</td></tr>
</table>"""


# Fails if: the indent counts plain spaces or runs past the spacer `<br>`, 4.0 rows drop
# the reply, or a fresh reply's `reply_new_head.gif` (`Z/Q_A/2987`) is not read.
def test_a_2001_list_gives_notices_and_reply_depths():
    rows, _ = listing.parse_page(OLD, "zeroboard40")
    assert [(r["no"], r["notice"], r["reply"]) for r in rows] == [
        ("2429", True, 0),
        ("270", False, 0),
        ("272", False, 1),
        ("273", False, 2),
        ("3137", False, 1),
    ]


# kritz_normal (`L/Role/page-40`): the marks sit in the icon cell, no depth.
KRITZ = """<table>
<tr><td width="20"><img src="skin/kritz_normal/list_notice.gif"></td>
<td><a href="view_info.php?id=Role&member_no=1">Forg</a></td>
<td><a href="zboard.php?id=Role&no=1">게시판입니다</a></td><td>06/14</td><td>900</td></tr>
<tr><td width="20"><img src="skin/kritz_normal/reply_head.gif"></td>
<td><a href="view_info.php?id=Role&member_no=0">호야</a></td>
<td><a href="zboard.php?id=Role&no=92">[RE] 탐방기</a></td><td>11/24</td><td>171</td></tr>
<tr><td width="20"><img src="skin/kritz_normal/old_head.gif"></td>
<td><a href="view_info.php?id=Role&member_no=0">엔젤</a></td>
<td><a href="zboard.php?id=Role&no=43">탐방기</a></td><td>10/15</td><td>400</td></tr>
</table>"""


# Fails if: kritz rows stop reading `reply_head.gif`.
def test_kritz_marks_a_reply_without_its_depth():
    rows, _ = listing.parse_page(KRITZ, "zeroboard")
    assert [(r["no"], r["notice"], r["reply"]) for r in rows] == [
        ("1", True, 0),
        ("92", False, 1),
        ("43", False, 0),
    ]


# Gnuboard4 webbus2009 (`B/Ultima/2489`): `icon_notice.gif` for a notice's
# number, ` &nbsp;&nbsp; ` a level before `icon_reply.gif`.
G4 = """<table>
<tr><td><img src="../skin/board/webbus2009_basic/img/icon_notice.gif"></td>
<td><a href="../bbs/board.php?bo_table=Ultima&wr_id=65">공지입니다</a></td>
<td><span class="member">forg</span></td><td>2013-01-02</td><td>99</td></tr>
<tr><td>645</td>
<td>
   &nbsp;&nbsp; <img src="../skin/board/webbus2009_basic/img/icon_reply.gif"><a href="../bbs/board.php?bo_table=Ultima&wr_id=2570">빈계정</a></td>
<td><span class="member">마다오</span></td><td>2013-08-08</td><td>27</td></tr>
<tr><td>644</td>
<td> &nbsp;&nbsp;  &nbsp;&nbsp; <img src="../skin/board/webbus2009_basic/img/icon_reply.gif"><a href="../bbs/board.php?bo_table=Ultima&wr_id=2571">re</a></td>
<td><span class="member">kim</span></td><td>2013-08-09</td><td>3</td></tr>
<tr><td>643</td>
<td><a href="../bbs/board.php?bo_table=Ultima&wr_id=2560">글</a></td>
<td><span class="member">lee</span></td><td>2013-08-01</td><td>5</td></tr>
</table>"""


# Fails if: Gnuboard4 ignores `icon_notice.gif`, or counts one `&nbsp;` a level.
def test_gnuboard4_marks_notices_and_counts_two_nbsp_a_level():
    rows, _ = listing.parse_page(G4, "gnuboard4")
    assert [(r["no"], r["notice"], r["reply"]) for r in rows] == [
        ("65", True, 0),
        ("2570", False, 1),
        ("2571", False, 2),
        ("2560", False, 0),
    ]


def _listing_entry(**kw) -> BoardListingEntry:
    base = dict(no="1", title="t", author="a", commentCount=0, capturedAt="20010101000000", listPage=1)
    return BoardListingEntry(**{**base, **kw})


def _index_entry(**kw) -> BoardIndexEntry:
    base = dict(
        postId="1", title="t", author="a", createdAt=datetime(2001, 1, 1),
        commentCount=0, attachmentCount=0, era="2003",
    )
    return BoardIndexEntry(**{**base, **kw})


# Fails if: `dump_listing` writes `replyDepth: 0` on every row.
def test_the_listing_json_writes_reply_depth_only_on_replies():
    from schemas import BoardListing

    page = BoardListing(
        board="Q_A", engine="zeroboard", pagesCaptured=1, capturesRead=1,
        generatedAt=datetime(2026, 1, 1),
        entries=[_listing_entry(no="2"), _listing_entry(no="3", replyDepth=2)],
    )
    entries = listing.dump_listing(page)["entries"]
    assert ["replyDepth" in e for e in entries] == [False, True]
    assert entries[1]["replyDepth"] == 2


# Fails if: `same_post` keeps spaces, the `[RE]`, or reads a cut title whole.
def test_a_row_is_its_post_when_the_titles_agree():
    post = _index_entry(title="Load Oaks[일쉐나챔피언] 사냥 후기", author="kim")
    for row_title in (
        "Load Oaks [일쉐나챔피언] 사냥 후기",  # the link text's extra space
        "Load Oaks[일쉐나챔피언] 사냥..",  # cut short by the list
        "[RE] Load Oaks[일쉐나챔피언] 사냥 후기",  # a 2001 reply's subject
    ):
        assert index.same_post(post, _listing_entry(title=row_title, author="lee")), row_title


# Fails if: an uncut prefix, one trailing dot, a title of dots, the number alone, or a
# reply's author makes a match.
def test_a_row_with_the_posts_number_but_another_title_and_author_is_not_it():
    # Q_A no=272: a 2000 reply on one install, a 2001 question on another.
    post = _index_entry(title="이런글 여기다 올려도 될지 모르겠지만..", author="sepirothzero")
    row = _listing_entry(title="[RE] 퀘스트 받어내거나 담 퀘스트로", author="Forg")
    assert not index.same_post(post, row)
    # An uncut row title that is only the start of the post's is another post.
    assert not index.same_post(_index_entry(title="질문입니다 2", author="kim"), _listing_entry(title="질문입니다", author="lee"))
    # A row title of dots alone says nothing; one dot is the title's own.
    assert not index.same_post(_index_entry(title="질문", author="kim"), _listing_entry(title="..", author="lee"))
    assert not index.same_post(_index_entry(title="질문 있어요", author="kim"), _listing_entry(title="질문.", author="lee"))
    # The author stands in for the title only for a notice.
    assert not index.same_post(_index_entry(title="첫 질문", author="kim"), _listing_entry(title="둘째 질문", author="kim", replyDepth=1))


# Fails if: the author fallback goes, or compares names case-sensitively.
def test_a_notice_whose_title_was_rewritten_is_its_post_by_author():
    post = _index_entry(title="질문시 먼저 검색란부터 활용을 해주시면 좋겠습니다.", author="Forg")
    row = _listing_entry(title="홈피 최하단에 SEARCH->Forg'S World ...", author="forg", isNotice=True)
    assert index.same_post(post, row)


# Fails if: `_merge_listing` skips `same_post`, or list-only rows lose their marks.
def test_marks_go_only_onto_the_post_the_row_is(monkeypatch):
    from schemas import BoardListing

    rows = [
        _listing_entry(no="1", title="게시판 안내", author="Forg", isNotice=True),
        _listing_entry(no="2", title="다른 글", author="lee", replyDepth=1),
        _listing_entry(no="9", title="목록에만", author="park", replyDepth=2),
    ]
    monkeypatch.setattr(index, "_load_listing", lambda board: BoardListing(
        board="Q_A", engine="zeroboard", pagesCaptured=1, capturesRead=1,
        generatedAt=datetime(2026, 1, 1), entries=rows,
    ))
    posts = [
        _index_entry(postId="1", title="게시판 안내", author="Forg"),
        _index_entry(postId="2", title="질문", author="kim"),
    ]
    merged, added, _ = index._merge_listing("Q_A", posts, "2003")
    got = {e.postId: (e.isNotice, e.replyDepth, e.hasPost) for e in merged}
    assert got == {"1": (True, 0, True), "2": (False, 0, True), "9": (False, 2, False)}
    assert added == 1


# Fails if: `[RE]` stops counting (or needs exact case and spacing), or a row
# without the icon lowers the depth the subject gave.
def test_a_subject_starting_re_is_a_reply_unless_a_list_shows_its_depth(monkeypatch):
    from schemas import BoardListing

    rows = [
        _listing_entry(no="3", title="질문", author="kim", replyDepth=2),
        _listing_entry(no="4", title="답", author="lee"),  # the row lost the icon; the subject keeps it
        _listing_entry(no="9", title="목록에만", author="park", categoryLabel="RE"),
    ]
    monkeypatch.setattr(index, "_load_listing", lambda board: BoardListing(
        board="Q_A", engine="zeroboard", pagesCaptured=1, capturesRead=1,
        generatedAt=datetime(2026, 1, 1), entries=rows,
    ))
    posts = [
        _index_entry(postId="3", title="질문", author="kim", categoryLabel="RE", replyDepth=index.reply_by_subject("RE")),
        _index_entry(postId="4", title="답", author="lee", categoryLabel=" re ", replyDepth=index.reply_by_subject(" re ")),
        _index_entry(postId="5", title="말머리", author="lee", categoryLabel="질문", replyDepth=index.reply_by_subject("질문")),
    ]
    merged, _, _ = index._merge_listing("Q_A", posts, "2003")
    assert {e.postId: e.replyDepth for e in merged} == {"3": 2, "4": 1, "5": 0, "9": 1}


# Fails if: `_entry_from_post` drops `reply_by_subject`.
def test_a_post_entry_takes_its_reply_from_the_subject():
    from schemas import Post

    def post(category):
        return Post(
            board="Q_A", boardKr="질문답변", postId="272", title="질문", categoryLabel=category,
            bodyHtml="<p>x</p>", bodyText="x", author="kim", createdAt=datetime(2000, 10, 24),
            era="2003", capturedAt="20001024000000", parsedAt=datetime(2026, 1, 1),
            originalUrl="http://forg.co.kr/zboard/zboard.php?id=Q_A&no=272", sourceEngine="zeroboard",
        )

    assert [index._entry_from_post(post(c)).replyDepth for c in ("RE", "질문", None)] == [1, 0, 0]


# Fails if: notices are not pinned, or a carried board's notices stay notices.
def test_own_notices_lead_and_carried_ones_keep_their_date():
    own_notice = _index_entry(postId="1", createdAt=datetime(2000, 6, 14), isNotice=True)
    carried_notice = index.carry(_index_entry(postId="5", createdAt=datetime(2004, 1, 1), isNotice=True, replyDepth=2), "UoBoard")
    assert (carried_notice.board, carried_notice.isNotice, carried_notice.replyDepth) == ("UoBoard", False, 2)
    newest = _index_entry(postId="7", createdAt=datetime(2008, 1, 1))
    older = _index_entry(postId="3", createdAt=datetime(2002, 1, 1))
    got = sorted([older, carried_notice, newest, own_notice], key=index.index_order, reverse=True)
    assert [e.postId for e in got] == ["1", "7", "5", "3"]


# Fails if: `_dump_page` writes the marks on every row.
def test_the_index_json_writes_marks_only_on_marked_rows():
    page = BoardIndexPage(
        board="Q_A", page=1, totalPages=1, totalPosts=2, totalWithPost=2,
        generatedAt=datetime(2026, 1, 1),
        entries=[_index_entry(postId="1", isNotice=True, replyDepth=0), _index_entry(postId="2", replyDepth=3)],
    )
    import json

    entries = json.loads(index._dump_page(page))["entries"]
    assert [(e.get("isNotice"), e.get("replyDepth")) for e in entries] == [(True, None), (None, 3)]
