#!/usr/bin/env python3
"""ETL Stage 2c — captured board list pages → one BoardListing JSON per board.

Reads UTF-8 HTML from `.docs/research/archive-clean/L/{board}/page-{N}.html`
(Stage 1 output of the phase-L download, `cdx/listings-plan.json`, one
capture per page) and `L2/{board}/page-{N}~{ts}.html` (every other distinct
capture of a list page, `cdx/listings-more-plan.json`), and
writes `src/content/listings/{board}.json` (ADR-0017).

A list row is the only trace of a post whose view page Wayback never
captured, and for 43 boards the only trace of the board. Rows from every
captured page of a board are merged by post number; when a post appears on
several captures the newest capture wins (its hit count is the latest).

Other captures print lists too (EXTRA_PHASES): Zeroboard 4.1 and Gnuboard4
show, under a post, the list page it was opened from, and the 2001
Zeroboard 4.0 installs did the same and kept list pages of their own (LZ).
Their rows add the posts no list page above holds, newest capture first;
they never replace a list page's row. Only dated rows whose link names the
capture's own board are taken, for boards the museum already holds (a list
page's or a post's).

LINKED ROWS
    Some captures name posts by title outside any list: the front page and
    its frames (`S/_root`, 2000–2016) show each board's latest posts, the
    2001 list pages (LZ) a latest-posts box of other boards (`zzun_notice`),
    and a 2001 view its Prev/Next posts with their authors. Such a link gives
    a post's board, number, title (often cut, `..` / `…`) and comment count;
    the 2001–2007 frames also print `MM/DD` (Notice, Events) or the author
    (column) before it. A row with `MM/DD` is dated like a list row
    (`pin_year`, `yearApprox`). Any other row's `createdAt` is a day the post
    precedes — the capture's Korean date, or the date of a newer post the
    same capture shows (the museum's, titles agreeing; a view's own post),
    whichever is earlier — flagged `datedByCapture`. They add only numbers
    no list row and no gold post holds, to boards that already have a
    listing; forg.kr boards and the event calendar (its cells mix a title
    with the start of the text) are left out.

ROW SHAPES
    Zeroboard kritz_* skins — `<tr>` holding an `<a href="zboard.php?…no=N">`:
        icon | author (`view_info.php?…member_no=M`) | title [+ `[c]` comment
        count] | MM/DD | hits
    Gnuboard4 webbus2009 — `<tr>` holding `wr_id=N`:
        no | title (+ comment count) | author | YYYY-MM-DD | hits
    Zeroboard 4.0 (2001) — `<tr>` holding `zboard.php?…no=N`:
        running count | title (+ comment count) | author | YYYY/MM/DD | hits
    In every shape a notice carries a notice icon (`isNotice`) and a reply a
    reply icon (`replyDepth`, see `reply_depth`).

YEAR
    Zeroboard printed MM/DD only. The year comes from, in order:
      1. the gold post itself (`src/content/posts/{board}/{no}.json`)
      2. gold neighbours by post number on both sides sharing one year
      3. the page's own order — rows descend by date, so walking down a
         page the year rolls back each time month/day jumps forward; the
         first non-notice row is anchored to the capture date — flagged
         `yearApprox`

USAGE
    python3 scripts/etl/02c-parse-listing.py [--board ID] [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from bisect import bisect_left
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parent))
from etl_io import write_atomic  # noqa: E402
from schemas import BoardListing, BoardListingEntry  # noqa: E402

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
INPUT_DIR = PROJECT_ROOT / ".docs" / "research" / "archive-clean" / "L"
MORE_DIR = PROJECT_ROOT / ".docs" / "research" / "archive-clean" / "L2"
POSTS_DIR = PROJECT_ROOT / "src" / "content" / "posts"
OUTPUT_DIR = PROJECT_ROOT / "src" / "content" / "listings"
PLAN_FILE = PROJECT_ROOT / ".docs" / "research" / "cdx" / "listings-plan.json"
MORE_PLAN_FILE = PROJECT_ROOT / ".docs" / "research" / "cdx" / "listings-more-plan.json"
ARCHIVE_DIR = PROJECT_ROOT / ".docs" / "research" / "archive-clean"
CDX_DIR = PROJECT_ROOT / ".docs" / "research" / "cdx"
PROGRESS_FILE = PROJECT_ROOT / ".docs" / "research" / "archive" / ".progress.jsonl"
# Captures that print a board list without being one of the list pages
# above: Zeroboard 4.1 / Gnuboard4 post views (A, B, C, V, W), and the 2001
# Zeroboard 4.0 list pages (LZ) and views (Z, Y, U, T).
OLD_PHASES = ("LZ", "Z", "Y", "U", "T")
EXTRA_PHASES = ("A", "B", "C", "V", "W", *OLD_PHASES)
# LINKED ROWS: the front page and its frames; of the views, the 2001 ones
# whose Prev/Next rows carry titles.
SITE_ROOT_DIR = ARCHIVE_DIR / "S" / "_root"
PREV_NEXT_PHASES = ("Z", "Y", "U", "T")
# Site captures after this are a 2023 parking page of a new registrant.
LAST_TS = "20160831235959"
NOT_TITLES = frozenset({"events_date"})

_ZB_NO_RE = re.compile(r"zboard\.php\?[^\"'>]*\bno=(\d+)")
_G4_ID_RE = re.compile(r"board\.php\?[^\"'>]*\bwr_id=(\d+)")
_MEMBER_RE = re.compile(r"member_no=(\d+)")
_MONTHDAY_RE = re.compile(r"^(\d{1,2})/(\d{1,2})$")
_DASH_DATE_RE = re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})$")
_COMMENT_RE = re.compile(r"\[(\d+)\]")
_TOTAL_RE = re.compile(r"total\s*<[^>]*>\s*<b>\s*([\d,]+)")
_CART_RE = re.compile(r'name="?cart"? value="(\d+)"')
# Row-status icons the kritz skins put in the first cell: age, admin post, notice.
_ROW_ICON_RE = re.compile(r"(old|new)_head|level\d+_write|notice", re.I)
# A notice's mark: Zeroboard's `list_notice.gif` / `notice_head.gif`,
# Gnuboard4's `icon_notice.gif`.
_NOTICE_ICON_RE = re.compile(r"notice|noti", re.I)
# A reply's mark: Zeroboard's `reply_head.gif` (`reply_new_head.gif` for a
# fresh one), Gnuboard4's `icon_reply.gif`.
_REPLY_ICON_RE = re.compile(r"reply(_new)?_head|icon_reply", re.I)
_CATEGORY_PREFIX_RE = re.compile(r"^\s*\[\s*([^\[\]]{1,12})\s*\]\s*(.*)$", re.S)
_LINK_BOARD_RE = re.compile(r"[?&;](?:amp;)?(?:id|bo_table)=([A-Za-z0-9_]+)")
_ZB40_NO_RE = re.compile(r"(?:zboard\.php3?|view\.php)\?[^\"'>]*\bno=(\d+)")
_SLASH_DATE_RE = re.compile(r"^(\d{4})/(\d{1,2})/(\d{1,2})$")
# A link that is only a comment count: Gnuboard's latest box `(3)` after the title.
_COMMENT_ONLY_RE = re.compile(r"^[(\[](\d+)[)\]]$")
_TRAILING_COMMENTS_RE = re.compile(r"\s*\[(\d+)\]$")
_PREV_NEXT_RE = re.compile(r"^(?:prev|next|이전글|다음글)$", re.I)
# Beside a front-page frame's link: `[N]` comments after it, `[author]` before it.
_BRACKET_COUNT_RE = re.compile(r"\s*\[(\d+)\]\s*")
_BRACKET_NAME_RE = re.compile(r"\[[^\[\]]{1,30}\]")
# A title cut through a Korean character: the cut half decoded as U+FFFD.
_CUT_CHAR_RE = re.compile(r"\ufffd+(?=(?:\.\.|…)?$)")


# ── Gold tier lookups ─────────────────────────────────────────────────


def load_gold_years(board: str) -> tuple[dict[int, date], list[int]]:
    """`{no: createdAt.date()}` for the board's gold posts, and the sorted nos."""
    years: dict[int, date] = {}
    board_dir = POSTS_DIR / board
    if not board_dir.is_dir():
        return years, []
    for f in board_dir.glob("*.json"):
        try:
            post = json.loads(f.read_text(encoding="utf-8"))
            d = datetime.fromisoformat(post["createdAt"]).date()
        except (OSError, ValueError, KeyError, json.JSONDecodeError):
            continue
        if d.year > 1990 and not post.get("createdAtApprox"):
            years[int(post["postId"])] = d
    return years, sorted(years)


def load_gold_titles(board: str) -> dict[int, str]:
    """`{no: title}` for every gold post of the board."""
    titles: dict[int, str] = {}
    board_dir = POSTS_DIR / board
    if not board_dir.is_dir():
        return titles
    for f in board_dir.glob("*.json"):
        try:
            post = json.loads(f.read_text(encoding="utf-8"))
            titles[int(post["postId"])] = post["title"]
        except (OSError, ValueError, KeyError, json.JSONDecodeError):
            continue
    return titles


# Wayback stamps are UTC; the boards printed Korean dates.
KST = timedelta(hours=9)


def pin_year(
    no: int, month: int, day: int, page_year: int, captured: date,
    gold: dict[int, date], gold_nos: list[int],
) -> tuple[date | None, bool]:
    """Resolve a MM/DD row date to a full date. Returns `(date, yearApprox)`.

    `page_year` is what the page's own descending order implies for this
    row (see `walk_page_years`); gold evidence overrides it, except that a
    row cannot postdate the page it was listed on (`captured`, the capture's
    UTC stamp as a Korean date, the boards' own clock).
    Neighbours can: FunBoard's numbering restarted, and the 2012–2015 posts
    numbered in the 10,000s would date the 2003–2005 rows 11013–18439.
    The year the gold neighbours share (one side, or both agreeing) stands
    unless it puts the row before its lower neighbour or after its upper one,
    which the numbering rules out (Newbie 2281 as 2003-02-05, below it 638
    of 2003-10-26); then the page's year is taken instead, as when they
    disagree.
    """
    if no in gold:
        return gold[no], False
    i = bisect_left(gold_nos, no)
    lo_date = gold[gold_nos[i - 1]] if i > 0 else None
    hi_date = gold[gold_nos[i]] if i < len(gold_nos) else None
    lo = lo_date.year if lo_date else None
    hi = hi_date.year if hi_date else None
    candidates = [y for y in (lo, hi) if y is not None]

    def from_page() -> int:
        # A neighbour on one side still bounds the guess.
        year = page_year
        if lo is not None and year < lo:
            year = lo
        if hi is not None and year > hi:
            year = hi
        return year

    if candidates and len(set(candidates)) == 1:
        year, approx = candidates[0], False
        try:
            pinned = date(year, month, day)
            if (lo_date and pinned < lo_date) or (hi_date and pinned > hi_date):
                year, approx = from_page(), True
        except ValueError:
            pass
    else:
        year, approx = from_page(), True
    try:
        pinned = date(year, month, day)
    except ValueError:
        return None, approx
    if pinned > captured:
        try:
            return date(page_year, month, day), True
        except ValueError:
            return None, True
    return pinned, approx


def walk_page_years(rows: list[dict], captured_at: str) -> None:
    """Set `page_year` on each MM/DD row from the page's descending order.

    The first dated non-notice row cannot postdate the capture; every later
    row is older, so a month/day that jumps forward means the year rolled
    back. Notices sit pinned at the top and are dated off the capture alone.
    """
    cap = datetime.strptime(captured_at[:8], "%Y%m%d").date()
    prev: tuple[int, int, int] | None = None  # (year, month, day) of the row above
    for r in rows:
        md = r["month_day"]
        if md is None:
            continue
        if r["notice"] or prev is None:
            year = cap.year if md <= (cap.month, cap.day) else cap.year - 1
        else:
            year = prev[0] - 1 if md > (prev[1], prev[2]) else prev[0]
        r["page_year"] = year
        if not r["notice"]:
            prev = (year, md[0], md[1])


# ── Row extraction ───────────────────────────────────────────────────


def cell_text(td: Tag) -> str:
    return re.sub(r"\s+", " ", td.get_text(" ", strip=True)).strip()


def reply_depth(tr: Tag, per_level: int = 1) -> int:
    """0 for a post; for a reply, how deep it sits.

    A reply's icon follows its indent: `&nbsp; ` a level in the 2001
    Zeroboard 4.0 skins, ` &nbsp;&nbsp; ` (`per_level=2`) in Gnuboard4. The
    kritz_* skins put the icon in a cell of its own and show no depth, read
    as 1. Only the `&nbsp;`s count: the plain spaces around them are also
    the markup's own line breaks.
    """
    img = tr.find("img", src=_REPLY_ICON_RE)
    if not isinstance(img, Tag):
        return 0
    lead = 0
    for sib in img.previous_siblings:
        if isinstance(sib, Tag):
            break
        lead += str(sib).count("\xa0")
    return max(1, lead // per_level)


def split_category(title: str) -> tuple[str | None, str]:
    m = _CATEGORY_PREFIX_RE.match(title)
    if m and m.group(2).strip():
        return m.group(1).strip(), m.group(2).strip()
    return None, title.strip()


def parse_zeroboard_rows(soup: BeautifulSoup) -> list[dict]:
    rows: list[dict] = []
    for tr in soup.find_all("tr"):
        if not isinstance(tr, Tag) or tr.find("tr") is not None:
            continue  # a table wrapper containing rows, not a row
        # A members-only board (Boo) prints the title without a link; the
        # post number survives in the commented-out `cart` checkbox.
        link = None
        for a in tr.find_all("a", href=True):
            if isinstance(a, Tag) and isinstance(a["href"], str) and _ZB_NO_RE.search(a["href"]):
                link = a
                break
        cart = _CART_RE.search(str(tr))
        if link is not None:
            no = _ZB_NO_RE.search(link["href"]).group(1)  # type: ignore[union-attr]
        elif cart and tr.find("img", src=_ROW_ICON_RE) is not None:
            no = cart.group(1)
        else:
            continue
        tds = [td for td in tr.find_all("td", recursive=False) if isinstance(td, Tag)]
        if link is not None:
            title_td = link.find_parent("td")
            raw_title = link.get_text(" ", strip=True)
        else:
            title_td = next((td for td in tds if td.get("align") == "left"), None)
            raw_title = ""
            if isinstance(title_td, Tag):
                font = title_td.find("font")
                raw_title = cell_text(title_td)
                if isinstance(font, Tag):
                    raw_title = raw_title.replace(cell_text(font), "").strip()
        if not isinstance(title_td, Tag):
            continue
        title_rest = cell_text(title_td)[len(raw_title):] if raw_title else cell_text(title_td)
        comments = _COMMENT_RE.search(title_rest)
        author, member_no = "anonymous", None
        for td in tds:
            if td is title_td:
                continue
            a = td.find("a", href=_MEMBER_RE)
            if isinstance(a, Tag):
                author = a.get_text(strip=True) or author
                m = _MEMBER_RE.search(str(a.get("href")))
                member_no = m.group(1) if m else None
                break
        else:
            # Unlinked author cell: the text cell just before the title.
            idx = tds.index(title_td)
            for td in reversed(tds[:idx]):
                t = cell_text(td)
                if t and not t.isdigit():
                    author = t
                    break
        month_day, hits = None, None
        for td in tds:
            t = cell_text(td)
            if month_day is None and _MONTHDAY_RE.match(t):
                month_day = tuple(int(x) for x in _MONTHDAY_RE.match(t).groups())  # type: ignore[union-attr]
            elif month_day is not None and t.replace(",", "").isdigit():
                hits = int(t.replace(",", ""))
        icon = tr.find("img", src=_NOTICE_ICON_RE)
        rows.append(
            {
                "no": no,
                "board": link_board(link),
                "title": raw_title,
                "author": author,
                "member_no": member_no,
                "month_day": month_day,
                "full_date": None,
                "hits": hits,
                "comments": int(comments.group(1)) if comments else 0,
                "notice": icon is not None,
                "reply": reply_depth(tr),
            }
        )
    return rows


def link_board(link: Tag | None) -> str | None:
    """The board id a row's link names (`id=` / `bo_table=`), if any."""
    if link is None:
        return None
    m = _LINK_BOARD_RE.search(str(link.get("href", "")))
    return m.group(1) if m else None


def parse_gnuboard_rows(soup: BeautifulSoup) -> list[dict]:
    rows: list[dict] = []
    for tr in soup.find_all("tr"):
        if not isinstance(tr, Tag) or tr.find("tr") is not None:
            continue
        link = None
        for a in tr.find_all("a", href=True):
            if isinstance(a, Tag) and isinstance(a["href"], str) and _G4_ID_RE.search(a["href"]):
                link = a
                break
        if link is None:
            continue
        no = _G4_ID_RE.search(link["href"]).group(1)  # type: ignore[union-attr]
        tds = [td for td in tr.find_all("td", recursive=False) if isinstance(td, Tag)]
        title_td = link.find_parent("td")
        raw_title = link.get_text(" ", strip=True)
        comments = _COMMENT_RE.search(cell_text(title_td)) if isinstance(title_td, Tag) else None
        author, full_date, hits = "anonymous", None, None
        texts = [cell_text(td) for td in tds if td is not title_td]
        for t in texts:
            m = _DASH_DATE_RE.match(t)
            if m and full_date is None:
                y, mo, d = (int(x) for x in m.groups())
                try:
                    full_date = date(y, mo, d)
                except ValueError:
                    full_date = None
            elif full_date is not None and t.replace(",", "").isdigit() and hits is None:
                hits = int(t.replace(",", ""))
        member = tr.find("span", class_="member")
        if isinstance(member, Tag) and member.get_text(strip=True):
            author = member.get_text(strip=True)
        else:
            for t in texts:
                if t and not t.isdigit() and not _DASH_DATE_RE.match(t) and not _COMMENT_RE.fullmatch(t):
                    author = t
                    break
        rows.append(
            {
                "no": no,
                "board": link_board(link),
                "title": raw_title,
                "author": author,
                "member_no": None,
                "month_day": None,
                "full_date": full_date,
                "hits": hits,
                "comments": int(comments.group(1)) if comments else 0,
                "notice": tr.find("img", src=_NOTICE_ICON_RE) is not None,
                "reply": reply_depth(tr, per_level=2),
            }
        )
    return rows


def parse_zeroboard40_rows(soup: BeautifulSoup) -> list[dict]:
    """Rows of the 2001 Zeroboard 4.0 lists, on list pages and under views.

    The first cell is a running count, not the post number (that is in the
    link); the author follows the title; the date is a full YYYY/MM/DD.
    A row without a date is not a list row and is left out.
    """
    rows: list[dict] = []
    for tr in soup.find_all("tr"):
        if not isinstance(tr, Tag) or tr.find("tr") is not None:
            continue
        link = None
        for a in tr.find_all("a", href=True):
            if isinstance(a, Tag) and isinstance(a["href"], str) and _ZB40_NO_RE.search(a["href"]):
                link = a
                break
        if link is None:
            continue
        tds = [td for td in tr.find_all("td", recursive=False) if isinstance(td, Tag)]
        title_td = link.find_parent("td")
        if title_td not in tds:
            continue
        date_at, full_date = None, None
        for i, td in enumerate(tds):
            m = _SLASH_DATE_RE.match(cell_text(td))
            if m:
                date_at = i
                try:
                    full_date = date(*(int(x) for x in m.groups()))
                except ValueError:
                    full_date = None
                break
        if date_at is None or full_date is None:
            continue
        at = tds.index(title_td)
        raw_title = link.get_text(" ", strip=True)
        comments = _COMMENT_RE.search(cell_text(title_td)[len(raw_title):])
        author = next(
            (cell_text(td) for td in tds[at + 1 : date_at] if cell_text(td) and not cell_text(td).isdigit()),
            "anonymous",
        )
        hits = next(
            (int(cell_text(td).replace(",", "")) for td in tds[date_at + 1 :] if cell_text(td).replace(",", "").isdigit()),
            None,
        )
        rows.append(
            {
                "no": _ZB40_NO_RE.search(link["href"]).group(1),  # type: ignore[union-attr]
                "board": link_board(link),
                "title": raw_title,
                "author": author,
                "member_no": None,
                "month_day": None,
                "full_date": full_date,
                "hits": hits,
                "comments": int(comments.group(1)) if comments else 0,
                "notice": tr.find("img", src=_NOTICE_ICON_RE) is not None,
                "reply": reply_depth(tr),
            }
        )
    return rows


def parse_page(html: str, engine: str) -> tuple[list[dict], int | None]:
    """Return `(rows, total_reported)` for a page of the given engine."""
    soup = BeautifulSoup(html, "lxml")
    if engine == "zeroboard":
        rows = parse_zeroboard_rows(soup)
    elif engine == "zeroboard40":
        rows = parse_zeroboard40_rows(soup)
    else:
        rows = parse_gnuboard_rows(soup)
    total = _TOTAL_RE.search(html)
    return rows, int(total.group(1).replace(",", "")) if total else None


def extra_rows(html: str, kind: str, board: str, captured_at: str) -> list[dict]:
    """The list rows another capture prints for `board` (see EXTRA_PHASES).

    A row needs a date (anything else a post view links to, from the body
    or the prev/next buttons, has none) and a link naming `board`; the
    month/day rows get their page year from the rows around them.
    """
    rows, _total = parse_page(html, kind)
    rows = [
        r for r in rows
        if r["board"] == board and (r["month_day"] is not None or r["full_date"] is not None)
    ]
    walk_page_years(rows, captured_at)
    return rows


def load_extra_captures() -> dict[str, list[tuple[Path, str, int, str]]]:
    """`{board: [(path, ts, list page, engine)]}` for the EXTRA_PHASES captures.

    The time comes from the downloader's record and the URL from the phase's
    plan: the URL tells the engine (`bbs/board.php` is Gnuboard4) and the
    list page shown under a view (`page=`).
    """
    ts_of: dict[tuple[str, str, str], str] = {}
    for line in PROGRESS_FILE.read_text(encoding="utf-8").splitlines():
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        if rec.get("status") == "ok" and rec.get("phase") in EXTRA_PHASES and rec.get("ts"):
            ts_of[(rec["phase"], rec["board"], str(rec["post_id"]))] = rec["ts"]
    url_of: dict[tuple[str, str, str], str] = {}
    for plan in sorted(CDX_DIR.glob("*-plan.json")):
        for e in json.loads(plan.read_text(encoding="utf-8")):
            if e.get("phase") in EXTRA_PHASES:
                url_of[(e["phase"], e["board"], str(e["post_id"]))] = e.get("url", "")
    out: dict[str, list[tuple[Path, str, int, str]]] = {}
    for phase in EXTRA_PHASES:
        root = ARCHIVE_DIR / phase
        if not root.is_dir():
            continue
        for f in sorted(root.glob("*/*.html")):
            key = (phase, f.parent.name, f.stem)
            ts, url = ts_of.get(key), url_of.get(key, "")
            if not ts:
                continue
            if phase in OLD_PHASES:
                kind = "zeroboard40"
            else:
                kind = "gnuboard4" if "bbs/board.php" in url else "zeroboard"
            m = re.search(r"[?&]page=(\d+)", url) or re.search(r"page-(\d+)", f.stem)
            page = int(m.group(1)) if m and int(m.group(1)) > 0 else 1
            out.setdefault(f.parent.name, []).append((f, ts, page, kind))
    return out


def _around(a: Tag) -> tuple[tuple[int, int] | None, str | None, int | None]:
    """What a 2001–2007 front-page frame prints beside a link: `MM/DD` or
    `[author]` (the column box) just before it, `[N]` comments just after —
    before the next link, which is the next row's."""
    month_day, author, comments = None, None, None
    before = a.previous_sibling
    if isinstance(before, NavigableString):
        t = str(before).strip()
        md = _MONTHDAY_RE.match(t)
        if md:
            month_day = (int(md.group(1)), int(md.group(2)))
        elif _BRACKET_NAME_RE.fullmatch(t):
            author = t[1:-1].strip()
    after = a.next_sibling
    for _ in range(3):
        if after is None or (isinstance(after, Tag) and after.name == "a"):
            break
        n = _BRACKET_COUNT_RE.fullmatch(after.get_text() if isinstance(after, Tag) else str(after))
        if n:
            comments = int(n.group(1))
            break
        after = after.next_sibling
    return month_day, author, comments


def linked_rows(html: str, *, prev_next_only: bool = False) -> list[dict]:
    """The posts a capture links to by title (LINKED ROWS), in page order.

    One row per post: its board and number from the link, the link's text
    as the title, the comment count in the link (`[3]`), in the link after
    it (`(3)`) or printed after it (`[3]`), and what a frame prints before
    it (`MM/DD`, `[author]`). With `prev_next_only` (a view) only a
    Prev/Next row counts — a link in the post's text may say anything — and
    the cell after the title is the author.
    """
    soup = BeautifulSoup(html, "lxml")
    rows: list[dict] = []
    seen: dict[tuple[str, str], dict] = {}
    for a in soup.find_all("a", href=True):
        if not isinstance(a, Tag) or not isinstance(a["href"], str):
            continue
        m = _ZB40_NO_RE.search(a["href"]) or _G4_ID_RE.search(a["href"])
        board = link_board(a)
        if m is None or board is None or board in NOT_TITLES:
            continue
        key = (board, m.group(1))
        text = re.sub(r"\s+", " ", a.get_text(" ", strip=True)).strip()
        count = _COMMENT_ONLY_RE.match(text)
        if count:
            if key in seen:
                seen[key]["comments"] = int(count.group(1))
            continue
        if key in seen:
            continue
        month_day, author, comments = _around(a)
        author = author or "anonymous"
        if prev_next_only:
            tr = a.find_parent("tr")
            if not isinstance(tr, Tag) or not any(
                _PREV_NEXT_RE.match(td.get_text("", strip=True))
                for td in tr.find_all("td", recursive=False)
                if isinstance(td, Tag)
            ):
                continue
            td = a.find_parent("td")
            after = td.find_next_sibling("td") if isinstance(td, Tag) else None
            if isinstance(after, Tag) and cell_text(after):
                author = cell_text(after)
        trailing = _TRAILING_COMMENTS_RE.search(text)
        if trailing:
            comments, text = int(trailing.group(1)), text[: trailing.start()].rstrip()
        text = _CUT_CHAR_RE.sub("", text).strip()
        # Nothing to show, a link written as its address, or a title that did
        # not decode (a spam run of double-encoded text) is no title.
        if not text or "\ufffd" in text or text.isdigit() or re.match(r"https?://", text):
            continue
        row = {
            "no": key[1], "board": board, "title": text, "author": author,
            "comments": comments or 0, "month_day": month_day, "notice": False,
        }
        seen[key] = row
        rows.append(row)
    return rows


def linked_sources(extras: dict[str, list[tuple[Path, str, int, str]]]) -> list[tuple[Path, str, bool]]:
    """Every capture LINKED ROWS reads, as `(path, ts, prev_next_only)`.

    The L/L2 list pages are not among them: what they link to outside their
    own rows is forg.kr's or the event calendar's.
    """
    out: list[tuple[Path, str, bool]] = []
    if SITE_ROOT_DIR.is_dir():
        for f in sorted(SITE_ROOT_DIR.glob("*.html")):
            ts = f.stem.rpartition("~")[2]
            if re.fullmatch(r"\d{14}", ts) and ts <= LAST_TS:
                out.append((f, ts, False))
    for items in extras.values():
        for path, ts, _page, _kind in items:
            phase = path.parent.parent.name
            if phase == "LZ" or phase in PREV_NEXT_PHASES:
                out.append((path, ts, phase != "LZ"))
    return out


def collect_linked(sources: list[tuple[Path, str, bool]]) -> dict[str, list[tuple[str, list[dict]]]]:
    """`{board: [(ts, that board's linked rows in one capture)]}`.

    A view's own post joins its board's rows as `context`: newer than its
    Prev, older than its Next, it bounds them (`date_linked`) but is no row.
    A frame's `MM/DD` rows get their page year as a list page's would.
    """
    out: dict[str, list[tuple[str, list[dict]]]] = {}
    for path, ts, prev_next_only in sources:
        html = path.read_text(encoding="utf-8")
        if not (_ZB40_NO_RE.search(html) or _G4_ID_RE.search(html)):
            continue
        by_board: dict[str, list[dict]] = {}
        for r in linked_rows(html, prev_next_only=prev_next_only):
            by_board.setdefault(r["board"], []).append(r)
        if prev_next_only and path.parent.name in by_board:
            own = {"no": path.stem.split("~")[0], "board": path.parent.name, "title": None, "context": True}
            by_board[path.parent.name].append(own)
        for board, rows in by_board.items():
            walk_page_years([r for r in rows if not r.get("context")], ts)
            out.setdefault(board, []).append((ts, rows))
    return out


def cut(title: str) -> bool:
    """A title the box or frame shortened."""
    return title.endswith(("..", "…"))


def bare(title: str) -> str:
    """A title to compare: no category prefix, no cut mark, no spaces."""
    _category, rest = split_category(title)
    return re.sub(r"\s+", "", rest.rstrip(".…"))


def same_title(shown: str, known: str) -> bool:
    """Whether a capture's (maybe cut) title is the museum's post's title."""
    a, b = bare(shown), bare(known)
    return bool(a) and b.startswith(a)


def known_dates(
    gold: dict[int, date], gold_titles: dict[int, str], merged: dict[str, dict],
) -> dict[int, tuple[date, str]]:
    """The board's dates a linked row may be bounded by, with their titles:
    gold posts' own, and list rows that printed the full date. A list row's
    MM/DD whose year was worked out is left out — a gold neighbour far
    below can set it years early (UOForum 3017–3024 as 2002)."""
    known = {no: (d, gold_titles[no]) for no, d in gold.items() if no in gold_titles}
    for r in merged.values():
        if r["full_date"] is not None:
            known.setdefault(int(r["no"]), (r["full_date"], r["title"]))
    return known


def date_linked(
    linked: list[tuple[str, list[dict]]], held: set[str], known: dict[int, tuple[date, str]],
) -> dict[str, dict]:
    """The linked rows of numbers not in `held`, one per number, each with
    `bound`: the earliest day it is known to precede (LINKED ROWS).

    `known` holds the board's known dates and titles by number. A newer
    number in the same capture was posted later, so its date bounds the row
    too — when the capture's title for it is the museum's: boards numbered
    again (UOForum, FunBoard) hold another, older post under that number.
    A view's own post (`context`) bounds without a title to check.
    Over several captures the earliest bound wins; the title is the longest
    uncut one, the comment count the highest, the author any named one, the
    printed `MM/DD` the earliest capture's. A capture whose title for the
    number is another post's is left out.
    """
    found: dict[str, dict] = {}
    for ts, rows in linked:
        day = (datetime.strptime(ts, "%Y%m%d%H%M%S") + KST).date()
        for r in rows:
            if r.get("context") or r["no"] in held:
                continue
            no = int(r["no"])
            newer = [
                known[n][0]
                for o in rows
                if (n := int(o["no"])) > no
                and n in known
                and (o.get("context") or same_title(o["title"], known[n][1]))
            ]
            bound = min([day, *newer])
            dated = {"month_day": r["month_day"], "page_year": r.get("page_year"), "dated_at": ts}
            prev = found.get(r["no"])
            if prev is None:
                found[r["no"]] = {**r, "bound": bound, "capturedAt": ts, **(dated if r["month_day"] else {})}
                continue
            if not (same_title(prev["title"], r["title"]) or same_title(r["title"], prev["title"])):
                continue
            if bound < prev["bound"]:
                prev["bound"], prev["capturedAt"] = bound, ts
            if r["month_day"] and (not prev["month_day"] or ts < prev["dated_at"]):
                prev.update(dated)
            if (cut(prev["title"]), -len(prev["title"])) > (cut(r["title"]), -len(r["title"])):
                prev["title"] = r["title"]
            prev["comments"] = max(prev["comments"], r["comments"])
            if prev["author"] == "anonymous":
                prev["author"] = r["author"]
    return found


def linked_entry(no: str, r: dict) -> BoardListingEntry:
    """A linked row as a listing entry. A printed `MM/DD` takes its year from
    the box's own order back from the capture (`yearApprox`), not from gold
    neighbours — a latest box shows recent posts, and boards numbered again
    (Events 26: 04/28 on the 2006 front page, gold 25 and 27 of 2001) would
    move it years — unless that lands after its bound; otherwise the bound
    stands in, `datedByCapture`."""
    created, approx, by_capture = r["bound"], False, True
    if r["month_day"]:
        cap = (datetime.strptime(r["dated_at"], "%Y%m%d%H%M%S") + KST).date()
        pinned, _approx = pin_year(int(no), *r["month_day"], r["page_year"], cap, {}, [])
        if pinned is not None and pinned <= r["bound"]:
            created, approx, by_capture = pinned, True, False
    category, title = split_category(r["title"])
    return BoardListingEntry(
        no=no,
        title=title or "(제목 없음)",
        categoryLabel=category,
        author=r["author"],
        createdAt=created,
        yearApprox=approx,
        datedByCapture=by_capture,
        commentCount=r["comments"],
        capturedAt=r["dated_at"] if not by_capture else r["capturedAt"],
        listPage=1,
    )


# ── Driver ───────────────────────────────────────────────────────────


def page_no_of(page: Path) -> int:
    """`page-3` and `page-3~20101019050413` are both page 3."""
    return int(page.stem.split("~")[0].split("-")[1])


def load_capture_index() -> tuple[dict[tuple[str, str], str], set[str], dict[tuple[str, str], str]]:
    """`{(board, file stem): ts}`, the boards whose pages came from forg.kr,
    and each capture's engine — from the list URL (`zboard.php` vs
    `bbs/board.php`), not the page body, since a members-only page carries
    neither. A board that moved engines (Trash: Zeroboard until 2010,
    Gnuboard4 after) has pages of both kinds."""
    plan = json.loads(PLAN_FILE.read_text(encoding="utf-8"))
    if MORE_PLAN_FILE.exists():
        plan += json.loads(MORE_PLAN_FILE.read_text(encoding="utf-8"))
    captures = {(e["board"], e["post_id"]): e["ts"] for e in plan}
    kr = {e["board"] for e in plan if re.match(r"https?://(www\.)?forg\.kr/", e["url"])}
    engines = {
        (e["board"], e["post_id"]): ("zeroboard" if "zboard.php" in e["url"] else "gnuboard4")
        for e in plan
    }
    return captures, kr, engines


def build_listing(
    board: str, pages: list[Path], captures: dict[tuple[str, str], str],
    engines: dict[tuple[str, str], str], *, kr: bool = False,
    extras: list[tuple[Path, str, int, str]] = (), report: dict | None = None,  # type: ignore[assignment]
    linked: list[tuple[str, list[dict]]] = (),  # type: ignore[assignment]
) -> BoardListing | None:
    gold, gold_nos = load_gold_years(board)
    merged: dict[str, dict] = {}
    total_reported: int | None = None
    engine_of_rows: dict[str, int] = {}
    newest_ts = ""
    page_nos: set[int] = set()
    captures_read = 0
    for page_path in pages:
        page_no = page_no_of(page_path)
        captured_at = captures.get((board, page_path.stem))
        if not captured_at:
            print(f"  WARN {board}/{page_path.stem}: no capture ts in plan, skipped", file=sys.stderr)
            continue
        page_nos.add(page_no)
        captures_read += 1
        engine = engines.get((board, page_path.stem), "zeroboard")
        rows, total = parse_page(page_path.read_text(encoding="utf-8"), engine)
        if rows:
            engine_of_rows[engine] = engine_of_rows.get(engine, 0) + len(rows)
        walk_page_years(rows, captured_at)
        if total is not None and captured_at > newest_ts:
            newest_ts, total_reported = captured_at, total
        for r in rows:
            prev = merged.get(r["no"])
            if prev is not None and prev["capturedAt"] >= captured_at:
                continue
            r.update(capturedAt=captured_at, listPage=page_no)
            merged[r["no"]] = r

    # Other captures' rows add the posts the list pages do not hold.
    extra: dict[str, dict] = {}
    extra_pages: set[int] = set()
    extra_read = 0
    extra_engines: dict[str, int] = {}
    for path, captured_at, page_no, kind in extras:
        rows = extra_rows(path.read_text(encoding="utf-8"), kind, board, captured_at)
        if not rows:
            continue
        extra_read += 1
        extra_pages.add(page_no)
        engine = "gnuboard4" if kind == "gnuboard4" else "zeroboard"
        extra_engines[engine] = extra_engines.get(engine, 0) + len(rows)
        for r in rows:
            prev = extra.get(r["no"])
            if prev is not None and prev["capturedAt"] >= captured_at:
                continue
            r.update(capturedAt=captured_at, listPage=page_no)
            extra[r["no"]] = r
    added = [no for no in extra if no not in merged]
    for no in added:
        merged[no] = extra[no]
    if report is not None:
        report["added"] = len(added)
    if not merged:
        return None
    if not page_nos:
        # A board known only from other captures: count those.
        page_nos, captures_read, engine_of_rows = extra_pages, extra_read, extra_engines

    entries: list[BoardListingEntry] = []
    for r in sorted(merged.values(), key=lambda x: int(x["no"]), reverse=True):
        created, approx = r["full_date"], False
        if created is None and r["month_day"]:
            created, approx = pin_year(
                int(r["no"]), r["month_day"][0], r["month_day"][1], r["page_year"],
                (datetime.strptime(r["capturedAt"], "%Y%m%d%H%M%S") + KST).date(), gold, gold_nos,
            )
        category, title = split_category(r["title"])
        try:
            entries.append(
                BoardListingEntry(
                    no=r["no"],
                    title=title or "(제목 없음)",
                    categoryLabel=category,
                    author=r["author"] or "anonymous",
                    authorMemberNo=r["member_no"],
                    createdAt=created,
                    yearApprox=approx,
                    hits=r["hits"],
                    commentCount=r["comments"],
                    isNotice=r["notice"],
                    replyDepth=r["reply"],
                    capturedAt=r["capturedAt"],
                    listPage=r["listPage"],
                    hasPost=(POSTS_DIR / board / f"{r['no']}.json").exists(),
                )
            )
        except ValidationError as e:
            print(f"  WARN {board} no={r['no']}: {e.errors()[0]['msg']}", file=sys.stderr)

    # Linked rows: the posts no list row and no gold post holds.
    gold_titles = load_gold_titles(board)
    held = set(merged) | {str(no) for no in gold_titles}
    found = date_linked(linked, held, known_dates(gold, gold_titles, merged))
    for no, r in found.items():
        try:
            entries.append(linked_entry(no, r))
        except ValidationError as e:
            print(f"  WARN {board} linked no={no}: {e.errors()[0]['msg']}", file=sys.stderr)
    if found:
        entries.sort(key=lambda e: int(e.no), reverse=True)
    if report is not None:
        report["linked"] = len(found)
    # The engine most rows came from — what the listing looks like.
    engine = max(engine_of_rows, key=engine_of_rows.get)  # type: ignore[arg-type]
    return BoardListing(
        board=f"kr_{board}" if kr else board,
        engine=engine,  # type: ignore[arg-type]
        pagesCaptured=len(page_nos),
        capturesRead=captures_read,
        totalReported=total_reported,
        generatedAt=datetime.now(timezone.utc),
        entries=entries,
    )


def dump_listing(listing: BoardListing) -> dict:
    """The listing JSON, with `replyDepth` written only on replies and
    `datedByCapture` only on the rows it marks."""
    data = json.loads(listing.model_dump_json())
    for e in data["entries"]:
        if not e.get("replyDepth"):
            e.pop("replyDepth", None)
        if not e.get("datedByCapture"):
            e.pop("datedByCapture", None)
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n", 1)[0])
    parser.add_argument("--board", default="", help="restrict to one board id")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not INPUT_DIR.is_dir():
        sys.exit(f"FATAL: {INPUT_DIR} not found — run the phase-L download and 01-decode first")
    captures, kr_boards, engines = load_capture_index()
    dirs = [d for root in (INPUT_DIR, MORE_DIR) if root.is_dir() for d in root.iterdir() if d.is_dir()]
    list_boards = {d.name for d in dirs}
    extras = load_extra_captures()
    # Only boards the museum holds: a list page's or a post's.
    extra_boards = {b for b in extras if b in list_boards or (POSTS_DIR / b).is_dir()}
    boards = sorted({b for b in list_boards | extra_boards if not args.board or b == args.board})
    linked = collect_linked(linked_sources(extras))
    stats = {"boards": 0, "entries": 0, "with_post": 0, "year_approx": 0, "no_date": 0, "added": 0, "linked": 0}
    for board in boards:
        pages = sorted(
            (p for d in dirs if d.name == board for p in d.glob("page-*.html")),
            key=lambda p: (page_no_of(p), p.stem),
        )
        report: dict = {}
        listing = build_listing(
            board, pages, captures, engines, kr=board in kr_boards,
            extras=extras.get(board, []) if board in extra_boards else [], report=report,
            # forg.kr reused names a 2001 board had (`notice`): its rows stay its own.
            linked=[] if board in kr_boards else linked.get(board, []),
        )
        if listing is None:
            print(f"  {board}: no rows in {len(pages)} page(s)", file=sys.stderr)
            continue
        stats["boards"] += 1
        stats["entries"] += len(listing.entries)
        stats["with_post"] += sum(e.hasPost for e in listing.entries)
        stats["year_approx"] += sum(e.yearApprox for e in listing.entries)
        stats["no_date"] += sum(e.createdAt is None for e in listing.entries)
        stats["added"] += report.get("added", 0)
        stats["linked"] += report.get("linked", 0)
        print(
            f"  {board:<16} pages={len(pages):>3} rows={len(listing.entries):>5} "
            f"from_other_captures={report.get('added', 0):>4} linked={report.get('linked', 0):>3} "
            f"with_post={sum(e.hasPost for e in listing.entries):>5} "
            f"total_reported={listing.totalReported}",
            file=sys.stderr,
        )
        if not args.dry_run:
            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            # forg.kr boards are registered under a `kr_` prefix (boards.ts).
            board_id = f"kr_{board}" if board in kr_boards else board
            out = OUTPUT_DIR / f"{board_id}.json"
            # Keep the previous stamp when nothing but the stamp would change,
            # so a re-run over the same pages leaves git quiet.
            now = dump_listing(listing)
            if out.exists():
                prev = json.loads(out.read_text(encoding="utf-8"))
                if {k: v for k, v in prev.items() if k != "generatedAt"} == {
                    k: v for k, v in now.items() if k != "generatedAt"
                }:
                    continue
            write_atomic(out, json.dumps(now, ensure_ascii=False, indent=2) + "\n")
    print(f"\n[02c-parse-listing] DONE {stats}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
