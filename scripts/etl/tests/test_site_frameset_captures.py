"""02g's older framesets: each frame on its page's capture of that date."""
from bs4 import BeautifulSoup

from stages import load_stage

site = load_stage("02g-parse-site.py")


def _clock():
    clock = site.CaptureClock()
    clock.add("forg_t", "20020212000000", "/site/forg_t/")  # shown, the latest
    clock.add("forg_t", "20010330081603", "/site/forg_t/20010330081603/")
    clock.add("forg_t", "20010613145322", "/site/forg_t/20010803100551/")
    return clock


# Fails if: the clock picks the latest, the earliest, or one not yet started.
def test_a_frame_opens_on_the_capture_current_at_the_date():
    clock = _clock()
    assert clock.at("/site/forg_t/", "20010927083644") == "/site/forg_t/20010803100551/"
    assert clock.at("/site/forg_t/", "20010405062157") == "/site/forg_t/20010330081603/"
    assert clock.at("/site/forg_t/", "20030101000000") == "/site/forg_t/"
    # Before its first capture: the first.
    assert clock.at("/site/forg_t/", "20001110095100") == "/site/forg_t/20010330081603/"


# Fails if: a path the clock knows nothing of is changed.
def test_other_paths_pass_through():
    clock = _clock()
    assert clock.at("/site/left/", "20010927083644") == "/site/left/"
    assert clock.at("/Notice/", "20010927083644") == "/Notice/"
    assert clock.at(None, "20010927083644") is None


class _Resolver:
    """Stands in for 02g's: forg_t is a museum page, the rest are not."""

    def link(self, src, base, ts, page):
        if src.startswith("forg_t"):
            return "/site/forg_t/", False
        if "zboard" in src:
            return "/Notice/", False
        return f"https://web.archive.org/web/{ts}/http://forg.co.kr/{src}", False


FRAMESET = """<frameset cols="1*, 790, 1*"><frame src="left side.htm"><frameset rows="56, 1*">
<frame name="forg_t" src="forg_t.htm"><frame name="forg_b" src="zboard/zboard.php?id=Notice">
</frameset><frame src="right.htm"></frameset>"""


# Fails if: an older frameset's frames ignore the clock, a board list or
# uncaptured page opens anywhere but Wayback's framed capture of that date,
# or a space in a frame's address leaves the frame blank.
def test_an_older_frameset_opens_its_frames_at_its_date():
    soup = BeautifulSoup(FRAMESET, "lxml")
    out = site.frameset_html(soup, _Resolver(), "http://forg.co.kr/", "20010927083644", "index", _clock())
    srcs = [s.split('"')[0] for s in out.split('src="')[1:]]
    assert srcs == [
        "https://web.archive.org/web/20010927083644if_/http://forg.co.kr/left%20side.htm",
        "/site/forg_t/20010803100551/",
        "https://web.archive.org/web/20010927083644if_/http://forg.co.kr/zboard/zboard.php?id=Notice",
        "https://web.archive.org/web/20010927083644if_/http://forg.co.kr/right.htm",
    ]


# Fails if: the latest framesets (no clock) change.
def test_a_shown_frameset_keeps_its_links():
    soup = BeautifulSoup(FRAMESET, "lxml")
    out = site.frameset_html(soup, _Resolver(), "http://forg.co.kr/", "20010927083644", "index")
    assert 'src="/site/forg_t/"' in out
    assert 'src="/Notice/"' in out
    assert "if_/" not in out
