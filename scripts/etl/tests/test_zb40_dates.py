"""Stage 2f dates a Zeroboard 4.0 post from a list row only when the row is
the post; 05b puts that date on the posts already parsed."""
import json
import shutil
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

import pytest

from schemas import Post
from stages import load_stage

zb40 = load_stage("02f-parse-zeroboard40.py")
repair = load_stage("05b-repair-zeroboard40-dates.py")

FIXTURES = Path(__file__).parent / "fixtures"
# FunBoard 62 as 02f wrote it: dated 2002-06-21 by another post's row,
# captured 2001-07-13.
POST = (FIXTURES / "zb40-dates" / "FunBoard-62.json").read_bytes().decode("utf-8")

# Two rows of the list the /zb/ install printed (`LZ/Sell/y-page-13`, 2002),
# e-mail addresses dropped: the title a link, cut short with `...`; the
# author's profile link, which names the board but no post; the time in the
# date cell's `title`.
SELL_LIST = """<!-- 목록 부분 시작 -->
<tr align="center" bgcolor="#FEFDFD">
<td class="thm8" height="20">159</td>
<td>아리랑</td> <td align="left" style="word-break:break-all;"><img src="skin/kritz_htred/old_head.gif"/> <a href="zboard.php?id=Sell&amp;page=13&amp;select_arrange=headnum&amp;desc=asc&amp;no=183">크리스마스 트리 삽니다</a> <font style="font-family:Tahoma;font-size:7pt;">[1]</font></td>
<td style="word-break:break-all;"><b> <a href="javascript:void(window.open('view_info.php?id=Sell&amp;member_no=2636','mailform'))">zeno</a></b></td>
<td class="thm8"><span title="2002년 01월 04일 21시 02분 12초">2002/01/04</span></td>
<td class="thm8">105</td>
</tr>
<!-- 목록 부분 시작 -->
<tr align="center" bgcolor="#FEFDFD">
<td class="thm8" height="20">158</td>
<td>아리랑</td> <td align="left" style="word-break:break-all;"><img src="skin/kritz_htred/old_head.gif"/> <a href="zboard.php?id=Sell&amp;page=13&amp;select_arrange=headnum&amp;desc=asc&amp;no=181">아량계정 오늘거래하시는분 13장에드...</a> <font style="font-family:Tahoma;font-size:7pt;"></font></td>
<td style="word-break:break-all;"> <a href="javascript:void(window.open('view_info.php?id=Sell&amp;member_no=0','mailform'))">덜멩이</a></td>
<td class="thm8"><span title="2002년 01월 04일 15시 00분 35초">2002/01/04</span></td>
<td class="thm8">142</td>
</tr>"""
# Sell 181 as the museum has it, captured 2002-02-22 on /zb/; and the row
# with its number on the 2001-06 install's list (`LZ/Sell/z-page-1`), another
# post, whose time 02f gave it.
SELL_181 = "아량계정 오늘거래하시는분 13장에드립니다. [필독]"
SELL_181_CAPTURED = "20020222104003"
OTHER_181 = ("타롯카드삽니다.", datetime(2001, 6, 8, 17, 43, 47))


def test_a_list_row_gives_its_title_and_time():
    # What fails this: the rows keeping only their time, or the title read
    # from another link of the row.
    assert zb40.list_row_dates(SELL_LIST) == {
        ("Sell", "183"): ("크리스마스 트리 삽니다", datetime(2002, 1, 4, 21, 2, 12)),
        ("Sell", "181"): ("아량계정 오늘거래하시는분 13장에드...", datetime(2002, 1, 4, 15, 0, 35)),
    }


def test_a_row_with_the_posts_number_dates_it_only_when_the_titles_agree():
    # What fails this: counting a row whatever its title (Sell 181 took the
    # other post's 2001-06-08), or reading the `...` cut title whole.
    own = zb40.list_row_dates(SELL_LIST)[("Sell", "181")]
    assert zb40.date_of(SELL_181, SELL_181_CAPTURED, [OTHER_181, own]) == (datetime(2002, 1, 4, 15, 0, 35), "list row")
    assert zb40.date_of(SELL_181, SELL_181_CAPTURED, [OTHER_181]) == (zb40.UNKNOWN_DATE, "unknown")


def test_a_row_agrees_with_its_post_once_its_category_is_split_off():
    # What fails this: comparing the row's title whole — the post's `[뉴스]`
    # went into its category (`Z/Notice/124`).
    when = datetime(2001, 11, 5, 7, 59, 22)
    rows = [("[뉴스]24시간동안 5개의 골렘만 제작가능", when)]
    assert zb40.date_of("24시간동안 5개의 골렘만 제작가능", "20011202072708", rows) == (when, "list row")


def test_a_reply_row_agrees_with_its_post():
    # What fails this: neither the category split nor `same_title`'s `[RE]`
    # taking the `[re]` off (`Z/DiabloBoard/10`); each alone is enough.
    when = datetime(2001, 9, 20, 23, 22, 57)
    rows = [("[re] 그 위치에 바로 글을 올리면 되나요?", when)]
    assert zb40.date_of("그 위치에 바로 글을 올리면 되나요?", "20011108023258", rows) == (when, "list row")


def test_agreeing_rows_that_disagree_give_the_time_most_captures_show_then_the_earliest():
    # What fails this: taking the earliest time regardless of how many
    # captures show it, or the latest of two shown equally often.
    title = "타워소유계정팜"
    early, late = datetime(2001, 7, 24, 16, 53, 40), datetime(2001, 7, 25, 9, 0, 0)
    assert zb40.date_of(title, "20010806020421", [(title, late), (title, early), (title, late)])[0] == late
    assert zb40.date_of(title, "20010806020421", [(title, late), (title, early)])[0] == early


def test_a_row_later_than_the_posts_capture_in_korea_is_not_the_post():
    # What fails this: no capture check, or one against the Wayback time
    # (UTC): 2001-07-27 20:00 there is 05:00 on the 28th in Korea.
    title = "전사는 재미있다^^"
    before, after = datetime(2001, 7, 28, 4, 0, 0), datetime(2001, 7, 28, 6, 0, 0)
    assert zb40.date_of(title, "20010727200000", [(title, after)]) == (zb40.UNKNOWN_DATE, "unknown")
    assert zb40.date_of(title, "20010727200000", [(title, before)]) == (before, "list row")


# UOForum 42 (captured 2001-07-24): its only rows, on a 2001 list
# (`LZ/UOForum/z-page-1-c10`), carry a byline its title no longer has.
UOFORUM_42 = "에헤랴~ 땅을 파세~......"
UOFORUM_42_ROW = ("에헤랴~ 땅을 파세~......   -- 검은사자비", datetime(2001, 4, 4, 8, 18, 41))


def test_a_row_whose_title_is_the_posts_with_more_after_it_dates_the_post():
    # What fails this: no longer-title rule, or one that compares the titles
    # unfolded (the row's spaces).
    assert zb40.date_of(UOFORUM_42, "20010724061920", [UOFORUM_42_ROW]) == (UOFORUM_42_ROW[1], "list row, longer title")
    row = ("에헤랴~땅을 파세~......-- 검은사자비", datetime(2001, 4, 4, 8, 18, 41))
    assert zb40.date_of("에헤랴~ 땅을파세~......", "20010724061920", [row])[1] == "list row, longer title"


def test_a_row_that_agrees_wins_over_one_with_a_longer_title():
    # What fails this: counting both kinds together — the longer title's
    # earlier time would win the tie.
    own = (UOFORUM_42, datetime(2001, 4, 5, 9, 0, 0))
    assert zb40.date_of(UOFORUM_42, "20010724061920", [UOFORUM_42_ROW, own]) == (own[1], "list row")


def test_only_a_title_of_six_characters_or_more_is_read_as_the_start_of_a_longer_one():
    # What fails this: no length floor, a floor above six, or one counting
    # spaces (`캐릭 질문요` is five characters folded).
    when = datetime(2001, 4, 4)
    assert zb40.date_of("낚시 캐릭 질문", "20010724061920", [("낚시 캐릭 질문 -- 누구", when)])[0] == when
    assert zb40.date_of("캐릭 질문요", "20010724061920", [("캐릭 질문요 [by kim]", when)])[0] == zb40.UNKNOWN_DATE


def test_the_rows_are_pooled_from_every_capture_and_the_old_paths_list_pages(tmp_path, monkeypatch):
    # What fails this: a later capture's row replacing an earlier one's (the
    # count of captures is lost), or the list pages (LZ) left out.
    for phase, name in (("Y", "Sell/432.html"), ("LZ", "Sell/y-page-13.html")):
        (tmp_path / phase / name).parent.mkdir(parents=True)
        (tmp_path / phase / name).write_text(SELL_LIST, encoding="utf-8")
    monkeypatch.setattr(zb40, "INPUT_BASE", tmp_path)
    own = ("아량계정 오늘거래하시는분 13장에드...", datetime(2002, 1, 4, 15, 0, 35))
    assert zb40.pooled_rows()[("Sell", "181")] == [own, own]


# ── 05b-repair-zeroboard40-dates.py ─────────────────────────────────────


def test_the_repair_changes_the_posts_date_line_and_nothing_else():
    # What fails this: a pattern that also takes a comment's `createdAt`
    # (two matches, refused), or rewriting the file from parsed JSON.
    new = repair.redate(POST, datetime(1970, 1, 1))
    old_lines, new_lines = POST.split("\n"), new.split("\n")
    assert len(old_lines) == len(new_lines)
    differ = [(a, b) for a, b in zip(old_lines, new_lines) if a != b]
    assert differ == [('  "createdAt": "2002-06-21T00:00:00",', '  "createdAt": "1970-01-01T00:00:00",')]


def test_the_repair_leaves_a_post_already_so_dated_alone():
    # What fails this: rewriting a file whose date is already the one
    # computed — a second run would report every post again.
    assert repair.redate(POST, datetime(2002, 6, 21)) is None


def test_the_repair_refuses_a_file_without_the_date_line_or_with_two():
    # What fails this: dropping the one-line check (the file then raises
    # IndexError), or one that lets two lines through and rewrites both.
    with pytest.raises(ValueError):
        repair.redate('{"createdAt": "2002-06-21T00:00:00"}\n', datetime(1970, 1, 1))
    two = POST.replace('  "hits": null,', '  "createdAt": "2002-06-21T00:00:00",\n  "hits": null,')
    with pytest.raises(ValueError):
        repair.redate(two, datetime(1970, 1, 1))


@pytest.fixture
def posts(tmp_path, monkeypatch):
    """A posts folder holding FunBoard 62, with no list row for it, so the
    repair dates it unknown."""
    f = tmp_path / "FunBoard" / "62.json"
    f.parent.mkdir()
    f.write_bytes(POST.encode("utf-8"))
    monkeypatch.setattr(repair, "POSTS", tmp_path)
    monkeypatch.setattr(repair, "view_phase", lambda post, stats: "U")
    monkeypatch.setattr(repair.zb40, "pooled_rows", lambda: {})
    return f


def test_a_dry_run_writes_nothing_and_a_second_run_changes_nothing(posts, monkeypatch, capsys):
    # What fails this: writing on a dry run, a run writing more than the
    # changed line, or a second run writing or listing a post the first
    # already dated.
    monkeypatch.setattr(sys, "argv", ["05b", "--dry-run"])
    repair.main()
    assert posts.read_bytes().decode("utf-8") == POST
    assert "FunBoard\t62\t2002-06-21T00:00:00\t1970-01-01T00:00:00\tunknown" in capsys.readouterr().out
    monkeypatch.setattr(sys, "argv", ["05b"])
    repair.main()
    first = posts.read_bytes()
    assert first.decode("utf-8") == POST.replace('"createdAt": "2002-06-21T00:00:00"', '"createdAt": "1970-01-01T00:00:00"')
    capsys.readouterr()
    writes = []
    monkeypatch.setattr(repair, "write_atomic", lambda *a: writes.append(a))
    repair.main()
    assert writes == [] and posts.read_bytes() == first
    assert capsys.readouterr().out == "board\tpostId\told\tnew\tfrom\n"


@pytest.fixture
def captures(tmp_path, monkeypatch):
    """Silver with two old-path captures: a post view (`Z/UOForum/118`) and
    a member list (`U/member/2937`), which 02f reads as no post."""
    for phase, board, no in (("Z", "UOForum", "118"), ("U", "member", "2937")):
        (tmp_path / phase / board).mkdir(parents=True)
        shutil.copyfile(FIXTURES / "zb40" / f"{phase}__{board}__{no}.html", tmp_path / phase / board / f"{no}.html")
    monkeypatch.setattr(repair.zb40, "INPUT_BASE", tmp_path)


def gold(board, no, url):
    return {"board": board, "postId": no, "originalUrl": url, "capturedAt": "20010724061920"}


def phase(post):
    return repair.view_phase(post, Counter())


def test_the_repair_takes_only_posts_02f_made_from_a_view(captures):
    # What fails this: matching the address by its start (a UO_Vote poll
    # names its list page), reading a capture that is not there, or taking
    # a capture 02f reads as no post (02e's 2001 notices and file rooms
    # carry the same addresses).
    assert phase(gold("UOForum", "118", "http://forg.co.kr/zboard/zboard.php?id=UOForum&no=118")) == "Z"
    assert phase(gold("UOForum", "118", "http://forg.co.kr/zboard/zboard.php?id=UOForum&no=118&page=2")) is None
    assert phase(gold("UOForum", "119", "http://forg.co.kr/zboard/zboard.php?id=UOForum&no=119")) is None
    assert phase(gold("member", "2937", "http://forg.uospace.net/zb/zboard.php?id=member&no=2937")) is None


@pytest.mark.parametrize("failure", [KeyError("capturedAt"), ValueError("bad"), "validation"])
def test_a_capture_02f_now_fails_on_is_counted_and_its_post_left_alone(captures, monkeypatch, failure):
    # What fails this: catching less than 02f records as a failure (KeyError,
    # ValidationError, ValueError) — the run stops — or not counting it.
    def fail(*args, **kwargs):
        if failure == "validation":
            Post.model_validate({})  # raises ValidationError
        raise failure

    monkeypatch.setattr(repair.zb40, "parse_view", fail)
    stats = Counter()
    assert repair.view_phase(gold("UOForum", "118", "http://forg.co.kr/zboard/zboard.php?id=UOForum&no=118"), stats) is None
    assert stats == Counter({"unreadable": 1})


SCREENSHOT_66_FORM = ("http://forg.uospace.net:80/zboard/write.php?id=ScreenShot&page=1&category=&sn=off&ss=off"
                      "&sc=off&keyword=&select_arrange=headnum&desc=asc&no=66&mode=reply")


def test_the_repair_takes_02hs_posts_from_a_captured_reply_form(captures, tmp_path):
    # What fails this: not checking the address is a reply form (a 02f view
    # with a stray `R` capture), or not checking the form was captured.
    for board, no in (("ScreenShot", "66"), ("UOForum", "118")):
        (tmp_path / "R" / board).mkdir(parents=True, exist_ok=True)
        (tmp_path / "R" / board / f"{no}.html").write_text("<form></form>", encoding="utf-8")
    assert repair.reply_form_post(gold("ScreenShot", "66", SCREENSHOT_66_FORM))
    assert not repair.reply_form_post(gold("ScreenShot", "67", SCREENSHOT_66_FORM.replace("no=66", "no=67")))
    assert not repair.reply_form_post(gold("UOForum", "118", "http://forg.co.kr/zboard/zboard.php?id=UOForum&no=118"))


def test_the_repair_dates_a_reply_form_post_as_it_does_02fs(posts, monkeypatch, capsys):
    # What fails this: the run skipping a post that is not 02f's view even
    # when 02h made it.
    monkeypatch.setattr(repair, "view_phase", lambda post, stats: None)
    monkeypatch.setattr(repair, "reply_form_post", lambda post: True)
    monkeypatch.setattr(sys, "argv", ["05b", "--dry-run"])
    repair.main()
    assert "FunBoard\t62\t2002-06-21T00:00:00\t1970-01-01T00:00:00\tunknown" in capsys.readouterr().out


# ── 02h-parse-reply-forms.py ────────────────────────────────────────────


def test_a_reply_form_post_is_dated_only_by_a_row_that_is_the_post(tmp_path, monkeypatch, capsys):
    # What fails this: 02h dating by number alone — the first capture's row
    # for 181 is the 2001-06 install's `타롯카드삽니다.` — or counting the
    # post as undated.
    reply = load_stage("02h-parse-reply-forms.py")
    clean = tmp_path / "clean"
    for folder in ("R/Sell", "LZ/Sell"):
        (clean / folder).mkdir(parents=True)
    (clean / "R/Sell/181.html").write_text(
        f'<form><input name="subject" value="[re] {SELL_181}"><textarea name="memo">&gt;안녕하세요</textarea></form>',
        encoding="utf-8",
    )
    other = SELL_LIST.replace("아량계정 오늘거래하시는분 13장에드...", OTHER_181[0]).replace(
        "2002년 01월 04일 15시 00분 35초", "2001년 06월 08일 17시 43분 47초")
    (clean / "LZ/Sell/a-page.html").write_text(other, encoding="utf-8")
    (clean / "LZ/Sell/b-page.html").write_text(SELL_LIST, encoding="utf-8")
    plan = [{"board": "Sell", "post_id": "181", "ts": SELL_181_CAPTURED,
             "url": "http://forg.co.kr/zb/write.php?id=Sell&no=181&mode=reply"}]
    (tmp_path / "plan.json").write_text(json.dumps(plan), encoding="utf-8")
    for name, value in (("INPUT", clean / "R"), ("ALL_CLEAN", clean), ("PLAN", tmp_path / "plan.json"),
                        ("OUTPUT_DIR", tmp_path / "posts"), ("QUARANTINE", tmp_path / "quarantine.tsv")):
        monkeypatch.setattr(reply, name, value)
    monkeypatch.setattr(sys, "argv", ["02h"])
    reply.main()
    post = json.loads((tmp_path / "posts/Sell/181.json").read_text(encoding="utf-8"))
    assert post["createdAt"] == "2002-01-04T15:00:35"
    assert '"dated": 1' in capsys.readouterr().err
