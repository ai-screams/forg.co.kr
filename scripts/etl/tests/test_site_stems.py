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
