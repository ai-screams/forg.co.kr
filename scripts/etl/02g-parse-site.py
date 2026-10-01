#!/usr/bin/env python3
"""ETL Stage 2g — forg's static pages (guides, maps, frames) → page JSON.

The pages outside the boards were whole hand-made documents — layout
tables, background images, a menu down the side — opened in the site's
"detail" frame. They are kept as documents: each becomes
`src/content/pages/{stem}.json`, which the route `/site/[...path]` serves
back as a standalone HTML file under `/site/{stem}/`. Framesets are kept as
framesets with their frame names, so a menu link's `target="detail"` still
lands in the frame it was written for.

VERSIONS
    `cdx-site.py` plans one capture per (page, digest). `.htm` and `.html`
    of one stem are one page (the site renamed them in 2002). A version is
    `page`, `frameset`, `redirect` (a meta refresh and nothing else) or
    `empty`; the latest `page`/`frameset` version is shown, else the latest
    redirect. The rest are listed by date.

LINKS (resolved against the capture's own URL)
    forg page we emit           → /site/{stem}/
    board post / board          → /{board}/{no}/ when gold has it, else /{board}/
                                  (Zeroboard `zboard.php?id&no`, Gnuboard `bbs/board.php?bo_table&wr_id`)
    forg image                  → /img/posts/site/{path} once recovered,
                                  else the missing-image placeholder
                                  (`data-original-src` keeps the original)
    other forg URL              → its Wayback capture at the page's date
    `javascript:` popups        → the popup's URL, opened in a new window
    other hosts                 → unchanged

Scripts, event handlers and forms are dropped (nh3 allowlist below).

USAGE
    python3 scripts/etl/02g-parse-site.py [--dry-run]
"""
from __future__ import annotations

import argparse
import html
import importlib.util
import json
import re
import shutil
import sys
import urllib.parse
from collections import Counter
from datetime import datetime
from pathlib import Path

import nh3
from bs4 import BeautifulSoup

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
RESEARCH = PROJECT_ROOT / ".docs" / "research"
PLAN = RESEARCH / "cdx" / "site-plan.json"
RAW = RESEARCH / "cdx" / "site-html.json"
CLEAN = RESEARCH / "archive-clean" / "S"
POSTS = PROJECT_ROOT / "src" / "content" / "posts"
OUT = PROJECT_ROOT / "src" / "content" / "pages"
IMG_ROOT = PROJECT_ROOT / "public" / "img" / "posts" / "site"
BOARDS_TS = PROJECT_ROOT / "src" / "lib" / "boards.ts"
IMAGE_REFS = PROJECT_ROOT / "scripts" / "etl" / "site-image-refs.jsonl"
REPORT = PROJECT_ROOT / "scripts" / "etl" / ".parse-report-site.json"

FORG_HOSTS = {"forg.co.kr", "forg.dotple.com", "forg.uospace.net"}
# The site's last normal capture is 2016-08-20; from September the domain only
# redirects, and in 2023 someone else registered it (a parking page).
LAST_TS = "20160831235959"
MISSING_IMG = "/img/placeholder/missing.svg"
IMG_EXT = re.compile(r"\.(gif|jpe?g|png|bmp)$", re.I)
PAGE_EXT = re.compile(r"\.(?:html?|php)$", re.I)
BOARD_SCRIPT = re.compile(r"/(?:_zb|zboard|zb|~forg/zboard)/(?:zboard|view)\.php$")
# Link words that name a button, not the page behind it.
BUTTON_WORDS = {"click", "here", "more", "go", "back", "next", "prev", "list", "클릭", "여기", "더보기", "목록"}
# Pager links ("[2]", "[Prev]", "[all]") name a position in a list.
PAGER = re.compile(r"[\[{(]?\s*\+?\s*(?:\d+|prev|next|all|이전|다음)\s*\+?\s*[\]})]?", re.I)
GENERIC_TITLES = {"", "forg", "forg's world", "untitled", "무제 문서", "새 페이지 1"}
POPUP_RE = re.compile(r"""(?:na_open_window|window\.open|open_window)\s*\(\s*(?:'[^']*'\s*,\s*)?['"]([^'"]+)['"]""")
REFRESH_URL = re.compile(r"url\s*=\s*['\"]?([^'\";>]+)", re.I)

TAGS = {
    "p", "br", "b", "i", "u", "s", "strike", "strong", "em", "small", "big", "sup", "sub",
    "a", "img", "map", "area", "span", "div", "center", "font", "hr", "nobr",
    "table", "caption", "col", "colgroup", "tbody", "thead", "tfoot", "tr", "td", "th",
    "ul", "ol", "li", "dl", "dt", "dd", "blockquote", "pre", "code",
    "h1", "h2", "h3", "h4", "h5", "h6",
}  # fmt: skip
LAYOUT = {"align", "valign", "width", "height", "bgcolor", "background", "nowrap"}
ATTRS: dict[str, set[str]] = {
    "*": {"style", "class", "id", "title", "align"},
    "a": {"href", "target", "name"},
    "img": {"src", "alt", "width", "height", "border", "usemap", "hspace", "vspace",
            "align", "data-recovery", "data-original-src"},
    "map": {"name"},
    "area": {"shape", "coords", "href", "target", "alt"},
    "table": LAYOUT | {"border", "cellpadding", "cellspacing", "bordercolor",
                       "bordercolordark", "bordercolorlight"},
    "tr": LAYOUT, "td": LAYOUT | {"colspan", "rowspan"}, "th": LAYOUT | {"colspan", "rowspan"},
    "font": {"color", "size", "face"},
    "hr": {"size", "width", "noshade", "color"},
    "p": {"align"}, "div": {"align"},
    "ol": {"type", "start"}, "ul": {"type"}, "li": {"type", "value"},
}  # fmt: skip
BODY_STYLE = {"bgcolor": "background-color", "text": "color"}
FRAMESET_ATTRS = {"rows", "cols", "border", "frameborder", "framespacing", "bordercolor"}
FRAME_ATTRS = {"name", "scrolling", "noresize", "frameborder", "marginwidth",
               "marginheight", "border"}
# A rule is dropped for any of these. Backslash too: CSS escapes spell
# `url(` as `\75rl(`. Rules naming the museum bar would let a page hide it.
UNSAFE_CSS = re.compile(r"expression|javascript|behavior|@import|url\s*\(|\\|forg-museum-bar|in-frame",
                        re.I)
# The same test for inline `style` attributes, which nh3 passes through.
UNSAFE_STYLE_ATTR = re.compile(r'\sstyle="[^"]*(?:expression|javascript|behavior|url\s*\(|\\)[^"]*"', re.I)
LOCAL_OR_WEB_URL = re.compile(r"(?:/(?!/)|#|https?://)[^\s<>\"'`]*")
FRAME_NAME = re.compile(r"[A-Za-z0-9_]+")


# ── plan ──────────────────────────────────────────────────────────────────


def stem_of(page: str) -> str:
    """`/Diablo/uarmor.htm` → `Diablo/uarmor`; `/` → `index`; `/holy/` → `holy/index`.

    A query that selects content becomes part of the stem: the guild
    directory pages with `?page=2` and filters with `?mode=search&shard=1`
    (`_zb/guild/index--mode-search--shard-1`). Empty parameters and the
    session id are dropped and the rest sorted, so every spelling of one
    view — as captured and as linked — gets one stem."""
    path_part, _, query = page.partition("?")
    path = urllib.parse.unquote(path_part).lstrip("/")
    if not path or path.endswith("/"):
        path += "index"
    stem = PAGE_EXT.sub("", path)
    params = sorted((k, v) for k, v in urllib.parse.parse_qsl(query) if v and k != "PHPSESSID")
    if params:
        stem += "".join(f"--{k}-{v}" for k, v in params)
    return stem


def safe_stem(stem: str) -> bool:
    return all(re.fullmatch(r"[A-Za-z0-9._-]+", seg) and seg not in {".", ".."}
               for seg in stem.split("/"))


def forg_hosted_pages() -> set[str]:
    """Page keys captured at least once on forg's own domains. The plan keeps
    one capture per content version — the earliest, often the other host's —
    so this is asked of the raw CDX rows."""
    pages: set[str] = set()
    for _ts, original, *_ in json.loads(RAW.read_text()):
        host = (urllib.parse.urlsplit(original).hostname or "").lower().removeprefix("www.")
        if host in FORG_HOSTS:
            pages.add(CDX_SITE.page_key(original))
    return pages


def last_seen() -> dict[tuple[str, str], str]:
    """Latest capture timestamp of each (page, digest).

    The plan downloads each digest once, at its first capture. A page that
    went A → B → A is still showing A last, so versions are ordered by when
    each digest was last seen, not first."""
    seen: dict[tuple[str, str], str] = {}
    cdx_site = CDX_SITE
    for ts, original, _st, _mt, _length, digest in json.loads(RAW.read_text()):
        if ts > LAST_TS:
            continue
        key = (cdx_site.page_key(original), digest)
        seen[key] = max(seen.get(key, ts), ts)
    return seen


def _cdx_site():
    spec = importlib.util.spec_from_file_location("cdx_site", Path(__file__).parent / "cdx-site.py")
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


CDX_SITE = _cdx_site()


def load_versions() -> dict[str, list[dict]]:
    by_stem: dict[str, list[dict]] = {}
    seen = last_seen()
    for e in json.loads(PLAN.read_text()):
        stem = stem_of(e["page"])
        # The guild directory's edit screens are input forms; with the form
        # removed only the field labels remain.
        if not safe_stem(stem) or e["ts"] > LAST_TS or "--mode-edit" in stem:
            continue
        f = CLEAN / e["board"] / f"{e['post_id']}.html"
        if f.exists():
            shown_ts = seen.get((e["page"], e["digest"]), e["ts"])
            by_stem.setdefault(stem, []).append({**e, "file": f, "shown_ts": shown_ts})
    for vs in by_stem.values():
        vs.sort(key=lambda v: v["shown_ts"])
    return by_stem


def original_path(v: dict, forg_pages: set[str]) -> str:
    """The address readers knew: the path on forg's own domains, or host and
    path for a page only the other host had (whose `page` is the museum
    path). A page on both shows the forg path even when the shown capture —
    the same content — came from the other host."""
    if v["page"] in forg_pages:
        return v["page"]
    u = urllib.parse.urlsplit(v["url"])
    host = (u.hostname or "").lower().removeprefix("www.")
    query = f"?{u.query}" if u.query else ""
    return f"{host}{u.path}{query}"


def iso(ts: str) -> str:
    return datetime.strptime(ts, "%Y%m%d%H%M%S").isoformat()


# ── classification ────────────────────────────────────────────────────────


def classify(soup: BeautifulSoup) -> str:
    if soup.find("frameset"):
        return "frameset"
    body = soup.body or soup
    text = body.get_text(" ", strip=True)
    refresh = soup.find("meta", attrs={"http-equiv": re.compile("refresh", re.I)})
    if (refresh and len(text) < 40 and not body.find(["img", "table"])
            and len(body.find_all("a")) <= 1):
        return "redirect"
    if len(text) < 2 and not body.find(["img", "table"]):
        return "empty"
    # The guild directory kept serving a deleted guild's detail page with
    # every field blank ("Date : ID :"); an earlier capture holds the entry.
    if "Guild Detail Info" in text and re.search(r"Date\s*:\s*ID\s*:\s*(?:\[\s*\])?\s*길드마스터", text):
        return "empty"
    return "page"


# ── link resolution ───────────────────────────────────────────────────────


class Resolver:
    def __init__(self, stems: set[str], boards: set[str]):
        self.stems = stems
        self.boards = boards
        self.image_refs: dict[str, dict] = {}

    @staticmethod
    def forg_path(absolute: str) -> tuple[bool, urllib.parse.SplitResult]:
        """(is ours, URL with the museum path) — a mirrored folder on another
        host (`cdx-site.MIRRORS`) counts as ours under its museum path."""
        u = urllib.parse.urlsplit(absolute)
        host = (u.hostname or "").lower().removeprefix("www.")
        mirrored = CDX_SITE.mirror_path(host, u.path)
        if mirrored is not None:
            return True, u._replace(path=mirrored)
        return host in FORG_HOSTS, u

    def image(self, raw: str, base: str, ts: str, page: str) -> tuple[str, str | None]:
        """(src, original) — original is set when the image is not recovered."""
        absolute = urllib.parse.urljoin(base, raw.strip())
        is_forg, u = self.forg_path(absolute)
        if not is_forg or not IMG_EXT.search(u.path):
            # A relative src left as-is would point into the museum's own
            # site once the page is served from /site/.
            if urllib.parse.urlsplit(raw.strip()).scheme not in ("http", "https"):
                return MISSING_IMG, absolute
            return raw, None
        rel = urllib.parse.unquote(u.path).lstrip("/")
        if not safe_stem(rel):
            return MISSING_IMG, absolute
        self.image_refs.setdefault(rel, {"path": rel, "url": absolute, "ts": ts, "page": page})
        if (IMG_ROOT / rel).is_file():
            return f"/img/posts/site/{rel}", None
        return MISSING_IMG, absolute

    def link(self, raw: str, base: str, ts: str, page: str) -> tuple[str | None, bool]:
        """(href, new_window). None drops the href."""
        raw = raw.strip()
        if raw.lower().startswith("javascript:"):
            m = POPUP_RE.search(raw)
            if not m:
                return None, False
            href, _ = self.link(m.group(1), base, ts, page)
            return href, True
        if raw.startswith("#") or raw.lower().startswith("mailto:"):
            return raw, False
        absolute = urllib.parse.urljoin(base, raw)
        is_forg, u = self.forg_path(absolute)
        if not is_forg:
            # A relative link from a mirrored page points into the other
            # host's archive, not at the museum: send it to its capture.
            scheme = urllib.parse.urlsplit(raw).scheme
            if scheme in ("http", "https"):
                return raw, False
            if scheme:  # data:, vbscript:, … — nothing to link to
                return None, False
            return f"https://web.archive.org/web/{ts}/{absolute}", False
        frag = f"#{u.fragment}" if u.fragment else ""
        g4 = u.path == "/bbs/board.php"
        if BOARD_SCRIPT.search(u.path) or g4:
            q = urllib.parse.parse_qs(u.query)
            board = (q.get("bo_table" if g4 else "id") or [""])[0]
            no = (q.get("wr_id" if g4 else "no") or [""])[0]
            if board in self.boards:
                if no.isdigit() and (POSTS / board / f"{no}.json").exists():
                    return f"/{board}/{no}/", False
                return f"/{board}/", False
        if IMG_EXT.search(u.path):
            src, _ = self.image(absolute, base, ts, page)
            if src != MISSING_IMG:
                return src, False
        stem = stem_of(f"{u.path}?{u.query}" if u.query else u.path)
        if (PAGE_EXT.search(u.path) or u.path.endswith("/") or not u.path) and stem in self.stems:
            return f"/site/{stem}/{frag}", False
        return f"https://web.archive.org/web/{ts}/{absolute}", False


# ── rendering ─────────────────────────────────────────────────────────────


def head_css(soup: BeautifulSoup) -> str:
    css = []
    for style in soup.find_all("style"):
        text = style.get_text()
        text = re.sub(r"<!--|-->", "", text)
        rules = [r for r in re.findall(r"[^{}]+\{[^{}]*\}", text) if not UNSAFE_CSS.search(r)]
        css.extend(r.strip() for r in rules)
    return "\n".join(css)


def body_style(body, resolver: Resolver, base: str, ts: str, page: str) -> dict:
    out: dict[str, str] = {}
    if body is None:
        return out
    for attr, prop in BODY_STYLE.items():
        v = body.get(attr)
        if v and re.fullmatch(r"#?[0-9A-Za-z]+", v.strip()):
            out[prop] = v.strip()
    bg = body.get("background")
    if bg:
        src, _ = resolver.image(bg, base, ts, page)
        if src.startswith("/img/posts/site/") and safe_url(src):
            out["background-image"] = f"url('{src}')"
    for attr in ("link", "vlink", "alink"):
        v = body.get(attr)
        if v and re.fullmatch(r"#?[0-9A-Za-z]+", v.strip()):
            out[f"--{attr}"] = v.strip()
    return out


def unroll_slideshow(soup: BeautifulSoup) -> bool:
    """The cartoon viewer (`lomo`) put every panel in one table row, hid all
    but a "Loading..." cell and let a script show one panel per click. With
    scripts gone nothing would show, so the panels are unhidden and stacked
    one per row, with a line saying how the original worked."""
    panels = soup.find_all("table", id=re.compile(r"^lomoimg\d+$"))
    if not panels:
        return False
    for t in panels:
        if t["id"] == "lomoimg0":  # the "Loading..." placeholder
            cell = t.find_parent("td")
            (cell or t).decompose()
            continue
        t["style"] = re.sub(r"display\s*:\s*none;?", "", t.get("style", ""))
    cells = [t.find_parent("td") for t in soup.find_all("table", id=re.compile(r"^lomoimg\d+$"))]
    row = cells[0].find_parent("tr") if cells and cells[0] else None
    if row is not None:
        for cell in cells[1:]:
            if cell is None:
                continue
            tr = soup.new_tag("tr", attrs={"valign": "top"})
            row.insert_after(tr)
            row = tr
            tr.append(cell.extract())
    note = soup.new_tag("p", attrs={"style": "color:#8c8c8c;font-size:11px"})
    note.string = "원래는 그림을 누르면 다음 칸으로 넘어가는 슬라이드였습니다. 박물관에서는 모든 칸을 차례로 보여 줍니다."
    panels_table = cells[0].find_parent("table") if cells and cells[0] else None
    if panels_table is not None:
        panels_table.insert_before(note)
    return True


# Seven town maps (Britain, Jhelom, Magincia, Minoc, Moonglow, Trinsic, Vesper)
# print every coordinate as `(0?5'S 5?0'E)`: the byte is a literal 0x3F in
# every capture from 2001 to 2007, so the file itself lost the degree sign
# when it was saved. The other towns carry a real `°` (KS X 1001 0xA1C6).
# Only a `?` between a digit and `[minutes]'N|S|E|W` is replaced; no page
# outside map/ has that shape.
DEGREE_LOST = re.compile(r"(?<=\d)\?(?=\d*'\s?[NSEW])")


def restore_degree_signs(soup: BeautifulSoup) -> int:
    n = 0
    for node in soup.find_all(string=DEGREE_LOST):
        fixed, k = DEGREE_LOST.subn("°", str(node))
        node.replace_with(fixed)
        n += k
    return n


def rewrite(soup: BeautifulSoup, resolver: Resolver, base: str, ts: str, page: str) -> None:
    for el in soup.find_all(True):
        for attr in [a for a in el.attrs if a.lower().startswith("on")]:
            del el[attr]
    for img in soup.find_all("img"):
        if img.get("src"):
            src, original = resolver.image(img["src"], base, ts, page)
            img["src"] = src
            if original:
                img["data-recovery"] = "missing"
                img["data-original-src"] = original
    for el in soup.find_all(attrs={"background": True}):
        src, _ = resolver.image(el["background"], base, ts, page)
        if src == MISSING_IMG:
            del el["background"]
        else:
            el["background"] = src
    for a in soup.find_all(["a", "area"]):
        if not a.get("href"):
            continue
        href, new_window = resolver.link(a["href"], base, ts, page)
        if href is None:
            del a["href"]
            continue
        a["href"] = href
        if new_window or href.startswith("https://web.archive.org/"):
            a["target"] = "_blank"


def safe_url(href: str | None) -> str | None:
    """Frames and redirects skip nh3, so their URLs are checked here: a local
    path, a fragment or http(s), with no whitespace or control characters
    anywhere (a browser drops them, turning `java\nscript:` into a scheme)."""
    if not href or re.search(r"[\x00-\x20\x7f]", href):
        return None
    return href if LOCAL_OR_WEB_URL.fullmatch(href) else None


def base_target(soup: BeautifulSoup) -> str | None:
    """`<base target="detail">` sends every link to the frame it names."""
    base = soup.find("base", target=True)
    t = base["target"].strip() if base else ""
    return t if FRAME_NAME.fullmatch(t) else None


def frameset_html(soup: BeautifulSoup, resolver: Resolver, base: str, ts: str, page: str) -> str:
    def walk(node) -> str:
        if node.name == "frameset":
            attrs = "".join(f' {k}="{html.escape(str(v))}"' for k, v in node.attrs.items()
                            if k.lower() in FRAMESET_ATTRS)
            inner = "".join(walk(c) for c in node.find_all(["frameset", "frame"], recursive=False))
            return f"<frameset{attrs}>{inner}</frameset>"
        attrs = "".join(f' {k}="{html.escape(str(v))}"' for k, v in node.attrs.items()
                        if k.lower() in FRAME_ATTRS)
        href, _ = resolver.link(node.get("src", ""), base, ts, page) if node.get("src") else (None, False)
        href = safe_url(href)
        src = f' src="{html.escape(href)}"' if href else ""
        return f"<frame{attrs}{src}>"
    return walk(soup.find("frameset"))


def own_title(soup: BeautifulSoup) -> str:
    t = soup.title.get_text(strip=True) if soup.title else ""
    return re.sub(r"^[:.\s]+|[:.\s]+$", "", t)


def title_of(soup: BeautifulSoup, link_titles: dict[str, str], stem: str,
             shared: set[str]) -> str:
    t = own_title(soup)
    if (t.lower() not in GENERIC_TITLES and t not in shared
            and not re.fullmatch(r"forg[':.\s\w]*", t, re.I)):
        return t
    if stem in link_titles:
        return link_titles[stem]
    # A guild detail page names its guild in the heading cell (the list
    # pages use the same class for every row).
    heading = soup.find("b", class_="li2") if "Guild Detail Info" in soup.get_text() else None
    if heading and heading.get_text(strip=True):
        return heading.get_text(strip=True)
    # A query view takes the title of the same script's view with the fewest
    # parameters that shares its `id` (the board or the guild), plus its page.
    base, sep, _ = stem.partition("--")
    if sep:
        board = re.search(r"--id-[^-]+(?:-[^-]+)*?(?=--|$)", stem)
        def same_view(s: str, prefix: str) -> bool:
            return (s == prefix or s.startswith(prefix + "--")) and (
                not board or board.group(0) in s or s == prefix)
        candidates = [s for s in link_titles if same_view(s, base)]
        if not candidates:
            # The same board under the site's other script folder
            # (`/zboard/` in 2001, `/zb/` in 2002).
            name = base.rsplit("/", 1)[-1]
            candidates = [s for s in link_titles if same_view(s.rsplit("/", 1)[-1], name)
                          and s.rsplit("/", 1)[-1].startswith(name)]
        if candidates:
            best = min(candidates, key=lambda s: (s.count("--"), s))
            page = re.search(r"--page-(\d+)", stem)
            return f"{link_titles[best]} ({page.group(1)}쪽)" if page else link_titles[best]
    return stem.rsplit("/", 1)[-1]


def collect_link_titles(all_versions: list[tuple[dict, BeautifulSoup]]) -> dict[str, str]:
    """A page's name as the site's own links gave it.

    First choice is the link's `title` (`title="젬"` on an image button),
    then the link's own words (at most 40 characters — longer is a sentence,
    not a name). Read from every version, not only the ones shown: the 2002
    left frame names pages its 2007 successor no longer links. A page linked
    under several names takes the one used most often, links on forg's own
    domains outweighing the older host's."""
    by_title: dict[str, Counter[str]] = {}
    by_text: dict[str, Counter[str]] = {}
    for v, soup in all_versions:
        # forg's own domains name a page first; the older host only fills gaps.
        host = (urllib.parse.urlsplit(v["url"]).hostname or "").lower().removeprefix("www.")
        weight = 100 if host in FORG_HOSTS else 1
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            popup = POPUP_RE.search(href) if href.lower().startswith("javascript:") else None
            if href.lower().startswith("javascript:") and not popup:
                continue
            absolute = urllib.parse.urljoin(v["url"], popup.group(1) if popup else href)
            is_forg, u = Resolver.forg_path(absolute)
            if not is_forg:
                continue
            stem = stem_of(f"{u.path}?{u.query}" if u.query else u.path)
            label = re.sub(r"^[:.\s\-·▶►]+|[:.\s\-·]+$", "", a.get("title", "")).strip()
            if label and label.lower() not in BUTTON_WORDS and not PAGER.fullmatch(label):
                by_title.setdefault(stem, Counter())[label] += weight
            text = re.sub(r"\s+", " ", a.get_text(" ", strip=True))
            text = re.sub(r"^[:.\s\-·▶►]+|[:.\s\-·]+$", "", text).strip()
            if 1 < len(text) <= 40 and text.lower() not in BUTTON_WORDS and not PAGER.fullmatch(text):
                by_text.setdefault(stem, Counter())[text] += weight
    chosen: list[dict[str, str]] = []
    for votes in (by_text, by_title):
        # A label that is the leading name of three or more pages in one
        # folder names a section or a button ("Click", ":::Monster_Diary:::"
        # on every monster), not the page. It is struck from every page of
        # that folder before each page picks, so a page's own second name can
        # still win. Counted per folder: "아머" names one page in Diablo/ and
        # another in Diablo2/.
        leading = Counter((stem.rpartition("/")[0], c.most_common(1)[0][0])
                          for stem, c in votes.items())
        picked: dict[str, str] = {}
        for stem, c in votes.items():
            folder = stem.rpartition("/")[0]
            left = [(label, n) for label, n in c.most_common() if leading[(folder, label)] < 3]
            if left:
                picked[stem] = left[0][0]
        chosen.append(picked)
    return {**chosen[0], **chosen[1]}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    boards = set(re.findall(r'^\s*id: "([^"]+)"', BOARDS_TS.read_text(), re.M))
    by_stem = load_versions()
    forg_pages = forg_hosted_pages()

    chosen: dict[str, tuple[dict, BeautifulSoup]] = {}
    history: dict[str, list[dict]] = {}
    every: list[tuple[dict, BeautifulSoup]] = []
    for stem, versions in by_stem.items():
        kinds = []
        for v in versions:
            soup = BeautifulSoup(v["file"].read_text(errors="replace"), "lxml")
            kind = classify(soup)
            kinds.append((v, soup, kind))
            every.append((v, soup))
        shown = [k for k in kinds if k[2] in ("page", "frameset")] or \
                [k for k in kinds if k[2] == "redirect"]
        if not shown:
            continue
        v, soup, kind = shown[-1]
        v = {**v, "kind": kind}
        chosen[stem] = (v, soup)
        history[stem] = [{"capturedAt": iso(k[0]["shown_ts"]), "kind": k[2]} for k in kinds]

    resolver = Resolver(set(chosen), boards)
    link_titles = collect_link_titles(every)
    title_counts: dict[str, int] = {}
    for _v, soup in chosen.values():
        t = own_title(soup)
        title_counts[t] = title_counts.get(t, 0) + 1
    shared = {t for t, n in title_counts.items() if n >= 3}
    stats: dict[str, int] = {}
    docs = {}
    for stem, (v, soup) in sorted(chosen.items()):
        base, ts, kind = v["url"], v["ts"], v["kind"]
        # A `<base href>` would move every relative link; none of the
        # captures has one (they only set `target`), but honour it anyway.
        base_el = soup.find("base", href=True)
        if base_el:
            base = urllib.parse.urljoin(base, base_el["href"])
        doc = {
            "stem": stem,
            "originalPath": original_path(v, forg_pages),
            "originalUrl": base,
            "kind": kind,
            "title": title_of(soup, link_titles, stem, shared),
            "capturedAt": iso(v["shown_ts"]),
            "versions": history[stem],
            "css": "",
            "bodyStyle": {},
            "html": "",
            "redirectTo": None,
            "baseTarget": base_target(soup),
        }
        if kind == "frameset":
            doc["html"] = frameset_html(soup, resolver, base, ts, stem)
        elif kind == "redirect":
            meta = soup.find("meta", attrs={"http-equiv": re.compile("refresh", re.I)})
            m = REFRESH_URL.search(meta.get("content", "")) if meta else None
            href = resolver.link(m.group(1), base, ts, stem)[0] if m else None
            doc["redirectTo"] = safe_url(href)
        else:
            # Before `rewrite`, which turns the body's own background into a
            # museum path that would then be resolved a second time.
            doc["bodyStyle"] = body_style(soup.body, resolver, base, ts, stem)
            unroll_slideshow(soup)
            stats["degree_signs"] = stats.get("degree_signs", 0) + restore_degree_signs(soup)
            rewrite(soup, resolver, base, ts, stem)
            doc["css"] = head_css(soup)
            inner = soup.body.decode_contents() if soup.body else str(soup)
            cleaned = nh3.clean(inner, tags=TAGS, attributes=ATTRS,
                                url_schemes={"http", "https", "mailto"}, link_rel=None)
            doc["html"] = UNSAFE_STYLE_ATTR.sub("", cleaned)
        docs[stem] = doc
        stats[kind] = stats.get(kind, 0) + 1

    stats["pages"] = len(docs)
    stats["image_refs"] = len(resolver.image_refs)
    stats["images_recovered"] = sum(1 for r in resolver.image_refs if (IMG_ROOT / r).is_file())
    print(f"[02g-site] {json.dumps(stats)}", file=sys.stderr)
    if args.dry_run:
        return

    if OUT.exists():
        shutil.rmtree(OUT)
    for stem, doc in docs.items():
        f = OUT / f"{stem}.json"
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
    with IMAGE_REFS.open("w") as fh:
        for ref in sorted(resolver.image_refs.values(), key=lambda r: r["path"]):
            fh.write(json.dumps(ref, ensure_ascii=False) + "\n")
    REPORT.write_text(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
