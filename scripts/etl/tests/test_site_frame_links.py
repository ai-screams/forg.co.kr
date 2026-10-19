"""02g's links from a frame page to the museum's boards and posts."""
from bs4 import BeautifulSoup

from stages import load_stage

site = load_stage("02g-parse-site.py")

BASE = "http://forg.co.kr/forg_top.htm"


def targets(links: str) -> list[str | None]:
    soup = BeautifulSoup(f"<html><body>{links}</body></html>", "lxml")
    site.rewrite(soup, site.Resolver({"faq"}, {"Q_A"}), BASE, "20021017104719", "forg_top")
    return [a.get("target") for a in soup.find_all(["a", "area"])]


# Fails if: a board link keeps the frame it named (`detail`) or the frame it
# is in (no target), and the board opens inside the old frameset with the
# museum's header nested in it; or a link that opened a new window (however
# its target was spelled, or a popup), a `/site/` page (which knows when it is
# framed), a picture or another site loses the target it had.
def test_a_board_link_from_a_frame_opens_in_the_whole_window(tmp_path, monkeypatch):
    (tmp_path / "logo.gif").write_bytes(b"GIF89a")
    monkeypatch.setattr(site, "IMG_ROOT", tmp_path)
    assert targets(
        '<a href="/_zb/zboard.php?id=Q_A" target="detail">질문답변</a>'
        '<a href="/_zb/zboard.php?id=Q_A">질문답변</a>'
        '<map><area href="/_zb/zboard.php?id=Q_A" target="detail"></map>'
        '<a href="/_zb/zboard.php?id=Q_A" target="_blank">질문답변</a>'
        '<a href="/_zb/zboard.php?id=Q_A" target=" _BLANK">질문답변</a>'
        '<a href="/_zb/zboard.php?id=Q_A" target="_new">질문답변</a>'
        '<a href="javascript:window.open(\'/_zb/zboard.php?id=Q_A\')">질문답변</a>'
        '<a href="/faq.html" target="detail">FAQ</a>'
        '<a href="/logo.gif" target="detail">그림</a>'
        '<a href="http://www.uo.com/" target="detail">UO</a>'
    ) == ["_top", "_top", "_top", "_blank", " _BLANK", "_new", "_blank", "detail", "detail", "detail"]
