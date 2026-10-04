import os
import time
from datetime import datetime

from bs4 import BeautifulSoup

from post_parse import (
    find_attachments,
    needs_processing,
    parse_korean_datetime,
    plain_text,
    split_category_prefix,
)


class TestCategoryPrefix:
    def test_leading_tag_becomes_the_label(self):
        assert split_category_prefix("  [질문] 길드 가입") == ("질문", "길드 가입")

    def test_tag_without_a_title_stays_the_title(self):
        assert split_category_prefix("[공지]") == (None, "[공지]")

    def test_long_bracketed_text_is_not_a_tag(self):
        title = "[Ultima Online Renaissance] 소식"
        assert split_category_prefix(title) == (None, title)


class TestKoreanDatetime:
    def test_second_precision_text(self):
        assert parse_korean_datetime("2003년 09월 02일 08시 09분 26초") == datetime(2003, 9, 2, 8, 9, 26)

    def test_visible_date_when_no_time(self):
        assert parse_korean_datetime("2003/9/2") == datetime(2003, 9, 2)

    def test_nothing_to_read(self):
        assert parse_korean_datetime("작성일 없음") is None


def attachments(html: str) -> list[dict[str, object]]:
    return find_attachments(BeautifulSoup(html, "lxml"))


class TestAttachments:
    def test_name_number_and_size(self):
        html = '<a href="download.php?id=Q_A&no=1&filenum=1">map.zip (1.5 KB)</a>'
        assert attachments(html) == [{"name": "map.zip", "fileNum": 1, "sizeBytes": 1536}]

    def test_one_entry_per_file_number(self):
        html = (
            '<a href="download.php?id=Q_A&no=1&filenum=1">a.zip</a>'
            '<a href="download.php?id=Q_A&no=1&filenum=1">a.zip</a>'
            '<a href="download.php?id=Q_A&no=1">no number</a>'
        )
        assert attachments(html) == [{"name": "a.zip", "fileNum": 1, "sizeBytes": None}]


def test_plain_text_joins_words_with_single_spaces():
    assert plain_text("<p>울티마</p><p> 온라인 </p>") == "울티마 온라인"


class TestNeedsProcessing:
    def test_force_missing_empty_or_older_output(self, tmp_path):
        src, out = tmp_path / "in.html", tmp_path / "out.json"
        src.write_text("x")
        assert needs_processing(src, out, force=False)  # missing
        out.write_text("")
        assert needs_processing(src, out, force=False)  # empty
        out.write_text("{}")
        old = time.time() - 100
        os.utime(out, (old, old))
        assert needs_processing(src, out, force=False)  # silver newer
        os.utime(out, None)
        os.utime(src, (old, old))
        assert not needs_processing(src, out, force=False)
        assert needs_processing(src, out, force=True)
