"""02g's parchment fill: black text on a black page whose cell pictures are missing."""
import pytest
from bs4 import BeautifulSoup

from stages import load_stage

site = load_stage("02g-parse-site.py")

BASE = "http://forg.co.kr/dungeon/Dragon.html"


@pytest.fixture(autouse=True)
def pictures(tmp_path, monkeypatch):
    """The recovered pictures: only `dungeon/image/kept.gif`."""
    (tmp_path / "dungeon" / "image").mkdir(parents=True)
    (tmp_path / "dungeon" / "image" / "kept.gif").write_bytes(b"GIF89a")
    monkeypatch.setattr(site, "IMG_ROOT", tmp_path)


def render(body_attrs: str, cells: str) -> dict:
    soup = BeautifulSoup(f"<html><body {body_attrs}><table><tr>{cells}</tr></table></body></html>", "lxml")
    return render_soup(soup)


def render_soup(soup: BeautifulSoup) -> dict:
    return site.render_page(soup, site.Resolver(set(), set()), BASE, "20071119195435",
                            "dungeon/Dragon", {}, {})


BOOK = ('<td background="image/monster_book.gif">서식지</td>'
        '<td background="image/str_2.gif" bgcolor="#333333">x</td>'
        '<td background="image/kept.gif">y</td>')


# Fails if: a missing cell picture on a black page stays black, the page does
# not say the museum filled it, a cell's own colour is painted over, or a cell
# whose picture was kept is painted too.
def test_a_black_page_gets_parchment_where_a_cell_picture_is_missing():
    out = render('bgcolor="black" text="black"', BOOK)
    assert out["html"].count(f'bgcolor="{site.PARCHMENT}"') == 1
    assert 'bgcolor="#333333"' in out["html"]
    assert 'background="/img/posts/site/dungeon/image/kept.gif">y' in out["html"]
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


# Fails if: a tag whose `bgcolor` nh3 drops (a `div`) counts as filled.
def test_only_a_colour_the_page_keeps_counts():
    soup = BeautifulSoup('<html><body bgcolor="black" text="black"><div background="image/x.gif">글</div>'
                         "</body></html>", "lxml")
    out = render_soup(soup)
    assert "museumFill" not in out
    assert site.PARCHMENT not in out["html"]


# Fails if: a capture with no body (a title alone) stops the run.
def test_a_page_without_a_body_renders():
    out = render_soup(BeautifulSoup("<html><head><title>Hello world</title></head></html>", "lxml"))
    assert "museumFill" not in out
