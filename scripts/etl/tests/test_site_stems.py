"""02g's stems: the museum path each forg page and picture gets."""
import urllib.parse

import pytest

from stages import load_stage

site = load_stage("02g-parse-site.py")


# Fails if: a space stays in the stem, so the monster and dungeon guides named
# with one (`Fire%20Dungeon.html`) are dropped as unsafe and every link to
# them goes to Wayback.
def test_a_space_in_a_page_name_becomes_an_underscore():
    assert site.stem_of("/dungeon/Fire%20Dungeon.html") == "dungeon/Fire_Dungeon"
    assert site.safe_stem(site.stem_of("/dungeon/I_Anciect%20Lair%20II.html"))
    resolver = site.Resolver({"dungeon/Fire_Dungeon"}, set())
    href, _ = resolver.link("Fire%20Dungeon.html", "http://forg.co.kr/dungeon/monster.html",
                            "20030902151242", "dungeon/monster")
    assert href == "/site/dungeon/Fire_Dungeon/"


# Fails if: a picture whose name has a space is dropped as unsafe (it never
# reaches the download queue), or its URL loses the page's spelling. Both
# spellings the pages use: `skill/news` writes the space, `house_add` `%20`.
@pytest.mark.parametrize("src, page, path", [
    ("images/news/weapon/magic staff_1.jpg", "http://forg.co.kr/skill/news.html",
     "skill/images/news/weapon/magic_staff_1.jpg"),
    ("../My%20Home/image/tip/17.gif", "http://forg.co.kr/house_add.htm", "My_Home/image/tip/17.gif"),
])
def test_a_space_in_a_picture_name_becomes_an_underscore(src, page, path):
    resolver = site.Resolver(set(), set())
    resolver.image(src, page, "20030913035859", "skill/news")
    assert resolver.image_refs == {path: {
        "path": path, "url": urllib.parse.urljoin(page, src), "ts": "20030913035859", "page": "skill/news"}}


# Fails if: two pictures whose names differ only by a space and a `_` are
# quietly given one file (a page would show the other one's picture).
def test_two_names_that_become_one_stop_the_run():
    resolver = site.Resolver(set(), set())
    resolver.image("a b.gif", "http://forg.co.kr/x/p.html", "20030913035859", "x/p")
    resolver.image("a%20b.gif", "http://forg.co.kr/x/p.html", "20030913035859", "x/p")
    with pytest.raises(ValueError, match="x/a_b.gif"):
        resolver.image("a_b.gif", "http://forg.co.kr/x/p.html", "20030913035859", "x/p")
