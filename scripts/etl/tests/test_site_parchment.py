"""02g's parchment fill: black text on a black page whose cell pictures are missing."""
import pytest
from bs4 import BeautifulSoup

from stages import load_stage

site = load_stage("02g-parse-site.py")

BASE = "http://forg.co.kr/dungeon/Dragon.html"


def render(body_attrs: str, cells: str) -> dict:
    soup = BeautifulSoup(f"<html><body {body_attrs}><table><tr>{cells}</tr></table></body></html>", "lxml")
    return site.render_page(soup, site.Resolver(set(), set()), BASE, "20071119195435",
                            "dungeon/Dragon", {}, {})


BOOK = '<td background="image/monster_book.gif">서식지</td><td background="image/str_2.gif" bgcolor="#333333">x</td>'


# Fails if: a missing cell picture on a black page stays black, the page does
# not say the museum filled it, or a cell's own colour is painted over.
def test_a_black_page_gets_parchment_where_a_cell_picture_is_missing():
    out = render('bgcolor="black" text="black"', BOOK)
    assert out["html"].count(f'bgcolor="{site.PARCHMENT}"') == 1
    assert 'bgcolor="#333333"' in out["html"]
    assert out["museumFill"] is True


# Fails if: a page that reads without its pictures (light text, or a light
# page) is painted too.
@pytest.mark.parametrize("body", ['bgcolor="black" text="white"', 'bgcolor="white" text="black"'])
def test_a_readable_page_keeps_its_cells(body):
    out = render(body, BOOK)
    assert site.PARCHMENT not in out["html"]
    assert "museumFill" not in out


# Fails if: the body's own missing picture counts as a filled cell: the body
# keeps its black, so the bar would announce a fill nothing shows.
def test_the_body_picture_alone_fills_nothing():
    out = render('bgcolor="black" text="black" background="image/back.gif"', "<td>x</td>")
    assert "museumFill" not in out
