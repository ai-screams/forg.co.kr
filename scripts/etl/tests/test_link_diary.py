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
    # Some L2 captures print a bare `*` and no date in the post's place;
    # being newer must not let it win (fails if dates are not compared first).
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
