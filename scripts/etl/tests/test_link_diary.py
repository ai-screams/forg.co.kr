"""Stage 2e: which capture of a link/diary post becomes the gold post."""

from __future__ import annotations

from datetime import datetime

from stages import load_stage

better = load_stage("02e-parse-link-diary.py").better


def entry(captured_at: str, created: datetime | None, title: str = "STRATICS") -> dict:
    return {"capturedAt": captured_at, "created": created, "title": title}


DATED = datetime(2001, 3, 4)


def test_first_capture_is_taken() -> None:
    assert better(None, entry("20020424083439", DATED))


def test_a_newer_capture_replaces_an_older_one() -> None:
    # A title edited later (Mirc → Mirc58t) shows in the newer capture.
    assert better(entry("20020424083439", DATED, "Mirc"), entry("20031003110240", DATED, "Mirc58t"))
    assert not better(entry("20031003110240", DATED, "Mirc58t"), entry("20020424083439", DATED, "Mirc"))


def test_a_capture_without_the_date_never_replaces_one_with_it() -> None:
    # A capture that prints no date for the post (Recall's 2006 captures, read
    # as `*` before they went to `Recall2006`) must not win by being newer
    # (fails if dates are not compared first).
    assert not better(entry("20020424083439", DATED), entry("20031003110240", None, "*"))


def test_a_dated_capture_replaces_an_undated_one_even_if_older() -> None:
    assert better(entry("20031003110240", None, "*"), entry("20020424083439", DATED))


def test_the_2001_book_skin_reads_title_category_link_and_body() -> None:
    # Fails if the grey `[category]` is taken as the title, or the site
    # cell (home.gif + link) as the body.
    from pathlib import Path

    from bs4 import BeautifulSoup

    stage = load_stage("02e-parse-link-diary.py")
    html = (Path(__file__).parent / "fixtures" / "link" / "lz-book-entry.html").read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "lxml")
    (header,) = stage._entries(soup)
    e = stage.parse_link_entry(header, "20010418100133")
    assert (e["no"], e["title"], e["category"]) == ("3", "InsideUO", "울온자료사이트")
    assert e["created"] == datetime(2001, 3, 4, 16, 7, 8)
    assert e["body"].startswith('<p><a href="http://alazane.surf-va.com/insideuo.html">')
    assert "울온 그래픽이미지를 추출하는 프로그램입니다" in e["body"]
    assert "home.gif" not in e["body"]
    assert e["hits"] == 1


def test_a_post_links_to_the_install_its_page_came_from() -> None:
    # Fails if every post is given the 4.1 install's /_zb/ view URL.
    origin_of = load_stage("02e-parse-link-diary.py").origin_of
    assert origin_of("L2", "page-1~20020424083439") == "http://forg.co.kr/_zb/zboard.php"
    assert origin_of("LZ", "z-page-1-c2") == "http://forg.co.kr/zboard/zboard.php"
    assert origin_of("LZ", "y-page-1-c1") == "http://forg.co.kr/zb/zboard.php"


# The 2001 notice skin (zzun_notice, UO_Notice): header, then the whole post
# in the next white cell; the next entry follows.
NOTICE = """<table><tr><td><!--<input onfocus=blur() type=checkbox name=cart value="31">--><img src="skin/zzun_notice/zzun.gif"> <b>HOLY 길드원 모집</b> [<span title="2001년 06월 01일 12시 41분 46초">2001/06/01</span>]</td></tr></table>
<table><tr><td bgcolor="white"> :::자격요건::: <br> 1.만21세이상</td></tr></table>
<table><tr><td><!--<input onfocus=blur() type=checkbox name=cart value="30">--><b>본문 잃은 공지</b> [<span title="2001년 05월 30일 10시 00분 00초">2001/05/30</span>]</td></tr></table>
<table><tr><td><!--<input onfocus=blur() type=checkbox name=cart value="28">--><b>간만에 공지</b> [<span title="2001년 05월 27일 20시 46분 47초">2001/05/27</span>]</td></tr></table>
<table><tr><td bgcolor="white">다음 글 본문</td></tr></table>"""


def test_the_notice_skin_reads_each_post_up_to_its_own_body() -> None:
    # Fails if the body is looked for in a `word-break` cell (the link skins'),
    # which this skin has none of, or an entry that lost its body (30) takes
    # the next one's.
    from bs4 import BeautifulSoup

    stage = load_stage("02e-parse-link-diary.py")
    first, lost, second = (stage.parse_notice_entry(h, "x") for h in stage._entries(BeautifulSoup(NOTICE, "lxml")))
    assert (first["no"], first["title"], first["author"], first["created"]) == (
        "31", "HOLY 길드원 모집", "anonymous", datetime(2001, 6, 1, 12, 41, 46),
    )
    assert "1.만21세이상" in first["body"] and "다음 글" not in first["body"]
    assert (lost["no"], lost["body"]) == ("30", "")
    assert second["body"] == "다음 글 본문"


# The 2001 file room (zetyx_pds_Esee, UOPds): a live cart box, `[category]`
# and title in two `<b>`s, the file row, the description with the file's
# picture beside it, the uploader. The first entry here lost its file row,
# which holds the date.
PDS = """<table><tr><td style="word-break:break-all;"><img src="skin/zetyx_pds_Esee/name_head.gif"><input name="cart" type="checkbox" value="10"> <b><font color="#9f9f9f">[UO자료실]</font></b><b>Coin_Mania</b></td><td>Download : 678</td></tr></table>
<table><tr><td style="word-break:break-all;" valign="top" width="99%">벤더가방을 꾸밀때 좋은 프로그램</td><td valign="top"><a href="download.php?id=UOPds&no=10&filenum=1"><img src="data/A.gif"></a></td></tr></table>
<table><tr><td class="thm8">Uploader : <b><b> <a href="mailto:x@y">Forg</a> </b></b></td></tr></table>
<table><tr><td style="word-break:break-all;"><img src="skin/zetyx_pds_Esee/name_head.gif"><input name="cart" type="checkbox" value="9"> <b><font color="#9f9f9f">[UO자료실]</font></b><b>UO Loop!!</b></td><td>Download : 2114</td></tr></table>
<table><tr><td style="word-break:break-all;"><img src="skin/zetyx_pds_Esee/zip.gif"> <font><a href="download.php?id=UOPds&no=9&filenum=1">uoloop.exe</a> ( Size : 104.0 KB )</font></td><td>Date : <span title="2001년 03월 06일 00시 47분 12초">2001/03/06</span></td></tr></table>
<table><tr><td style="word-break:break-all;" valign="top" width="99%">반복작업 프로그램</td><td valign="top"><img src="data/aa0010.gif"></td></tr></table>
<table><tr><td class="thm8">Uploader : <b><a href="mailto:x@y">Forg</a></b></td></tr></table>"""


def test_the_pds_skin_reads_file_description_picture_and_uploader() -> None:
    # Fails if live cart boxes are not entries, the uploader cell is not read,
    # the picture is dropped, or an entry without its file row takes the next
    # entry's file, date or description.
    from bs4 import BeautifulSoup

    stage = load_stage("02e-parse-link-diary.py")
    first, second = (stage.parse_pds_entry(h, "x") for h in stage._entries(BeautifulSoup(PDS, "lxml")))
    assert (second["no"], second["category"], second["title"], second["author"], second["member_no"]) == (
        "9", "UO자료실", "UO Loop!!", "Forg", "1",
    )
    assert second["attachments"] == [{"name": "uoloop.exe", "fileNum": 1, "sizeBytes": 106496}]
    assert second["created"] == datetime(2001, 3, 6, 0, 47, 12)
    assert "반복작업 프로그램" in second["body"] and '<img src="data/aa0010.gif">' in second["body"]
    assert (first["no"], first["author"], first["attachments"], first["created"]) == ("10", "Forg", [], None)
    assert "벤더가방을" in first["body"] and "반복작업" not in first["body"]


def test_a_pds_entry_without_its_uploader_line_does_not_take_the_next_ones() -> None:
    # Fails if the uploader is looked for past the next entry's cart box.
    from bs4 import BeautifulSoup

    stage = load_stage("02e-parse-link-diary.py")
    first_uploader = '<table><tr><td class="thm8">Uploader : <b><b> <a href="mailto:x@y">Forg</a> </b></b></td></tr></table>\n'
    page = PDS.replace(first_uploader, "").replace(">Forg</a></b></td>", ">kim</a></b></td>")
    first, second = (stage.parse_pds_entry(h, "x") for h in stage._entries(BeautifulSoup(page, "lxml")))
    assert (first["author"], first["member_no"]) == ("anonymous", None)
    assert second["author"] == "kim"


# The 2006 file library (ruvin_cubic_pds, Recall): a bullet `*` heads the entry.
STAR = """<table><tr><td align="left" style="word-break:break-all;"><!--<input type=checkbox name=cart value="8">--> <span class="cu"><span class="notice"><b>* </b></span>[Ultima Online] 한글폰트 변환 파일입니다.</span></td>
<td><a href="download.php?id=Recall&category=1&no=8&filenum=1">unifont.zip</a> [ Size : 543.2 KB ]</td></tr>
<tr><td align="left" style="word-break:break-all;" valign="top">기존 파일은 백업 해 두시고</td>
<td align="right" valign="top"><a href="download.php?id=Recall&no=8&filenum=1"><img src="data/Recall/unifont.gif"></a></td></tr></table>"""


def test_the_bullet_skin_title_and_category_follow_the_star() -> None:
    # Fails if the bullet is taken as the title, the category number from the
    # URL is used for a skin that prints the category's name, or the picture
    # beside the description is dropped.
    from bs4 import BeautifulSoup

    stage = load_stage("02e-parse-link-diary.py")
    (header,) = stage._entries(BeautifulSoup(STAR, "lxml"))
    e = stage.parse_link_entry(header, "20060822022749")
    assert (e["title"], e["category"], e["created"]) == ("한글폰트 변환 파일입니다.", "Ultima Online", None)
    assert "기존 파일은 백업" in e["body"]
    assert e["body"].endswith('<p><img src="data/Recall/unifont.gif"></p>')


def test_a_post_no_capture_dates_is_kept_as_undated(tmp_path, monkeypatch) -> None:
    # Fails if an undated post is skipped (as before 2026-10-07) instead of
    # written with the 1970 sentinel the site shows as 작성일 미상, or if a
    # 2006 capture's post goes to Recall, whose numbers it reuses (REBORN).
    import json
    import sys

    stage = load_stage("02e-parse-link-diary.py")
    clean, out = tmp_path / "clean", tmp_path / "posts"
    (clean / "L2" / "Recall").mkdir(parents=True)
    (clean / "L2" / "Recall" / "page-1~20060822022749.html").write_text(STAR, encoding="utf-8")
    plan = tmp_path / "plan.json"
    plan.write_text(json.dumps([{"board": "Recall", "post_id": "page-1~20060822022749", "ts": "20060822022749",
                                 "url": "http://forg.co.kr/_zb/zboard.php?id=Recall&page=1&category=1"}]), encoding="utf-8")
    monkeypatch.setattr(stage, "CLEAN_DIR", clean)
    monkeypatch.setattr(stage, "OUTPUT_DIR", out)
    monkeypatch.setattr(stage, "PHASE_PLANS", {"L2": plan})
    monkeypatch.setattr(sys, "argv", ["02e", "--board", "Recall"])
    assert stage.main() == 0
    post = json.loads((out / "Recall2006" / "8.json").read_text(encoding="utf-8"))
    assert (post["title"], post["createdAt"][:4], post["categoryLabel"]) == ("한글폰트 변환 파일입니다.", "1970", "Ultima Online")
    assert post["originalUrl"] == "http://forg.co.kr/_zb/zboard.php?id=Recall&no=8"
    assert not (out / "Recall").exists()


def test_a_notice_page_runs_through_the_notice_reader(tmp_path, monkeypatch) -> None:
    # Fails if UO_Notice is not registered, or its pages are read by another
    # skin's reader (the diary reader would find no body in this skin).
    import json
    import sys

    stage = load_stage("02e-parse-link-diary.py")
    clean, out = tmp_path / "clean", tmp_path / "posts"
    (clean / "LZ" / "UO_Notice").mkdir(parents=True)
    (clean / "LZ" / "UO_Notice" / "z-page-2.html").write_text(NOTICE, encoding="utf-8")
    plan = tmp_path / "plan.json"
    plan.write_text(json.dumps([{"board": "UO_Notice", "post_id": "z-page-2", "ts": "20010617000000",
                                 "url": "http://forg.co.kr/zboard/zboard.php?id=UO_Notice&page=2"}]), encoding="utf-8")
    monkeypatch.setattr(stage, "CLEAN_DIR", clean)
    monkeypatch.setattr(stage, "OUTPUT_DIR", out)
    monkeypatch.setattr(stage, "PHASE_PLANS", {"LZ": plan})
    monkeypatch.setattr(sys, "argv", ["02e", "--board", "UO_Notice"])
    assert stage.main() == 0
    post = json.loads((out / "UO_Notice" / "31.json").read_text(encoding="utf-8"))
    assert (post["title"], post["author"], post["createdAt"]) == ("HOLY 길드원 모집", "anonymous", "2001-06-01T12:41:46")
    assert "1.만21세이상" in post["bodyText"]
    assert post["originalUrl"] == "http://forg.co.kr/zboard/zboard.php?id=UO_Notice&no=31"


# The 2001 notice list's Best_UO box: the newest screenshot, its text as the alt.
BOX_PAGE = """<table><tr><td><!-- zzun_screenshot 2000220 contact:http://zzun.slzzuk.net -->
<center><img alt="오크로드를 잡다보면 
많이들 구하세요" border="0" src="data/orc.gif"><br>Created By Iris</center></td></tr></table>"""
TODAY_ROW = """<tr><td><a href="view.php?id=Today&amp;page=1&amp;no={no}">Created By Iris</a></td>
<td><b><a href="javascript:void(window.open('view_info.php?id=Today&amp;member_no=1'))">Forg</a></b></td>
<td><span title="{when}">-</span></td><td>10</td></tr>"""
TODAY_LIST = "<table>" + "".join(TODAY_ROW.format(no=n, when=w) for n, w in (
    ("12", "2001년 07월 01일 09시 00분 00초"),  # written after the capture
    ("9", "2001년 06월 01일 12시 18분 45초"),
    ("3", "2001년 03월 01일 10시 00분 00초"),  # an older post of the same title
)) + "</table>"


def test_the_best_uo_box_is_the_newest_post_of_its_title_before_the_capture(tmp_path, monkeypatch) -> None:
    # Fails if the box is matched to a post written after the capture (12) or
    # to an older one of the same title (3), or its picture or text is dropped.
    stage = load_stage("02e-parse-link-diary.py")
    (tmp_path / "LZ" / "Today").mkdir(parents=True)
    (tmp_path / "LZ" / "UO_Notice").mkdir(parents=True)
    (tmp_path / "LZ" / "Today" / "z-page-1.html").write_text(TODAY_LIST, encoding="utf-8")
    (tmp_path / "LZ" / "UO_Notice" / "z-page-1.html").write_text(BOX_PAGE, encoding="utf-8")
    monkeypatch.setattr(stage, "CLEAN_DIR", tmp_path)
    posts = stage.box_posts({("LZ", "UO_Notice", "z-page-1"): "20010612000000"})
    assert list(posts) == ["9"]
    e = posts["9"]
    assert (e["title"], e["author"], e["member_no"], e["created"]) == (
        "Created By Iris", "Forg", "1", datetime(2001, 6, 1, 12, 18, 45),
    )
    assert e["body"] == '<p><img src="data/orc.gif"></p>\n<p>오크로드를 잡다보면<br>많이들 구하세요</p>'
    assert e["url"] == "http://forg.co.kr/zboard/zboard.php?id=Today&no=9"


# A 2001-numbered Recall page: the sidebar names category 1, the entry links it.
LINK_2001 = """<a href="zboard.php?category=1&amp;id=Recall&amp;page=1">울온정보사이트 (5)</a>
<table><tr><td valign="top"><img src="skin/link/name_head.gif"><!--<input type=checkbox name=cart value="2">--><b>STRATICS</b></td>
<td>Date : <span title="2001년 03월 04일 16시 00분 24초">2001/03/04</span></td></tr>
<tr><td colspan="2"><table><tr><td valign="top" width="90%"><b><a href="skin/link/hit_plus.php?sitelink=http://uo.stratics.com&amp;id=Recall&amp;category=1&amp;no=2">STRATICS</a></b></td>
<td>Hit : 5385 </td></tr></table></td></tr></table>"""


def test_a_reborn_boards_category_names_stay_its_own(tmp_path, monkeypatch) -> None:
    # Fails if both generations share one category map: the 2006 page, read
    # last, links category 1 as "unifont.zip" and would rename the 2001 post's.
    import json
    import sys

    stage = load_stage("02e-parse-link-diary.py")
    clean, out = tmp_path / "clean", tmp_path / "posts"
    (clean / "L2" / "Recall").mkdir(parents=True)
    pages = {"page-1~20030411134543": LINK_2001, "page-1~20060822022749": STAR}
    for stem, page in pages.items():
        (clean / "L2" / "Recall" / f"{stem}.html").write_text(page, encoding="utf-8")
    plan = tmp_path / "plan.json"
    plan.write_text(json.dumps([{"board": "Recall", "post_id": stem, "ts": stem.split("~")[1],
                                 "url": "http://forg.co.kr/_zb/zboard.php?id=Recall&page=1"} for stem in pages]), encoding="utf-8")
    monkeypatch.setattr(stage, "CLEAN_DIR", clean)
    monkeypatch.setattr(stage, "OUTPUT_DIR", out)
    monkeypatch.setattr(stage, "PHASE_PLANS", {"L2": plan})
    monkeypatch.setattr(sys, "argv", ["02e", "--board", "Recall"])
    assert stage.main() == 0
    post = json.loads((out / "Recall" / "2.json").read_text(encoding="utf-8"))
    assert (post["title"], post["categoryLabel"]) == ("STRATICS", "울온정보사이트")
    assert (out / "Recall2006" / "8.json").exists()


def test_the_best_uo_box_reads_the_capture_time_as_korean_time(tmp_path, monkeypatch) -> None:
    # Fails if the capture's UTC time is compared with the list's Korean time:
    # post 13, written at 05:00 KST, precedes a capture at 00:00 UTC (09:00 KST).
    stage = load_stage("02e-parse-link-diary.py")
    rows = TODAY_LIST.replace("</table>", TODAY_ROW.format(no="13", when="2001년 06월 12일 05시 00분 00초") + "</table>")
    (tmp_path / "LZ" / "Today").mkdir(parents=True)
    (tmp_path / "LZ" / "UO_Notice").mkdir(parents=True)
    (tmp_path / "LZ" / "Today" / "z-page-1.html").write_text(rows, encoding="utf-8")
    (tmp_path / "LZ" / "UO_Notice" / "z-page-1.html").write_text(BOX_PAGE, encoding="utf-8")
    monkeypatch.setattr(stage, "CLEAN_DIR", tmp_path)
    assert list(stage.box_posts({("LZ", "UO_Notice", "z-page-1"): "20010612000000"})) == ["13"]


def test_a_run_with_an_entry_it_could_not_read_exits_1(tmp_path, monkeypatch) -> None:
    # Fails if errors are only counted: `02e && 03-build-index` must stop.
    import json
    import sys

    stage = load_stage("02e-parse-link-diary.py")
    clean, out = tmp_path / "clean", tmp_path / "posts"
    (clean / "LZ" / "UO_Notice").mkdir(parents=True)
    (clean / "LZ" / "UO_Notice" / "z-page-2.html").write_text(NOTICE, encoding="utf-8")
    plan = tmp_path / "plan.json"
    plan.write_text(json.dumps([{"board": "UO_Notice", "post_id": "z-page-2", "ts": "20010617000000",
                                 "url": "http://forg.co.kr/zboard/zboard.php?id=UO_Notice&page=2"}]), encoding="utf-8")

    def unreadable(header_td, captured_at):
        raise ValueError("unreadable entry")

    monkeypatch.setattr(stage, "CLEAN_DIR", clean)
    monkeypatch.setattr(stage, "OUTPUT_DIR", out)
    monkeypatch.setattr(stage, "PHASE_PLANS", {"LZ": plan})
    monkeypatch.setitem(stage.PARSERS, "notice", unreadable)
    monkeypatch.setattr(sys, "argv", ["02e", "--board", "UO_Notice"])
    assert stage.main() == 1

