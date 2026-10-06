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


# A row above the last gold post has one neighbour, below it.
# Fails if: a neighbour year that puts the row before its lower neighbour is
# kept (Newbie 2281 as 2003-02-05 below 638 of 2003-10-26), or one that fits
# is not.
def test_a_neighbour_year_the_numbering_rules_out_gives_way_to_the_page():
    # Fits: 2005-12-20 is after post 300's 2005-01-01.
    assert pin_year(350, 12, 20, 2004, CAPTURED, GOLD, NOS) == (date(2005, 12, 20), False)
    # Ruled out: 2005-02-05 would be before the neighbour's 2005-10-26.
    assert pin_year(400, 2, 5, 2006, date(2006, 3, 1), {300: date(2005, 10, 26)}, [300]) == (
        date(2006, 2, 5),
        True,
    )


# Fails if: a row between two agreeing neighbours is moved off their year
# when it fits between them, or still marked exact when it falls outside
# them. No year can put 12/01 between 2003-04-01 and 2003-09-01, so the date
# stays and only the mark says it is a guess.
def test_agreeing_neighbours_hold_only_where_the_row_fits_between_them():
    assert pin_year(150, 6, 1, 2004, CAPTURED, GOLD, NOS) == (date(2003, 6, 1), False)
    assert pin_year(150, 12, 1, 2004, CAPTURED, GOLD, NOS) == (date(2003, 12, 1), True)


# Fails if: a neighbour year that has no such day (Feb 29) raises.
def test_a_neighbour_year_without_the_day_gives_no_date():
    assert pin_year(150, 2, 29, 2004, CAPTURED, GOLD, NOS) == (None, False)
