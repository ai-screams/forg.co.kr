"""02g's stems: the museum path each forg page gets."""
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
# reaches the download queue), or its download URL loses the space.
def test_a_space_in_a_picture_name_becomes_an_underscore():
    resolver = site.Resolver(set(), set())
    resolver.image("images/news/weapon/magic%20staff_1.jpg", "http://forg.co.kr/skill/news.html",
                   "20030913035859", "skill/news")
    assert resolver.image_refs == {"skill/images/news/weapon/magic_staff_1.jpg": {
        "path": "skill/images/news/weapon/magic_staff_1.jpg",
        "url": "http://forg.co.kr/skill/images/news/weapon/magic%20staff_1.jpg",
        "ts": "20030913035859", "page": "skill/news"}}
