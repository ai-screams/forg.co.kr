"""02c's year for a list row that printed only MM/DD (`pin_year`)."""
from datetime import date

from stages import load_stage

pin_year = load_stage("02c-parse-listing.py").pin_year

GOLD = {100: date(2003, 4, 1), 200: date(2003, 9, 1), 300: date(2005, 1, 1)}
NOS = sorted(GOLD)
CAPTURED = date(2006, 1, 1)


def test_a_post_the_museum_holds_keeps_its_own_date():
    assert pin_year(200, 5, 5, 2004, CAPTURED, GOLD, NOS) == (date(2003, 9, 1), False)


def test_neighbours_that_agree_give_the_year():
    assert pin_year(150, 6, 1, 2004, CAPTURED, GOLD, NOS) == (date(2003, 6, 1), False)


def test_neighbours_that_disagree_bound_the_page_year():
    # 200 is 2003, 300 is 2005: the page's 2009 is bounded to 2005.
    assert pin_year(250, 6, 1, 2009, CAPTURED, GOLD, NOS) == (date(2005, 6, 1), True)


def test_a_row_never_postdates_its_capture():
    captured = date(2003, 5, 1)
    assert pin_year(150, 6, 1, 2002, captured, GOLD, NOS) == (date(2002, 6, 1), True)


def test_an_impossible_day_gives_no_date():
    assert pin_year(250, 2, 29, 2003, CAPTURED, GOLD, NOS) == (None, True)
