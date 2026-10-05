#!/usr/bin/env python3
"""ETL Stage 2e — Zeroboard "link" and "diary" skins: list pages that carry whole posts.

Two forg boards ran skins that print every post in full on the list page
instead of a row per post: `Recall` (skin/link — a UO link directory:
title, URL, date, hits, description) and the BOD trade boards `bod_b_s`,
`bod_b_t`, `bod_s_s`, `bod_s_t` (skin/zetyx_diary_Esee). No view page of
theirs was ever captured, so the list page is the post. Reads every list
capture of the board in `.docs/research/archive-clean/`: `L/{board}/page-N.html`
(one per page), `L2/{board}/page-N~TS.html` (every other distinct capture)
and `LZ/{board}/*.html` (the Zeroboard 4.0 install's own list pages), and
writes gold `src/content/posts/{board}/{no}.json` like Stage 2 does
(ADR-0017 §4). A post shown on several captures is taken from the newest
one that dates it.

ENTRY SHAPE (both skins)
    <!--<input type=checkbox name=cart value="NO">-->   post number
    <b>title</b> … Date : <span title="YYYY년 MM월 DD일 HH시 MM분 SS초">
    body: the first `<td style="word-break:break-all…">` after the header
    link skin adds   hit_plus.php?sitelink=URL&category=N   and  Hit : N
    diary skin adds  <font color="#9f9f9f">[category]</font> — the poster's id,
                     by the board's own rules

Authors: the link skin prints none (an admin-curated directory) → "Forg",
the site owner's account; the diary skin's category is the poster.

USAGE
    python3 scripts/etl/02e-parse-link-diary.py [--board ID] [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
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
    "Recall": "link",
    "bod_b_s": "diary",
    "bod_b_t": "diary",
    "bod_s_s": "diary",
    "bod_s_t": "diary",
}

_CART_RE = re.compile(r'name="?cart"? value="(\d+)"')
_DATE_TITLE_RE = re.compile(r"(\d{4})년 (\d{2})월 (\d{2})일 (\d{2})시 (\d{2})분 (\d{2})초")
_SITELINK_RE = re.compile(r"sitelink=([^&]+)")
_HIT_RE = re.compile(r"Hit\s*:\s*([\d,]+)")
_VISIT_RE = re.compile(r"Visit\s*:\s*([\d,]+)")
_FILENUM_RE = re.compile(r"download\.php\?[^\"']*filenum=(\d+)")
_SIZE_RE = re.compile(r"Size\s*:\s*([\d.,]+)\s*(KB|MB|GB|B)", re.I)
_DOWNLOADS_RE = re.compile(r"Download\s*:\s*([\d,]+)")


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


def better(prev: dict | None, e: dict) -> bool:
    """Whether `e` should replace `prev` for the same post: a capture that
    dates the post beats one that does not (some captures print a bare `*`
    with no date in the post's place), then the newer capture wins, as a
    post's title was sometimes edited later."""
    if prev is None:
        return True
    if (e["created"] is None) != (prev["created"] is None):
        return e["created"] is not None
    return e["capturedAt"] > prev["capturedAt"]


def _entries(soup: BeautifulSoup) -> list[Tag]:
    """The `<td>` holding each entry's header (title + cart comment)."""
    out: list[Tag] = []
    for c in soup.find_all(string=lambda s: isinstance(s, Comment) and "name=" in s and "cart" in s):
        td = c.find_parent("td")
        if isinstance(td, Tag) and _CART_RE.search(str(c)):
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
    return {
        "no": no, "title": title, "author": "Forg", "member_no": "1",
        "category": category, "created": created, "hits": hits, "body": body,
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


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n", 1)[0])
    parser.add_argument("--board", default="")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    captures, page_cats = _capture_index()
    now = datetime.now(timezone.utc)
    stats = {"pages": 0, "entries": 0, "written": 0, "skipped_existing": 0, "undated": 0, "errors": 0}
    for board, skin in BOARDS.items():
        if args.board and board != args.board:
            continue
        pages = [p for phase in PHASE_PLANS for p in sorted((CLEAN_DIR / phase / board).glob("*.html"))]
        seen: dict[str, dict] = {}
        cat_names: dict[str, str] = {}
        for page_path in pages:
            key = (page_path.parent.parent.name, board, page_path.stem)
            captured_at = captures.get(key)
            if not captured_at:
                print(f"  WARN {'/'.join(key)}: no capture ts, skipped", file=sys.stderr)
                continue
            stats["pages"] += 1
            soup = BeautifulSoup(page_path.read_text(encoding="utf-8"), "lxml")
            if skin == "link":
                cat_names.update(link_categories(soup))
            page_cat = page_cats.get(key)
            for header_td in _entries(soup):
                try:
                    e = parse_link_entry(header_td, captured_at) if skin == "link" else parse_diary_entry(header_td, captured_at)
                except Exception as exc:  # noqa: BLE001
                    stats["errors"] += 1
                    print(f"  ERROR {board}/{page_path.stem}: {type(exc).__name__}: {exc}", file=sys.stderr)
                    continue
                if skin == "link":
                    e["category"] = e["category"] or page_cat
                e["capturedAt"] = captured_at
                e["origin"] = origin_of(key[0], page_path.stem)
                stats["entries"] += 1
                if better(seen.get(e["no"]), e):
                    seen[e["no"]] = e
        for no, e in seen.items():
            if e["created"] is None:
                # No capture dates it (the 2006 file-library skin printed
                # none): a 1970 post would be the empty shell again.
                stats["undated"] += 1
                print(f"  SKIP {board}/{no}: no capture dates it", file=sys.stderr)
                continue
            if skin == "link" and e["category"]:
                # Number → name from whichever page listed it as a link.
                e["category"] = cat_names.get(e["category"], e["category"])
            out = OUTPUT_DIR / board / f"{no}.json"
            if out.exists():
                stats["skipped_existing"] += 1
                continue
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
                    originalUrl=f"{e['origin']}?id={board}&no={no}",
                    sourceEngine="zeroboard",
                )
            except ValidationError as exc:
                stats["errors"] += 1
                print(f"  ERROR {board}/{no}: {exc.errors()[0]['msg']}", file=sys.stderr)
                continue
            if args.dry_run:
                print(f"  {board}/{no} {post.createdAt.date()} [{post.categoryLabel}] {post.author}: {post.title[:40]}", file=sys.stderr)
                stats["written"] += 1
                continue
            write_atomic(out, post.model_dump_json(indent=2) + "\n")
            stats["written"] += 1
    print(f"\n[02e-parse-link-diary] DONE {stats}", file=sys.stderr)
    # Like the other parsers: a run that could not parse or validate
    # something exits 1, so a chained command stops on it.
    return 1 if stats["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
