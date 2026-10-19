#!/usr/bin/env python3
"""ETL Stage 2i — the polls of UO_Vote, forg's "UO.POLL" board (2001–2002).

The board held polls, not posts: a question, its options, a vote count per
option and comments under it (Zeroboard 4.1, the Allure vote skin, first
under /zboard/ then /zb/). 02 skips its views (`poll_page`). Wayback kept its
list pages, which print every poll with its options but no counts (ten of
the fourteen: the pages holding 1, 2, 7 and 8 were never captured), and two
views with the results and the comments (no 58 on 2001-11-23, no 83 on
2002-01-14; the vote-result pages only refresh to a view). Each poll becomes
a post: the question as the title; as the body the options, with each one's
votes, share and the skin's grey bar where a view survives; the view's
comments. A poll known only from a list keeps the options of the newest list
that prints it. No capture names a poll's author or the day it was posted,
so every poll is "anonymous" and undated (02f's sentinel): the list then keeps
them in their numbered order, newest first, which a comment's date would
break. The body ends with a line saying where it came from.

Input: the S-phase captures under `.docs/research/archive-clean/S/{zb,zboard}/`
named `zboard.php_id_UO_Vote…` (lists) and `view.php_id_UO_Vote…` (views),
with each one's URL and timestamp from `cdx/site-plan.json`. IP-shaped text
stops the run. Posts that already exist are left alone unless `--force`.

USAGE
    python3 scripts/etl/02i-parse-polls.py [--dry-run] [--force]
"""
from __future__ import annotations

import argparse
import html
import importlib.util
import json
import re
import sys
from datetime import datetime
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post_parse import parse_korean_datetime, plain_text, write_post  # noqa: E402
from sanitise import sanitise_html  # noqa: E402
from schemas import Comment, Post  # noqa: E402

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SILVER = PROJECT_ROOT / ".docs" / "research" / "archive-clean" / "S"
PLAN = PROJECT_ROOT / ".docs" / "research" / "cdx" / "site-plan.json"
OUTPUT_DIR = PROJECT_ROOT / "src" / "content" / "posts" / "UO_Vote"
BOARD = "UO_Vote"

_spec = importlib.util.spec_from_file_location("zb40", Path(__file__).with_name("02f-parse-zeroboard40.py"))
assert _spec and _spec.loader
zb40 = importlib.util.module_from_spec(_spec)
sys.modules["zb40"] = zb40
_spec.loader.exec_module(zb40)

POLL_NO = re.compile(r"[?&]no=(\d+)")
OPTION_OF = re.compile(r"apply_vote\.php\?.*\bno=(\d+)&sub_no=")
VOTED = re.compile(r"\[\s*(\d+)\s*voted\s*\]")
TOTAL = re.compile(r"\((\d+)\s*voted\)")
MEMBER_NO = re.compile(r"member_no=(\d+)")
NOTE_STYLE = "color:#888;font-size:11px"


def list_polls(text: str) -> list[dict]:
    """The polls a list page prints: number, question, comment count and
    options, in the page's order."""
    soup = BeautifulSoup(text, "lxml")
    polls = []
    for label in soup.find_all("td", class_="allure2", string=re.compile(r"Subject")):
        link = label.find_next("a", href=re.compile(r"view\.php"))
        no = POLL_NO.search(link["href"]).group(1)
        count = link.find_next_sibling("font")
        options = []
        for a in link.find_all_next("a", href=OPTION_OF):
            if OPTION_OF.search(a["href"]).group(1) != no:
                break
            options.append(a.get_text(strip=True))
        polls.append({
            "no": no,
            "title": link.get_text(strip=True),
            "listedComments": int(re.sub(r"\D", "", count.get_text()) or 0) if count else 0,
            "options": options,
        })
    return polls


def view_poll(text: str) -> dict:
    """A poll's view: the question, the total, each option's votes and share,
    and the comments."""
    soup = BeautifulSoup(text, "lxml")
    total = soup.find(string=TOTAL)
    question = total.find_parent("td").get_text(" ", strip=True)
    options = []
    for a in soup.find_all("a", href=OPTION_OF):
        votes = a.find_next_sibling("font", string=VOTED)
        share = a.find_next("td", align="right", class_="allure2")
        options.append((a.get_text(strip=True), int(VOTED.search(votes.get_text()).group(1)),
                        int(share.get_text(strip=True).rstrip("%"))))
    comments = []
    for when in soup.find_all("span", title=re.compile(r"\d+년 \d+월 \d+일")):
        cells = when.find_parent("tr").find_all("td", recursive=False)
        # A member's name links to their profile (`member_no`); a guest's is
        # plain bold text.
        member = MEMBER_NO.search(str(cells[0]))
        comments.append({
            "author": cells[0].get_text(strip=True),
            "authorMemberNo": member.group(1) if member else None,
            "createdAt": parse_korean_datetime(when["title"]),
            "bodyHtml": sanitise_html(cells[1].decode_contents().strip()),
        })
    return {
        "title": TOTAL.sub("", question).strip(),
        "total": int(TOTAL.search(total).group(1)),
        "options": options,
        "comments": comments,
    }


def results_html(poll: dict) -> str:
    """The view's results as the skin drew them: each option with its votes,
    then a grey bar its share of the row wide and the share."""
    rows = []
    for label, votes, share in poll["options"]:
        rows.append(
            f'<tr><td colspan="2">{html.escape(label)} [ {votes} voted ]</td></tr>'
            f'<tr><td width="90%"><table width="{share}%" bgcolor="#999999" border="0" cellpadding="0" '
            f'cellspacing="0"><tr><td height="6"></td></tr></table></td><td align="right" width="10%">{share}%</td></tr>'
        )
    return (f"<p>({poll['total']} voted)</p>\n"
            f'<table width="100%" border="0" cellpadding="2" cellspacing="0">{"".join(rows)}</table>')


def options_html(poll: dict) -> str:
    """The options a list printed."""
    rows = "".join(f"<tr><td>{html.escape(o)}</td></tr>" for o in poll["options"])
    return f'<table width="100%" border="0" cellpadding="2" cellspacing="0">{rows}</table>'


def source_note(poll: dict, viewed: bool) -> str:
    """Where the body came from and what is missing (02h's style)."""
    if viewed:
        text = f"이 설문의 투표 수와 댓글은 {day(poll['capturedAt'])} 캡처 때의 것입니다."
    else:
        gone = f"투표 수와 댓글({poll['listedComments']}개)은" if poll["listedComments"] else "투표 수는"
        text = f"이 설문은 목록 화면에 남은 질문과 항목으로 복원했습니다. {gone} 남아 있지 않습니다."
    return f'<p style="{NOTE_STYLE}">{text}</p>'


def day(ts: str) -> str:
    return f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}"


def captures(plan: list[dict], kind: str) -> list[tuple[str, str, str]]:
    """(timestamp, URL, silver text) of the board's `kind` pages, oldest first."""
    found = []
    for row in plan:
        if row.get("phase") != "S" or row.get("board") not in ("zb", "zboard"):
            continue
        if not row["post_id"].startswith(f"{kind}.php_id_{BOARD}"):
            continue
        files = list((SILVER / row["board"]).glob(f"{kind}.php_id_{BOARD}*~{row['ts']}.html"))
        if len(files) != 1:
            raise ValueError(f"{row['post_id']}: {len(files)} silver files for {row['ts']}")
        found.append((row["ts"], row["url"].replace(":80/", "/", 1), files[0].read_text(encoding="utf-8")))
    return sorted(found)


def build(lists: list[tuple[str, str, str]], views: list[tuple[str, str, str]], parsed_at: datetime) -> list[Post]:
    """A post for every poll a list prints, its view's results where one
    survives."""
    known: dict[str, dict] = {}
    for ts, url, text in sorted(lists):  # the newest list printing a poll wins
        for poll in list_polls(text):
            known[poll["no"]] = {**poll, "capturedAt": ts, "originalUrl": url}
    viewed: dict[str, dict] = {}
    for ts, url, text in views:
        no = POLL_NO.search(url).group(1)
        viewed[no] = {**view_poll(text), "capturedAt": ts, "originalUrl": url}
    posts = []
    for no, poll in sorted(known.items(), key=lambda kv: int(kv[0])):
        seen = viewed.get(no)
        source = seen or poll
        body = results_html(seen) if seen else options_html(poll)
        posts.append(Post(
            board=BOARD,
            boardKr=BOARD,
            postId=no,
            title=seen["title"] if seen else poll["title"],
            categoryLabel=None,
            bodyHtml=body + "\n" + source_note(source, bool(seen)),
            bodyText=plain_text(body),
            author="anonymous",
            authorMemberNo=None,
            authorHomepage=None,
            createdAt=zb40.UNKNOWN_DATE,
            hits=None,
            recommend=None,
            attachments=[],
            comments=[Comment(**c) for c in seen["comments"]] if seen else [],
            era="2003",
            capturedAt=source["capturedAt"],
            parsedAt=parsed_at,
            originalUrl=source["originalUrl"],
            sourceEngine="zeroboard",
        ))
    return posts


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true", help="rewrite posts that already exist")
    args = ap.parse_args()
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    posts = build(captures(plan, "zboard"), captures(plan, "view"), datetime.now())
    for post in posts:
        where = zb40.ip_like_fields(post) + (["title"] if zb40.has_ip(post.title) else [])
        if where:
            raise ValueError(f"{BOARD}/{post.postId}: IP-shaped text in {where}")
    written = 0
    for post in posts:
        out = OUTPUT_DIR / f"{post.postId}.json"
        if out.exists() and not args.force:
            continue
        written += 1
        if not args.dry_run:
            out.parent.mkdir(parents=True, exist_ok=True)
            write_post(out, post)
    stats = {"polls": len(posts), "written": written, "comments": sum(len(p.comments) for p in posts)}
    print(f"[02i-polls] {json.dumps(stats)}", file=sys.stderr)


if __name__ == "__main__":
    main()
