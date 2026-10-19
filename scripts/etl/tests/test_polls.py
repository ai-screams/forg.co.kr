"""Stage 2i: UO_Vote's polls (forg's "UO.POLL" board) become posts."""
import json
from datetime import datetime
from pathlib import Path

import pytest

from stages import load_stage

polls = load_stage("02i-parse-polls.py")

FIXTURES = Path(__file__).parent / "fixtures" / "vote"
LIST_1 = (FIXTURES / "list-zb-20020206185418.html").read_text(encoding="utf-8")
LIST_6 = (FIXTURES / "list-zb-page6-20020126074754.html").read_text(encoding="utf-8")
VIEW_83 = (FIXTURES / "view-83-20020114205256.html").read_text(encoding="utf-8")
VIEW_58 = (FIXTURES / "view-58-20011123112357.html").read_text(encoding="utf-8")
LIST_URL = "http://forg.uospace.net/zb/zboard.php?id=UO_Vote&page=6"
VIEW_URL = "http://forg.uospace.net/zb/view.php?id=UO_Vote&no=83"


# Fails if: a poll's options run on into the next poll's, its comment count
# is lost, or a page with two polls yields one.
def test_a_list_prints_each_poll_with_its_own_options():
    assert polls.list_polls(LIST_6) == [
        {"no": "45", "title": "선택될것 같은 새샤드의 이름은.", "listedComments": 9,
         "options": ["알려줄수 없는 뭔가 다른 이름", "고조선", "조선", "고구려", "고려", "신라"]},
        {"no": "37", "title": "어떤 경로에 의해 Forg홈을 찿으셨는지....", "listedComments": 10,
         "options": ["MSN", "야후", "엠파스", "uospace 또는 크리츠님홈", "아는분의 소개로...", "다른 검색사이트..."]},
    ]


# Fails if: the question keeps the total, an option loses its votes or share,
# or a comment loses its author, member number, second-precise time or text.
def test_a_view_gives_the_results_and_the_comments():
    view = polls.view_poll(VIEW_83)
    assert view["title"] == "어떠한 매크로프로그램을 사용하십니까?"
    assert view["total"] == 250
    assert view["options"] == [("이지유오", 13, 5), ("UOA사용", 125, 50), ("울온자체매클", 28, 11),
                               ("케알룹", 40, 16), ("이지매크로", 3, 1), ("맨손'ㅡ'", 41, 16)]
    assert len(view["comments"]) == 20
    assert view["comments"][0] == {"author": "Avatar", "authorMemberNo": "748",
                                   "createdAt": datetime(2001, 12, 20, 18, 39, 7),
                                   "bodyHtml": "저 위에꺼 다쓰는데 어카져 ㅡㅡ"}


# Fails if: a guest's comment (no profile link) is dropped or given a number.
def test_a_guest_comment_keeps_its_name_without_a_member_number():
    guests = [c for c in polls.view_poll(VIEW_58)["comments"] if c["authorMemberNo"] is None]
    assert [c["author"] for c in guests] == ["해오라기", "온초보"]


def posts() -> dict[str, object]:
    lists = [("20020126074754", LIST_URL, LIST_6), ("20020206185418", LIST_URL, LIST_1),
             ("20020124125955", LIST_URL, LIST_6.replace("no=45", "no=83"))]
    views = [("20020114205256", VIEW_URL, VIEW_83)]
    return {p.postId: p for p in polls.build(lists, views, datetime(2026, 10, 20))}


# Fails if: a poll is dated by a comment (the list would leave poll order) or
# given an author no capture names, a view does not win over the list, or a
# poll known only from a list loses its options or the note on what is gone.
def test_every_poll_is_a_post_undated_and_unsigned():
    got = posts()
    assert sorted(got, key=int) == ["37", "45", "83", "113"]
    assert {p.createdAt for p in got.values()} == {datetime(1970, 1, 1)}
    assert {p.author for p in got.values()} == {"anonymous"}
    viewed = got["83"]
    assert viewed.title == "어떠한 매크로프로그램을 사용하십니까?"
    assert viewed.capturedAt == "20020114205256" and viewed.originalUrl == VIEW_URL
    assert len(viewed.comments) == 20
    assert '<table width="50%" bgcolor="#999999"' in viewed.bodyHtml
    assert "UOA사용 [ 125 voted ]" in viewed.bodyText and "2002-01-14 캡처" not in viewed.bodyText
    assert "투표 수와 댓글은 2002-01-14 캡처 때의 것입니다" in viewed.bodyHtml
    listed = got["45"]
    assert listed.comments == [] and listed.capturedAt == "20020126074754"
    assert "<td>고조선</td>" in listed.bodyHtml
    assert "투표 수와 댓글(9개)은 남아 있지 않습니다" in listed.bodyHtml


# Fails if: a poll's options come from an older list than the newest one
# printing it (options were added over time).
def test_the_newest_list_gives_a_polls_options():
    older = LIST_6.replace("고조선", "옛 항목")
    lists = [("20020101000000", LIST_URL, older), ("20020126074754", LIST_URL, LIST_6)]
    got = {p.postId: p for p in polls.build(lists, [], datetime(2026, 10, 20))}
    assert "고조선" in got["45"].bodyHtml and "옛 항목" not in got["45"].bodyHtml


# Fails if: a poll whose list printed no comment count is said to have lost
# comments.
def test_a_poll_without_listed_comments_says_only_its_votes_are_gone():
    note = polls.source_note({"listedComments": 0, "capturedAt": "20020126074754"}, viewed=False)
    assert "투표 수는 남아 있지 않습니다" in note and "댓글" not in note


# Fails if: an option's text reaches the page unescaped.
def test_an_option_is_escaped():
    body = polls.results_html({"total": 1, "options": [("<b>x</b>", 1, 100)]})
    assert "&lt;b&gt;x&lt;/b&gt;" in body and "<b>x</b>" not in body


@pytest.fixture
def silver(tmp_path, monkeypatch):
    root = tmp_path / "S"
    (root / "zb").mkdir(parents=True)
    monkeypatch.setattr(polls, "SILVER", root)
    return root


def row(ts: str, kind: str = "zboard", board: str = "zb", phase: str = "S") -> dict:
    return {"phase": phase, "board": board, "post_id": f"{kind}.php_id_UO_Vote_page_6", "ts": ts,
            "url": f"http://forg.uospace.net:80/{board}/{kind}.php?id=UO_Vote"}


# Fails if: a plan row of another phase, folder or page kind is read, or the
# port stays in the URL.
def test_captures_reads_the_s_phase_pages_of_the_board(silver):
    (silver / "zb" / "zboard.php_id_UO_Vote_page_6~20020126074754.html").write_text("x", encoding="utf-8")
    plan = [row("20020126074754"), row("20020126074754", phase="LZ"), row("20020126074754", board="bbs"),
            row("20020126074754", kind="view")]
    assert polls.captures(plan, "zboard") == [
        ("20020126074754", "http://forg.uospace.net/zb/zboard.php?id=UO_Vote", "x")]


# Fails if: a plan row with no silver file, or with two, passes quietly.
def test_captures_stops_without_exactly_one_silver_file(silver):
    with pytest.raises(ValueError, match="0 silver files"):
        polls.captures([row("20020126074754")], "zboard")


# Fails if: IP-shaped text in a poll reaches the gold tier.
def test_ip_shaped_text_stops_the_run(silver, tmp_path, monkeypatch):
    (silver / "zb" / "zboard.php_id_UO_Vote_page_6~20020126074754.html").write_text(
        LIST_6.replace("고조선", "211.104.1.25"), encoding="utf-8")
    plan = tmp_path / "plan.json"
    plan.write_text(json.dumps([row("20020126074754")]), encoding="utf-8")
    monkeypatch.setattr(polls, "PLAN", plan)
    monkeypatch.setattr(polls, "OUTPUT_DIR", tmp_path / "out")
    monkeypatch.setattr("sys.argv", ["02i", "--dry-run"])
    with pytest.raises(ValueError, match="IP-shaped"):
        polls.main()


# Fails if: a run rewrites a post that exists (a new `parsedAt` in every
# file), or `--force` does not.
@pytest.mark.parametrize("argv, rewritten", [([], False), (["--force"], True)])
def test_an_existing_post_is_left_alone_unless_forced(silver, tmp_path, monkeypatch, argv, rewritten):
    (silver / "zb" / "zboard.php_id_UO_Vote_page_6~20020126074754.html").write_text(LIST_6, encoding="utf-8")
    plan = tmp_path / "plan.json"
    plan.write_text(json.dumps([row("20020126074754")]), encoding="utf-8")
    out = tmp_path / "out"
    out.mkdir()
    (out / "45.json").write_text("kept", encoding="utf-8")
    monkeypatch.setattr(polls, "PLAN", plan)
    monkeypatch.setattr(polls, "OUTPUT_DIR", out)
    monkeypatch.setattr("sys.argv", ["02i", *argv])
    polls.main()
    assert ((out / "45.json").read_text(encoding="utf-8") != "kept") is rewritten
    assert (out / "37.json").exists()
