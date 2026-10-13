#!/usr/bin/env python3
"""ETL Stage 2e — Zeroboard skins whose list pages carry whole posts.

Some forg boards ran skins that print every post in full on the list page
instead of a row per post: `Recall` (skin/link — a UO link directory:
title, URL, date, hits, description), the BOD trade boards `bod_b_s`,
`bod_b_t`, `bod_s_s`, `bod_s_t` (skin/zetyx_diary_Esee), and two boards of
the 2001 Zeroboard 4.0 install: `UO_Notice` (skin/zzun_notice — the
notices the front page opened on) and `UOPds` (skin/zetyx_pds_Esee — the
file room). No view page of theirs was ever captured, so the list page is
the post. Reads every list capture of the board in
`.docs/research/archive-clean/`: `L/{board}/page-N.html` (one per page),
`L2/{board}/page-N~TS.html` (every other distinct capture) and
`LZ/{board}/*.html` (the Zeroboard 4.0 install's own list pages), and
writes gold `src/content/posts/{board}/{no}.json` like Stage 2 does
(ADR-0017 §4). A post shown on several captures is taken from the newest
one that dates it.

ENTRY SHAPE
    <!--<input type=checkbox name=cart value="NO">-->   post number
    <b>title</b> … Date : <span title="YYYY년 MM월 DD일 HH시 MM분 SS초">
    body: the first `<td style="word-break:break-all…">` after the header
    link skin adds   hit_plus.php?sitelink=URL&category=N   and  Hit : N
    diary skin adds  <font color="#9f9f9f">[category]</font> — the poster's id,
                     by the board's own rules
    notice skin      the body is the next `<td bgcolor="white">`; no author,
                     no hits
    pds skin         `<input name=cart>` is not commented out; `[category]` and
                     title in two `<b>`s, `Download : N`, the file link with its
                     size, the description in the next `word-break` cell with
                     the file's picture beside it, `Uploader : name`
    bullet head      the 2006 file library (ruvin_cubic_pds): `<b>* </b>[category]
                     title`, no date, the file's picture beside the description

Authors: the link skin prints none (an admin-curated directory) → "Forg",
the site owner's account; the diary skin's category is the poster; the
notice skin prints none → "anonymous"; the pds skin's `Uploader`.

A post no capture dates (the 2006 file library printed no date) is kept
with the 1970 sentinel the site shows as "작성일 미상", beside the capture's
date (`post-view.tsx`).

REBORN BOARDS
    `Recall` was emptied and opened again as a file library: its captures
    from 2006 number five re-uploaded programs 1, 2, 6, 7, 8, and 1, 2, 6
    are 2001 posts' numbers. Those captures go to `Recall2006`.

BEST_UO
    The 2001 notice list printed the newest Best_UO (`Today`) screenshot
    beside the notices: picture, its text as the `alt`, "Created By …"
    (the post's title). Matched to `Today`'s own list for number and date.

USAGE
    python3 scripts/etl/02e-parse-link-diary.py [--board ID] [--dry-run]
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from bs4 import BeautifulSoup, Comment, Tag
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parent))
from etl_io import write_atomic  # noqa: E402
from sanitise import sanitise_html  # noqa: E402
from schemas import Attachment, Post  # noqa: E402

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
RESEARCH = PROJECT_ROOT / ".docs" / "research"
CLEAN_DIR = RESEARCH / "archive-clean"
OUTPUT_DIR = PROJECT_ROOT / "src" / "content" / "posts"
# The phases holding list captures and the plan that dates each phase's pages.
PHASE_PLANS = {
    "L": RESEARCH / "cdx" / "listings-plan.json",
    "L2": RESEARCH / "cdx" / "listings-more-plan.json",
    "LZ": RESEARCH / "cdx" / "oldpath-listpages-plan.json",
}
# Where a post's view lived: the 4.1 install for L and L2; for an LZ page,
# the Zeroboard 4.0 install its file name names (`z-…` /zboard/, `y-…` /zb/).
ORIGIN_41 = "http://forg.co.kr/_zb/zboard.php"
ORIGIN_40 = {"z": "http://forg.co.kr/zboard/zboard.php", "y": "http://forg.co.kr/zb/zboard.php"}

BOARDS: dict[str, str] = {
    "UO_Notice": "notice",
    "UOPds": "pds",
    "Recall": "link",
    "bod_b_s": "diary",
    "bod_b_t": "diary",
    "bod_s_s": "diary",
    "bod_s_t": "diary",
}
# `{board: (first capture of the new board, its museum id)}`. Recall's last
# capture numbered as in 2001 is 2005-05-23, the first renumbered 2006-04-28.
REBORN: dict[str, tuple[str, str]] = {"Recall": ("20060101000000", "Recall2006")}
# The Best_UO box: the board it shows and the list page it sits on.
SHOT_BOARD, SHOT_HOST = "Today", "UO_Notice"
KST = timedelta(hours=9)

_CART_RE = re.compile(r'name="?cart"? value="(\d+)"')
_DATE_TITLE_RE = re.compile(r"(\d{4})년 (\d{2})월 (\d{2})일 (\d{2})시 (\d{2})분 (\d{2})초")
_SITELINK_RE = re.compile(r"sitelink=([^&]+)")
_HIT_RE = re.compile(r"Hit\s*:\s*([\d,]+)")
_VISIT_RE = re.compile(r"Visit\s*:\s*([\d,]+)")
_FILENUM_RE = re.compile(r"download\.php\?[^\"']*filenum=(\d+)")
_SIZE_RE = re.compile(r"Size\s*:\s*([\d.,]+)\s*(KB|MB|GB|B)", re.I)
_DOWNLOADS_RE = re.compile(r"Download\s*:\s*([\d,]+)")
_UPLOADER_RE = re.compile(r"Uploader\s*:\s*(\S+)")
# The 2006 file-library skin (ruvin_cubic_pds) heads an entry with a bullet:
# `<b>* </b>[category] title`.
_STAR_HEAD_RE = re.compile(r"^\*\s*\[([^\[\]]+)\]\s*(.+)$", re.S)


def _capture_index() -> tuple[dict[tuple[str, str, str], str], dict[tuple[str, str, str], str | None]]:
    """`{(phase, board, page): ts}` and `{(phase, board, page): category
    number}` from each phase's plan: a category view prints its own name as
    plain text, so the number has to come from the list URL."""
    ts: dict[tuple[str, str, str], str] = {}
    cats: dict[tuple[str, str, str], str | None] = {}
    for phase, plan_file in PHASE_PLANS.items():
        for e in json.loads(plan_file.read_text(encoding="utf-8")):
            if e.get("phase", phase) != phase:
                continue
            key = (phase, e["board"], e["post_id"])
            ts[key] = e["ts"]
            m = re.search(r"[?&]category=(\d+)", e["url"])
            cats[key] = m.group(1) if m else None
    return ts, cats


def origin_of(phase: str, page: str) -> str:
    """The view URL's script for a post read off `page` of `phase`."""
    return ORIGIN_40.get(page[:1], ORIGIN_41) if phase == "LZ" else ORIGIN_41


def board_for(board: str, captured_at: str) -> str:
    """The museum board a capture's entries belong to (`REBORN`)."""
    since, reborn = REBORN.get(board, ("", board))
    return reborn if captured_at >= since else board


def better(prev: dict | None, e: dict) -> bool:
    """Whether `e` should replace `prev` for the same post: a capture that
    dates the post beats one that does not, then the newer capture wins, as
    a post's title was sometimes edited later."""
    if prev is None:
        return True
    if (e["created"] is None) != (prev["created"] is None):
        return e["created"] is not None
    return e["capturedAt"] > prev["capturedAt"]


def _entries(soup: BeautifulSoup) -> list[Tag]:
    """The `<td>` holding each entry's header (title + the cart checkbox,
    commented out in most skins, live in the pds skin), in page order."""
    out: list[Tag] = []
    for c in soup.find_all(string=lambda s: isinstance(s, Comment) and "name=" in s and "cart" in s):
        td = c.find_parent("td")
        if isinstance(td, Tag) and _CART_RE.search(str(c)):
            out.append(td)
    for box in soup.find_all("input", attrs={"name": "cart"}):
        td = box.find_parent("td") if isinstance(box, Tag) else None
        if isinstance(td, Tag):
            out.append(td)
    return out


def _body_td(header_td: Tag) -> Tag | None:
    """The first body cell after the header: `word-break:break-all` + padding."""
    for td in header_td.find_all_next("td"):
        if not isinstance(td, Tag):
            continue
        style = str(td.get("style", ""))
        if "word-break" in style and td is not header_td and td.find(string=lambda s: isinstance(s, Comment) and "cart" in s) is None:
            # Skip the next entry's header (it also has word-break).
            if td.find("img", src=re.compile("name_head")) is not None:
                return None
            return td
    return None


def _side_picture(desc_td: Tag | None) -> str:
    """The picture a file skin prints in the cell beside the description, as
    a paragraph to end the body with ("" when there is none)."""
    pic_td = desc_td.find_next_sibling("td") if isinstance(desc_td, Tag) else None
    pic = pic_td.find("img") if isinstance(pic_td, Tag) else None
    return f'\n<p><img src="{pic["src"]}"></p>' if isinstance(pic, Tag) and pic.get("src") else ""


def _book_header(header_td: Tag) -> tuple[str, str] | None:
    """The Zeroboard 4.0 install's link skin (zetyx_book_Esee, the LZ pages)
    heads an entry with a grey `[category]` in one `<b>` and the title in the
    next: `(category, title)`, or None for the 4.1 skin."""
    bs = [b for b in header_td.find_all("b") if isinstance(b, Tag)]
    if len(bs) >= 2 and bs[0].find("font", color="#9f9f9f") is not None:
        return bs[0].get_text(strip=True).strip("[] "), bs[1].get_text(" ", strip=True)
    return None


def parse_link_entry(header_td: Tag, captured_at: str) -> dict:
    no = _CART_RE.search(str(header_td)).group(1)  # type: ignore[union-attr]
    book = _book_header(header_td)
    if book is not None:
        return _parse_book_entry(header_td, no, *book)
    title_b = header_td.find("b")
    title = title_b.get_text(" ", strip=True) if isinstance(title_b, Tag) else ""
    star = _STAR_HEAD_RE.match(header_td.get_text(" ", strip=True)) if title == "*" else None
    if star:
        title = star.group(2).strip()
    date_span = header_td.find_next("span", title=_DATE_TITLE_RE)
    created = _parse_date(date_span)
    # A link entry carries a site URL (hit_plus.php?sitelink=…) and a hit
    # count; a file entry (UO자료실) carries a download.php attachment with
    # size and download count instead.
    link_a = header_td.find_next("a", href=_SITELINK_RE)
    file_a = header_td.find_next("a", href=_FILENUM_RE)
    # The next entry's header marks where this entry ends; the header's own
    # name_head icon must be skipped.
    entry_end = next(
        (img for img in header_td.find_all_next("img", src=re.compile("name_head"))
         if img not in header_td.descendants),
        None,
    )
    if isinstance(link_a, Tag) and entry_end is not None and _precedes(entry_end, link_a):
        link_a = None
    if isinstance(file_a, Tag) and entry_end is not None and _precedes(entry_end, file_a):
        file_a = None
    sitelink = None
    category = None
    attachments: list[dict] = []
    if isinstance(link_a, Tag):
        href = str(link_a.get("href"))
        m = _SITELINK_RE.search(href)
        sitelink = m.group(1) if m else None
        cm = re.search(r"category=(\d+)", href)
        category = cm.group(1) if cm else None
    if isinstance(file_a, Tag):
        href = str(file_a.get("href"))
        cm = re.search(r"category=(\d+)", href)
        category = category or (cm.group(1) if cm else None)
        tail = file_a.parent.get_text(" ", strip=True) if isinstance(file_a.parent, Tag) else ""
        size_m = _SIZE_RE.search(tail)
        attachments.append(
            {
                "name": file_a.get_text(strip=True),
                "fileNum": int(_FILENUM_RE.search(href).group(1)),  # type: ignore[union-attr]
                "sizeBytes": _size_bytes(size_m.group(1), size_m.group(2)) if size_m else None,
            }
        )
        dl = _DOWNLOADS_RE.search(tail)
        if dl:
            attachments[-1]["downloads"] = int(dl.group(1).replace(",", ""))
    hit_text = header_td.find_next(string=_HIT_RE)
    if hit_text is not None and entry_end is not None and _precedes(entry_end, hit_text.parent):  # type: ignore[arg-type]
        hit_text = None
    hits = int(_HIT_RE.search(str(hit_text)).group(1).replace(",", "")) if hit_text else None  # type: ignore[union-attr]
    body_td = _body_td(header_td)
    body = body_td.decode_contents() if isinstance(body_td, Tag) else ""
    if sitelink:
        body = f'<p><a href="{sitelink}">{sitelink}</a></p>\n' + body
    if star:
        body += _side_picture(body_td)
    return {
        "no": no, "title": title, "author": "Forg", "member_no": "1",
        # The bullet skin names its category; the others give its number.
        "category": star.group(1).strip() if star else category,
        "created": created, "hits": hits, "body": body,
        "attachments": attachments,
    }


def _precedes(a: Tag, b: Tag) -> bool:
    """True when `a` comes before `b` in document order."""
    return b in a.find_all_next()


def _size_bytes(num: str, unit: str) -> int:
    scale = {"B": 1, "KB": 1024, "MB": 1024**2, "GB": 1024**3}[unit.upper()]
    return int(float(num.replace(",", "")) * scale)


def _parse_book_entry(header_td: Tag, no: str, category: str, title: str) -> dict:
    """An LZ entry: a site cell (home.gif and the bare link), the date beside
    it, then the description in the next cell; `Visit : N` beside the
    title. The category is the name itself, not a number."""
    site_td = _body_td(header_td)
    sitelink = None
    body_td = site_td
    if isinstance(site_td, Tag) and site_td.find("img", src=re.compile("home\\.gif")) is not None:
        link = site_td.find("a", href=True)
        sitelink = str(link["href"]) if isinstance(link, Tag) else None
        body_td = _body_td(site_td)
    date_span = header_td.find_next("span", title=_DATE_TITLE_RE)
    visit = header_td.find_next(string=_VISIT_RE)
    body = body_td.decode_contents() if isinstance(body_td, Tag) else ""
    if sitelink:
        body = f'<p><a href="{sitelink}">{sitelink}</a></p>\n' + body
    return {
        "no": no, "title": title, "author": "Forg", "member_no": "1",
        "category": category, "created": _parse_date(date_span),
        "hits": int(_VISIT_RE.search(str(visit)).group(1).replace(",", "")) if visit else None,  # type: ignore[union-attr]
        "body": body, "attachments": [],
    }


def parse_diary_entry(header_td: Tag, captured_at: str) -> dict:
    """The diary skin prints no author cell. The BOD boards' own rules post
    tells members to file under their id in the category ("Special항목에
    있는 자신의 아이디를 선택"), so the `[category]` is the poster."""
    no = _CART_RE.search(str(header_td)).group(1)  # type: ignore[union-attr]
    category = None
    cat_font = header_td.find("font", color=re.compile("^#9f9f9f$", re.I))
    if isinstance(cat_font, Tag) and cat_font.get_text(strip=True).startswith("["):
        category = cat_font.get_text(strip=True).strip("[]").strip()
    # Title = the bold text after the category tag (coloured spans inside
    # the title, e.g. a blue guild name, are part of it).
    title = ""
    for b in header_td.find_all("b"):
        if not isinstance(b, Tag) or (cat_font is not None and cat_font in b.descendants):
            continue
        t = b.get_text(" ", strip=True)
        if t:
            title = t
            break
    date_span = header_td.find_next("span", title=_DATE_TITLE_RE)
    created = _parse_date(date_span)
    body_td = _body_td(header_td)
    body = body_td.decode_contents() if isinstance(body_td, Tag) else ""
    return {
        "no": no, "title": title, "author": category or "anonymous", "member_no": None,
        "category": category, "created": created, "hits": None, "body": body,
        "attachments": [],
    }


def _cart_no(header_td: Tag) -> str:
    """The entry's post number: the cart checkbox, commented out or live."""
    box = header_td.find("input", attrs={"name": "cart"})
    if isinstance(box, Tag) and str(box.get("value", "")).isdigit():
        return str(box["value"])
    return _CART_RE.search(str(header_td)).group(1)  # type: ignore[union-attr]


def parse_notice_entry(header_td: Tag, captured_at: str) -> dict:
    """The zzun_notice skin (UO_Notice): `<b>title</b> [date]` in the header,
    the whole post in the next `<td bgcolor="white">`. It prints no author."""
    title_b = header_td.find("b")
    body_td = header_td.find_next("td", attrs={"bgcolor": re.compile("^white$", re.I)})
    nxt = next((c for c in header_td.find_all_next(string=lambda s: isinstance(s, Comment) and _CART_RE.search(s))
                if c.find_parent("td") is not header_td), None)
    if isinstance(body_td, Tag) and nxt is not None and isinstance(nxt.parent, Tag) and _precedes(nxt.parent, body_td):
        body_td = None  # this entry lost its body; the cell is the next one's
    return {
        "no": _cart_no(header_td),
        "title": title_b.get_text(" ", strip=True) if isinstance(title_b, Tag) else "",
        "author": "anonymous", "member_no": None, "category": None,
        "created": _parse_date(header_td.find("span", title=_DATE_TITLE_RE)),
        "hits": None,
        "body": body_td.decode_contents() if isinstance(body_td, Tag) else "",
        "attachments": [],
    }


def parse_pds_entry(header_td: Tag, captured_at: str) -> dict:
    """The zetyx_pds_Esee skin (UOPds): the file row, then the description
    with the file's picture beside it (kept below the text), then `Uploader`.
    The next entry's cart box ends the entry."""
    no = _cart_no(header_td)
    book = _book_header(header_td)
    category, title = book if book is not None else (None, "")
    own = header_td.find("input", attrs={"name": "cart"})
    nxt = next((i for i in header_td.find_all_next("input", attrs={"name": "cart"}) if i is not own), None)

    def mine(el: object) -> bool:
        return el is not None and (nxt is None or _precedes(el, nxt))  # type: ignore[arg-type]

    # The file row's link names the file; the picture's link around it does not.
    file_a = next((a for a in header_td.find_all_next("a", href=_FILENUM_RE) if a.get_text(strip=True)), None)
    attachments: list[dict] = []
    file_td = None
    if isinstance(file_a, Tag) and mine(file_a):
        file_td = file_a.find_parent("td")
        tail = file_a.parent.get_text(" ", strip=True) if isinstance(file_a.parent, Tag) else ""
        size_m = _SIZE_RE.search(tail)
        attachments.append({
            "name": file_a.get_text(strip=True),
            "fileNum": int(_FILENUM_RE.search(str(file_a["href"])).group(1)),  # type: ignore[union-attr]
            "sizeBytes": _size_bytes(size_m.group(1), size_m.group(2)) if size_m else None,
        })
    # `_body_td` stops at the next entry's header (its `name_head` icon).
    desc_td = _body_td(file_td if isinstance(file_td, Tag) else header_td)
    body = (desc_td.decode_contents() if isinstance(desc_td, Tag) else "") + _side_picture(desc_td)
    # `Uploader : <b><b><a>name</a></b></b>`: the name is in the same cell.
    label = header_td.find_next(string=re.compile(r"Uploader\s*:"))
    up_td = label.find_parent("td") if label is not None and mine(label.parent) else None
    up = _UPLOADER_RE.search(up_td.get_text(" ", strip=True)) if isinstance(up_td, Tag) else None
    author = up.group(1) if up else "anonymous"
    # The date sits in the file row: an entry without it has none of its own.
    date_span = header_td.find_next("span", title=_DATE_TITLE_RE)
    return {
        "no": no, "title": title, "author": author, "member_no": "1" if author == "Forg" else None,
        "category": category,
        "created": _parse_date(date_span) if mine(date_span) else None,
        "hits": None, "body": body, "attachments": attachments,
    }


PARSERS = {"notice": parse_notice_entry, "pds": parse_pds_entry}


def _parse_date(span: Tag | None) -> datetime | None:
    if not isinstance(span, Tag):
        return None
    m = _DATE_TITLE_RE.search(str(span.get("title", "")))
    if not m:
        return None
    y, mo, d, h, mi, s = (int(x) for x in m.groups())
    try:
        return datetime(y, mo, d, h, mi, s)
    except ValueError:
        return None


def link_categories(soup: BeautifulSoup) -> dict[str, str]:
    """`{category number: name}` from the link skin's sidebar, e.g. `울온정보사이트 (5)`."""
    names: dict[str, str] = {}
    for a in soup.find_all("a", href=re.compile(r"category=\d+&")):
        if not isinstance(a, Tag):
            continue
        m = re.search(r"category=(\d+)", str(a.get("href")))
        text = re.sub(r"\s*\(\d+\)\s*$", "", a.get_text(" ", strip=True))
        if m and text and m.group(1) not in names:
            names[m.group(1)] = text
    return names


def screenshot_box(soup: BeautifulSoup) -> tuple[str, str, str] | None:
    """The Best_UO box of a 2001 notice list page (zzun_screenshot):
    `(title, text, picture src)`, or None when the page has none."""
    mark = soup.find(string=lambda s: isinstance(s, Comment) and "zzun_screenshot" in s)
    box = mark.find_next("center") if mark is not None else None
    img = box.find("img") if isinstance(box, Tag) else None
    if not isinstance(box, Tag) or not isinstance(img, Tag) or not img.get("src"):
        return None
    return box.get_text(" ", strip=True), str(img.get("alt", "")), str(img["src"])


def list_rows(soup: BeautifulSoup, board: str) -> list[dict]:
    """A 2001 list page's rows: number, title, author and the date cell's time."""
    rows = []
    for a in soup.find_all("a", href=re.compile(rf"view\.php\?id={board}&")):
        no = re.search(r"[?&]no=(\d+)", str(a.get("href")))
        tr = a.find_parent("tr")
        if not no or not isinstance(tr, Tag):
            continue
        member = tr.find("a", href=re.compile(r"member_no=\d+"))
        member_no = re.search(r"member_no=(\d+)", str(member.get("href"))) if isinstance(member, Tag) else None
        rows.append({
            "no": no.group(1), "title": a.get_text(" ", strip=True),
            "author": member.get_text(strip=True) if isinstance(member, Tag) else "anonymous",
            "member_no": member_no.group(1) if member_no else None,
            "created": _parse_date(tr.find("span", title=_DATE_TITLE_RE)),
        })
    return rows


def box_posts(captures: dict[tuple[str, str, str], str]) -> dict[str, dict]:
    """`{no: entry}` for the Best_UO posts the notice list's box shows. The
    box showed the newest screenshot, so of `Today`'s posts with its title
    it is the newest one written before the capture."""
    rows = [r for p in sorted((CLEAN_DIR / "LZ" / SHOT_BOARD).glob("*.html"))
            for r in list_rows(BeautifulSoup(p.read_text(encoding="utf-8"), "lxml"), SHOT_BOARD)]
    seen: dict[str, dict] = {}
    for page in sorted((CLEAN_DIR / "LZ" / SHOT_HOST).glob("*.html")):
        ts = captures.get(("LZ", SHOT_HOST, page.stem))
        box = screenshot_box(BeautifulSoup(page.read_text(encoding="utf-8"), "lxml")) if ts else None
        if ts is None or box is None:
            continue
        title, text, src = box
        # Wayback's clock is UTC, the list's is Korean time.
        at = datetime.strptime(ts, "%Y%m%d%H%M%S") + KST
        written = [r for r in rows if r["title"] == title and r["created"] is not None and r["created"] <= at]
        if not written:
            continue
        row = max(written, key=lambda r: int(r["no"]))
        lines = [html.escape(line.strip()) for line in text.strip().splitlines()]
        e = {
            **row, "category": None, "hits": None, "attachments": [], "capturedAt": ts,
            "body": f'<p><img src="{src}"></p>\n<p>{"<br>".join(lines)}</p>',
            "url": f"{origin_of('LZ', page.stem)}?id={SHOT_BOARD}&no={row['no']}",
        }
        if better(seen.get(row["no"]), e):
            seen[row["no"]] = e
    return seen


def write_post(board: str, no: str, e: dict, now: datetime, dry_run: bool, stats: dict) -> None:
    """Gold `{board}/{no}.json` from an entry, unless the post is there already."""
    out = OUTPUT_DIR / board / f"{no}.json"
    if out.exists():
        stats["skipped_existing"] += 1
        return
    body_html = sanitise_html(e["body"])
    body_text = BeautifulSoup(body_html, "lxml").get_text(" ", strip=True)
    try:
        post = Post(
            board=board,
            boardKr=board,
            postId=no,
            title=e["title"] or "(제목 없음)",
            categoryLabel=e["category"],
            bodyHtml=body_html,
            bodyText=body_text or " ",
            author=e["author"],
            authorMemberNo=e["member_no"],
            authorHomepage=None,
            createdAt=e["created"] or datetime(1970, 1, 1),
            hits=e["hits"],
            recommend=None,
            attachments=[Attachment(name=a["name"], fileNum=a["fileNum"], sizeBytes=a["sizeBytes"]) for a in e["attachments"]],
            comments=[],
            era="2003",
            capturedAt=e["capturedAt"],
            parsedAt=now,
            originalUrl=e["url"],
            sourceEngine="zeroboard",
        )
    except ValidationError as exc:
        stats["errors"] += 1
        print(f"  ERROR {board}/{no}: {exc.errors()[0]['msg']}", file=sys.stderr)
        return
    stats["written"] += 1
    if dry_run:
        print(f"  {board}/{no} {post.createdAt.date()} [{post.categoryLabel}] {post.author}: {post.title[:40]}", file=sys.stderr)
        return
    write_atomic(out, post.model_dump_json(indent=2) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n", 1)[0])
    parser.add_argument("--board", default="", choices=["", *BOARDS, SHOT_BOARD],
                        help="a board of BOARDS (a reborn one comes with its source) or Today")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    captures, page_cats = _capture_index()
    now = datetime.now(timezone.utc)
    stats = {"pages": 0, "entries": 0, "written": 0, "skipped_existing": 0, "undated": 0, "errors": 0}
    for board, skin in BOARDS.items():
        if args.board and args.board != board:
            continue
        pages = [p for phase in PHASE_PLANS for p in sorted((CLEAN_DIR / phase / board).glob("*.html"))]
        seen: dict[tuple[str, str], dict] = {}
        # Category number → name per museum board: a reborn board numbered its own.
        cat_names: dict[str, dict[str, str]] = {}
        for page_path in pages:
            key = (page_path.parent.parent.name, board, page_path.stem)
            captured_at = captures.get(key)
            if not captured_at:
                print(f"  WARN {'/'.join(key)}: no capture ts, skipped", file=sys.stderr)
                continue
            stats["pages"] += 1
            target = board_for(board, captured_at)
            soup = BeautifulSoup(page_path.read_text(encoding="utf-8"), "lxml")
            if skin == "link":
                cat_names.setdefault(target, {}).update(link_categories(soup))
            page_cat = page_cats.get(key)
            for header_td in _entries(soup):
                try:
                    if skin in PARSERS:
                        e = PARSERS[skin](header_td, captured_at)
                    elif skin == "link":
                        e = parse_link_entry(header_td, captured_at)
                    else:
                        e = parse_diary_entry(header_td, captured_at)
                except Exception as exc:  # noqa: BLE001
                    stats["errors"] += 1
                    print(f"  ERROR {board}/{page_path.stem}: {type(exc).__name__}: {exc}", file=sys.stderr)
                    continue
                if skin == "link":
                    e["category"] = e["category"] or page_cat
                e["capturedAt"] = captured_at
                e["url"] = f"{origin_of(key[0], page_path.stem)}?id={board}&no={e['no']}"
                stats["entries"] += 1
                if better(seen.get((target, e["no"])), e):
                    seen[(target, e["no"])] = e
        for (target, no), e in seen.items():
            if e["created"] is None:
                # No capture dates it (the 2006 file library printed none):
                # kept with the 1970 sentinel, "작성일 미상".
                stats["undated"] += 1
            if skin == "link" and e["category"]:
                # Number → name from whichever page listed it as a link.
                e["category"] = cat_names.get(target, {}).get(e["category"], e["category"])
            write_post(target, no, e, now, args.dry_run, stats)
    if not args.board or args.board == SHOT_BOARD:
        for no, e in box_posts(captures).items():
            write_post(SHOT_BOARD, no, e, now, args.dry_run, stats)
    print(f"\n[02e-parse-link-diary] DONE {stats}", file=sys.stderr)
    # Like the other parsers: a run that could not parse or validate
    # something exits 1, so a chained command stops on it.
    return 1 if stats["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
