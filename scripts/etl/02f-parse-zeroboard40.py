#!/usr/bin/env python3
"""Stage 2f: Zeroboard 4.0 posts from forg's 2001–2002 board paths → gold JSON.

Before `/_zb/` (Zeroboard 4.1, the `kritz_*` skins `02-parse-zeroboard.py`
reads), forg ran Zeroboard 4.0 at three other addresses, all on the same
database — a post present at two of them carries the same id, title and
author:

| phase | served from                     | years     |
| ----- | ------------------------------- | --------- |
| Z     | forg.co.kr/zboard/              | 2001      |
| Y     | forg.co.kr/zb/                  | 2002      |
| U     | forg.uospace.net/zb/            | 2001–2002 |
| T     | forg.co.kr/~forg/zboard/        | 2001      |

No CDX sweep before 2026-09-25 asked for those paths, so their posts were
never downloaded (`.docs/research/cdx/oldpaths-plan.json`, `uospace-plan.json`).

Each board wore its own skin (`pink`, `y`, `skyblue`, `board`, `n_board`, …),
but Zeroboard 4.0 itself writes the same scaffolding around every one: the
header rows are labelled `Name` / `Subject`, the body sits in a
`word-break:break-all;padding:10px` cell, and the comments open with
`<!-- 간단한 답글 시작하는 부분 -->`. This parser reads that scaffolding
rather than one skin. `n_board` drops the labels (bold title, `name_head.gif`
before the author) and is handled as its own case.

A 4.0 view shows no date for the post or its comments. The post's date comes
from the board list Zeroboard prints under every view: each row carries
`title='2001년 09월 18일 17시 53분 02초'`, and the rows of every downloaded
capture are pooled, so a post whose own capture lists a different page can
still be dated from another capture's list. Failing that, the date a merged
list page gave the index row is used; failing both, the 1970 sentinel the
site renders as "작성일 미상". Comment dates were never printed and take the
sentinel too.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup, Tag
from pydantic import ValidationError

from schemas import Attachment, Comment, Post
from sanitise import sanitise_html

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
INPUT_BASE = PROJECT_ROOT / ".docs" / "research" / "archive-clean"
OUTPUT_DIR = PROJECT_ROOT / "src" / "content" / "posts"
INDEX_DIR = PROJECT_ROOT / "src" / "content" / "boards"
PROGRESS_FILE = PROJECT_ROOT / ".docs" / "research" / "archive" / ".progress.jsonl"
FAILURES_FILE = PROJECT_ROOT / "scripts" / "etl" / ".parse-failures-zb40.jsonl"
QUARANTINE_FILE = PROJECT_ROOT / "scripts" / "etl" / ".quarantine-ip-zb40.tsv"

ORIGIN_BY_PHASE = {
    "Z": "http://forg.co.kr/zboard/zboard.php",
    "Y": "http://forg.co.kr/zb/zboard.php",
    "U": "http://forg.uospace.net/zb/zboard.php",
    "T": "http://forg.co.kr/~forg/zboard/zboard.php",
}
UNKNOWN_DATE = datetime(1970, 1, 1)

# Reuse the 4.1 parser's attachment reader and category split: the
# `download.php?…&filenum=N` link and the `[말머리]` title prefix are the same
# in 4.0.
_spec = importlib.util.spec_from_file_location(
    "zb41", Path(__file__).with_name("02-parse-zeroboard.py")
)
assert _spec and _spec.loader
zb41 = importlib.util.module_from_spec(_spec)
sys.modules["zb41"] = zb41
_spec.loader.exec_module(zb41)

_NON_POST_MARKERS: tuple[tuple[str, str], ...] = (
    ("사용권한이 없습니다", "permission_denied"),
    ("생성되지 않은 게시판", "board_not_created"),
    ("멤버 리스트를 볼 수 있는 권한", "member_list"),
    ("skin/linuz_members/", "member_list"),
    ("DB 접속시 에러", "db_error_at_capture"),
    ("선택하신 게시물이 존재하지 않습니다", "deleted_before_capture"),
    ("skin/vote/", "poll_page"),
)
# Zeroboard's own section delimiters are HTML comments; matching the words
# alone would also match a post or comment that happens to contain them.
COMMENTS_START_RE = re.compile(r"<!--\s*간단한 답글 시작하는 부분\s*-->")
COMMENTS_END_RE = re.compile(r"<!--\s*(?:간단한 답변글 쓰기|이전 / 다음글 출력|목록 부분 시작)\s*-->")
LIST_START_RE = re.compile(r"<!--\s*목록 부분 시작\s*-->")
_IP_LINE_RE = re.compile(r"^\s*IP\b", re.I)
_IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_BODY_CELL_RE = re.compile(r"break-all.*padding:\s*10px", re.I)
_ROW_DATE_RE = re.compile(r"^(\d{4})년 (\d\d)월 (\d\d)일 (\d\d)시 (\d\d)분 (\d\d)초$")


class NonPost(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def _text(tag: Tag | None) -> str:
    if not isinstance(tag, Tag):
        return ""
    return tag.get_text(" ", strip=True).replace("\xa0", " ").strip()


def _label(td: Tag) -> str:
    return re.sub(r"\s+", "", _text(td))


# ── dates ───────────────────────────────────────────────────────────────


def list_row_dates(html: str) -> dict[tuple[str, str], datetime]:
    """(board, no) → timestamp for every row of the list printed under a view.

    Each date element is paired with a view link whose nearest `<tr>` is the
    date's own nearest `<tr>`, so a layout table inside a row neither hides
    the row nor lends it another row's date. The board and number come from
    the link's query; the time from a `title` attribute that is nothing but
    the timestamp. A date that does not exist (`13월`) drops that row only.
    """
    out: dict[tuple[str, str], datetime] = {}
    m = LIST_START_RE.search(html)
    if not m:
        return out
    soup = BeautifulSoup(html[m.end() :], "lxml")
    for el in soup.find_all(title=_ROW_DATE_RE):
        if not isinstance(el, Tag):
            continue
        row = el.find_parent("tr")
        if not isinstance(row, Tag):
            continue
        key = None
        for a in row.find_all("a", href=True):
            if a.find_parent("tr") is not row:
                continue
            q = parse_qs(urlparse(str(a["href"])).query)
            if q.get("id") and q.get("no") and q["no"][0].isdigit():
                key = (q["id"][0], q["no"][0])
                break
        date = _ROW_DATE_RE.match(str(el["title"]))
        if key is None or date is None:
            continue
        try:
            out[key] = datetime(*(int(x) for x in date.groups()))
        except ValueError:
            continue
    return out


def index_row_dates() -> dict[tuple[str, str], datetime]:
    """Dates the board index already holds for rows known from list pages."""
    out: dict[tuple[str, str], datetime] = {}
    for f in INDEX_DIR.glob("*/index-*.json"):
        for e in json.loads(f.read_text(encoding="utf-8"))["entries"]:
            if e.get("createdAtApprox"):
                continue
            try:
                when = datetime.fromisoformat(e["createdAt"])
            except ValueError:
                continue
            if when.year >= 1990:
                out[(f.parent.name, str(e["postId"]))] = when
    return out


def capture_ts_index() -> dict[tuple[str, str, str], str]:
    out: dict[tuple[str, str, str], str] = {}
    for line in PROGRESS_FILE.read_text(encoding="utf-8").splitlines():
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        if rec.get("phase") in ORIGIN_BY_PHASE and rec.get("ts") and rec.get("status") == "ok":
            out[(rec["phase"], rec["board"], str(rec["post_id"]))] = rec["ts"]
    return out


# ── view page ───────────────────────────────────────────────────────────


def header_fields(body_td: Tag) -> tuple[str, str]:
    """(title, author) from the `Name` / `Subject` rows, or n_board's layout.

    Only cells that come before the body cell are read — the board list
    further down has its own `Name` / `Subject` column heads. Each field the
    labels leave empty is then looked for the n_board way, in the same part
    of the page.
    """
    title = author = ""
    for td in reversed(body_td.find_all_previous("td")):
        if not isinstance(td, Tag):
            continue
        label = _label(td)
        if label not in ("Name", "Subject"):
            continue
        value = td.find_next_sibling("td")
        if not isinstance(value, Tag):
            continue
        if label == "Subject" and not title:
            title = _text(value.find("b")) or _text(value)
        elif label == "Name" and not author:
            author = _text(value.find("a")) or _text(value)
    # n_board: `<td align=center height=30><b>제목</b>` then
    # `<img src=…/name_head.gif><b><a …>작성자</a></b>`.
    if not title:
        for td in reversed(body_td.find_all_previous("td", align="center")):
            if isinstance(td, Tag) and td.get("height") == "30" and td.find("b"):
                title = _text(td.find("b"))
                break
    if not author:
        head = body_td.find_previous("img", src=re.compile(r"name_head\.gif"))
        if isinstance(head, Tag):
            b = head.find_next("b")
            author = _text(b.find("a") if isinstance(b, Tag) else None) or _text(b)
    return title, author


def body_html(td: Tag) -> str:
    """Inner HTML of the view's body cell.

    The whole cell, not just its `line-height` span: 4.0 skins draw the
    attached pictures (`<img src=data/…>`) at the top of the cell, before the
    span that holds the text, and a screenshot post without them is empty.
    """
    _drop_ip_footers(td)
    return td.decode_contents()


def _drop_ip_footers(scope: Tag) -> None:
    """Remove the skin's right-aligned footer line: empty, or the poster's IP
    ("IP Address : 61.77.…"). The 4.1 posts in the museum carry no IP, and
    these must not start publishing them."""
    for sig in scope.find_all("div", align="right"):
        if isinstance(sig, Tag) and (not _text(sig) or _IP_LINE_RE.match(_text(sig))):
            sig.decompose()


def _drop_leading_marker(memo: Tag) -> None:
    """Remove the `:::` a comment opens with — only when it is the first thing
    a reader sees in the memo, however deeply the skin wraps it."""
    for node in memo.descendants:
        if isinstance(node, Tag):
            if node.name == "img":
                return
            continue
        if not str(node).strip():
            continue
        if str(node).strip() == ":::" and isinstance(node.parent, Tag) and node.parent.name == "font":
            node.parent.decompose()
        return


def comments_of(html: str) -> list[Comment]:
    """Comments between Zeroboard's comment delimiter and the next section.

    A comment row has at least two cells of its own — author, then memo.
    Rows inside an accepted row belong to its memo and are not comments.
    4.0 prints no comment dates, so every one takes the unknown-date sentinel
    even if its text happens to quote a date.
    """
    start = COMMENTS_START_RE.search(html)
    if not start:
        return []
    end = COMMENTS_END_RE.search(html, start.end())
    section = BeautifulSoup(html[start.end() : end.start() if end else len(html)], "lxml")
    out: list[Comment] = []
    taken: set[int] = set()
    for tr in section.find_all("tr"):
        if not isinstance(tr, Tag) or any(id(parent) in taken for parent in tr.parents):
            continue
        tds = tr.find_all("td", recursive=False)
        if len(tds) < 2:
            continue
        author = _text(tds[0])
        memo = tds[1]
        _drop_leading_marker(memo)
        _drop_ip_footers(memo)
        body = sanitise_html(memo.decode_contents()).strip()
        if not author or not body:
            continue
        taken.add(id(tr))
        out.append(Comment(author=author, authorMemberNo=None, createdAt=UNKNOWN_DATE, bodyHtml=body))
    return out


def parse_view(
    html: str,
    *,
    board: str,
    post_id: str,
    phase: str,
    created_at: datetime,
    captured_at: str,
    parsed_at: datetime,
) -> Post:
    soup = BeautifulSoup(html, "lxml")
    body_td = soup.find("td", style=_BODY_CELL_RE)
    # Error pages (no permission, no such board, member list, poll) carry no
    # view scaffolding. Only then do their messages decide — a real post that
    # quotes "사용권한이 없습니다" keeps its body cell and stays a post.
    if not isinstance(body_td, Tag):
        for marker, reason in _NON_POST_MARKERS:
            if marker in html:
                raise NonPost(reason)
        raise NonPost("no_view_scaffold")
    raw_title, author = header_fields(body_td)
    body = sanitise_html(body_html(body_td))
    body_text = BeautifulSoup(body, "lxml").get_text(" ", strip=True)
    attachments = [Attachment(**a) for a in zb41.find_attachments(soup)]
    if not raw_title and not body_text and "<img" not in body and not attachments:
        # Zeroboard renders an empty template for a post it no longer has.
        raise NonPost("empty_view")
    category, title = zb41.split_category_prefix(raw_title)
    return Post(
        board=board,
        boardKr=board,
        postId=post_id,
        title=title or "(제목 없음)",
        categoryLabel=category,
        bodyHtml=body,
        bodyText=body_text or " ",
        author=author or "anonymous",
        authorMemberNo=None,
        authorHomepage=None,
        createdAt=created_at,
        hits=None,
        recommend=None,
        attachments=attachments,
        comments=comments_of(html),
        era="2003",
        capturedAt=captured_at,
        parsedAt=parsed_at,
        originalUrl=f"{ORIGIN_BY_PHASE[phase]}?id={board}&no={post_id}",
        sourceEngine="zeroboard",
    )


def ip_like_fields(post: Post) -> list[str]:
    """Where an IPv4-looking string survives in text a reader sees."""
    hits = []
    if _IP_RE.search(post.author):
        hits.append("author")
    if _IP_RE.search(post.bodyText):
        hits.append("body")
    for c in post.comments:
        if _IP_RE.search(c.author) or _IP_RE.search(BeautifulSoup(c.bodyHtml, "lxml").get_text(" ")):
            hits.append("comment")
            break
    return hits


# ── driver ──────────────────────────────────────────────────────────────


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--board")
    ap.add_argument("--force", action="store_true", help="rewrite posts that already exist")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    files: list[tuple[str, str, str, Path]] = []
    for phase in ORIGIN_BY_PHASE:
        root = INPUT_BASE / phase
        if not root.is_dir():
            continue
        for f in sorted(root.glob("*/*.html")):
            if args.board and f.parent.name != args.board:
                continue
            files.append((phase, f.parent.name, f.stem, f))

    # Pool every list row printed under any old-path capture, then the index.
    row_dates: dict[tuple[str, str], datetime] = {}
    for _, _, _, f in files:
        row_dates.update(list_row_dates(f.read_text(encoding="utf-8")))
    index_dates = index_row_dates()
    ts_index = capture_ts_index()

    stats: Counter[str] = Counter()
    dated: Counter[str] = Counter()
    parsed_at = datetime.now()
    # Failure records are replaced only for inputs this run actually retries;
    # a board-scoped or skip-existing run keeps everyone else's.
    failures: dict[str, dict[str, str]] = {}
    if FAILURES_FILE.exists():
        for line in FAILURES_FILE.read_text(encoding="utf-8").splitlines():
            rec = json.loads(line)
            failures[rec["input"]] = rec
    quarantined: list[str] = []
    for phase, board, post_id, f in files:
        out = OUTPUT_DIR / board / f"{post_id}.json"
        if out.exists() and not args.force:
            stats["exists"] += 1
            continue
        key = (board, post_id)
        if key in row_dates:
            created, how = row_dates[key], "list row"
        elif key in index_dates:
            created, how = index_dates[key], "index row"
        else:
            created, how = UNKNOWN_DATE, "unknown"
        failures.pop(str(f), None)
        try:
            captured = ts_index[(phase, board, post_id)]
            post = parse_view(
                f.read_text(encoding="utf-8"),
                board=board,
                post_id=post_id,
                phase=phase,
                created_at=created,
                captured_at=captured,
                parsed_at=parsed_at,
            )
        except NonPost as e:
            stats[f"skipped:{e.reason}"] += 1
            continue
        except (KeyError, ValidationError, ValueError) as e:
            stats["failed"] += 1
            failures[str(f)] = {"input": str(f), "error": f"{type(e).__name__}: {e}"[:400]}
            continue
        # A post that still shows an IPv4-looking string is not published
        # until someone has read it: it may be a poster's address.
        if where := ip_like_fields(post):
            stats["quarantined:ip"] += 1
            quarantined.append(f"{board}/{post_id}\t{','.join(where)}\t{f}")
            continue
        stats["ok"] += 1
        dated[how] += 1
        if not args.dry_run:
            out.parent.mkdir(parents=True, exist_ok=True)
            tmp = out.with_suffix(".json.tmp")
            tmp.write_text(post.model_dump_json(indent=2) + "\n", encoding="utf-8")
            tmp.replace(out)

    print(f"[02f-zb40] files={len(files)} list-row dates pooled={len(row_dates)} dry_run={args.dry_run}")
    print(f"[02f-zb40] {dict(stats)}")
    print(f"[02f-zb40] dates from: {dict(dated)}")
    FAILURES_FILE.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in failures.values()), encoding="utf-8")
    QUARANTINE_FILE.write_text("".join(q + "\n" for q in quarantined), encoding="utf-8")
    if quarantined:
        print(f"[02f-zb40] {len(quarantined)} posts held back for an IP-like string — see {QUARANTINE_FILE}")
    sys.exit(1 if stats["failed"] else 0)


if __name__ == "__main__":
    main()
