"""02's empty view: Zeroboard's template for a post that no longer existed."""
from datetime import datetime
from pathlib import Path

import pytest
from stages import load_stage

stage = load_stage("02-parse-zeroboard.py")
FIXTURES = Path(__file__).parent / "fixtures" / "zb"
ARGS = {"captured_at": "20030327000000", "parsed_at": datetime(2026, 1, 1)}


def test_a_post_with_content_but_a_1970_date_stays_a_post():
    html = (FIXTURES / "Tbalhae__7.html").read_text(encoding="utf-8")
    real = '<span title="2003년 03월 26일 22시 20분 59초">2003/03/26</span>'
    assert real in html
    html = html.replace(real, '<span title="1970년 01월 01일 09시 00분 00초">1970/01/01</span>')
    post = stage.parse_one(html, board="Tbalhae", post_id="7", **ARGS)
    assert (post.title, post.createdAt.year) == ("발해 지피 구합니다", 1970)


def test_the_empty_template_is_skipped():
    html = (FIXTURES / "ScreenShot__2951.html").read_text(encoding="utf-8")
    with pytest.raises(Exception) as e:
        stage.parse_one(html, board="ScreenShot", post_id="2951", **ARGS)
    assert getattr(e.value, "reason", None) == "empty_view"
