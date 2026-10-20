#!/usr/bin/env python3
"""ETL Stage 2h — posts that survive only in Zeroboard's reply form.

Some 2000–2001 posts were never captured as a view, but a reader opened
"reply" under them and Wayback kept that form (`write.php?…&mode=reply`).
Zeroboard fills it from the original: the subject as `[re] <subject>` and the
text area with the post's body, every line prefixed with `>`. This rebuilds
the post from those two fields.

Author and date come from the board list Zeroboard printed under other
captured views (`02f.list_row_dates` reads the same rows): the author is the
cell after the subject link, the time the row's `title` timestamp, hits the
last cell. The row's subject also tells whether the form's `[re]` is the
post's own (see `form_title`). The date is 02f's (`zb40.date_of`): only a
row whose title is the post's counts, numbers repeating across installs. A
post no list row mentions gets 02f's unknown-date sentinel and "anonymous",
like 02f. The comments are gone: the form carries none. A line
at the end of the body says where the text came from.

Input `.docs/research/archive-clean/R/{board}/{no}.html` (plan
`cdx/reply-forms-plan.json`, phase R). Posts that already exist are left
alone; IP-shaped text sends the post to `.quarantine-ip-reply.tsv`, as in 02f.

USAGE
    python3 scripts/etl/02h-parse-reply-forms.py [--dry-run]
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
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup, Tag
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post_parse import split_category_prefix  # noqa: E402
from sanitise import sanitise_html  # noqa: E402
from schemas import Post  # noqa: E402

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
INPUT = PROJECT_ROOT / ".docs" / "research" / "archive-clean" / "R"
ALL_CLEAN = PROJECT_ROOT / ".docs" / "research" / "archive-clean"
PLAN = PROJECT_ROOT / ".docs" / "research" / "cdx" / "reply-forms-plan.json"
OUTPUT_DIR = PROJECT_ROOT / "src" / "content" / "posts"
QUARANTINE = Path(__file__).with_name(".quarantine-ip-reply.tsv")

_spec = importlib.util.spec_from_file_location("zb40", Path(__file__).with_name("02f-parse-zeroboard40.py"))
assert _spec and _spec.loader
zb40 = importlib.util.module_from_spec(_spec)
sys.modules["zb40"] = zb40
_spec.loader.exec_module(zb40)

RE_PREFIX = re.compile(r"^\s*\[re\]\s*", re.I)
HITS = re.compile(r"[0-9]+")  # ASCII only: "²".isdigit() is True, int("²") fails
# A cell with a letter in it that is not a date like 2001/04/19.
AUTHOR_CELL = re.compile(r"^(?!\d{2,4}[/.-]\d{1,2}[/.-]\d{1,2}$)(?=.*[^\d\s/.:-]).+$")
HTML_TAG = re.compile(r"<\s*/?\s*[a-zA-Z][^>]*>")
SOURCE_NOTE = (
    '<p style="color:#888;font-size:11px">이 글은 답글 쓰기 화면에 인용된 제목과 본문으로 '
    "복원했습니다. 댓글은 남아 있지 않습니다.</p>"
)


def list_rows(html_text: str) -> dict[tuple[str, str], dict]:
    """(board, no) → {author, hits} from the list under a view; dates come
    from `zb40.list_row_dates`, which reads the same rows."""
    out: dict[tuple[str, str], dict] = {}
    m = zb40.LIST_START_RE.search(html_text)
    if not m:
        return out
    soup = BeautifulSoup(html_text[m.end():], "lxml")
    for a in soup.find_all("a", href=True):
        q = parse_qs(urlparse(str(a["href"])).query)
        if not (q.get("id") and q.get("no") and q["no"][0].isdigit()):
            continue
        cell = a.find_parent("td")
        if not isinstance(cell, Tag):
            continue
        cells = [c for c in cell.find_next_siblings("td")]
        # Author: the first cell after the subject holding a name, i.e. not a
        # number (hits, comment count) and not a date. None found → unknown.
        author = next((c.get_text(" ", strip=True) for c in cells
                       if AUTHOR_CELL.search(c.get_text(" ", strip=True))), "")
        hits = cells[-1].get_text(strip=True) if cells else ""
        key = (q["id"][0], q["no"][0])
        if author and key not in out:
            out[key] = {"author": author, "hits": int(hits) if HITS.fullmatch(hits) else None,
                        "title": a.get_text(" ", strip=True)}
    return out


def form_title(subject: str, row_title: str) -> str:
    """The post's own subject. The form shows `[re] <subject>`, but Zeroboard
    adds no second `[re]` to a subject that is already a reply, so the form
    cannot tell whether the `[re]` is the post's. The list row can — even a
    shortened one keeps its start: `[re]` there means the post was a reply."""
    subject = subject.strip()
    if RE_PREFIX.match(row_title):
        return subject
    return RE_PREFIX.sub("", subject).strip()


def body_from_memo(memo: str) -> str:
    """Unquote the `>` lines and keep them as the post had them: HTML when
    the post used HTML, otherwise text with its line breaks."""
    lines = [re.sub(r"^>", "", line) for line in memo.strip("\n").split("\n")]
    while lines and not lines[-1].strip():
        lines.pop()
    if any(HTML_TAG.search(line) for line in lines):
        return sanitise_html("<br>\n".join(lines))
    return "<br>\n".join(html.escape(line) for line in lines)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    plan = {(e["board"], e["post_id"]): e for e in json.loads(PLAN.read_text())}
    dated_rows: dict[tuple[str, str], list[tuple[str, datetime]]] = {}
    rows: dict[tuple[str, str], dict] = {}
    for f in sorted(ALL_CLEAN.glob("*/*/*.html")):
        if f.parts[-3] in ("S", "R"):
            continue
        text = f.read_text(encoding="utf-8", errors="replace")
        for k, row in zb40.list_row_dates(text).items():
            dated_rows.setdefault(k, []).append(row)
        for k, v in list_rows(text).items():
            rows.setdefault(k, v)

    stats: dict[str, int] = {}
    quarantined: list[str] = []
    parsed_at = datetime.now()
    for f in sorted(INPUT.glob("*/*.html")):
        board, post_id = f.parent.name, f.stem
        out = OUTPUT_DIR / board / f"{post_id}.json"
        if out.exists():
            stats["exists"] = stats.get("exists", 0) + 1
            continue
        soup = BeautifulSoup(f.read_text(encoding="utf-8"), "lxml")
        subject = soup.find("input", attrs={"name": "subject"})
        memo = soup.find("textarea", attrs={"name": "memo"})
        if not isinstance(subject, Tag) or not isinstance(memo, Tag):
            stats["no_form"] = stats.get("no_form", 0) + 1  # "사용권한이 없습니다"
            continue
        key = (board, post_id)
        row = rows.get(key, {})
        raw_title = form_title(str(subject.get("value", "")), row.get("title", ""))
        body = body_from_memo(memo.get_text())
        body_text = BeautifulSoup(body, "lxml").get_text(" ", strip=True)
        if not raw_title and not body_text:
            stats["empty"] = stats.get("empty", 0) + 1
            continue
        category, title = split_category_prefix(raw_title)
        e = plan[key]
        created, how = zb40.date_of(title, e["ts"], dated_rows.get(key, []))
        try:
            post = Post(
                board=board,
                boardKr=board,
                postId=post_id,
                title=title or "(제목 없음)",
                categoryLabel=category,
                bodyHtml=body + "\n" + SOURCE_NOTE,
                bodyText=body_text or " ",
                author=row.get("author") or "anonymous",
                authorMemberNo=None,
                authorHomepage=None,
                createdAt=created,
                hits=row.get("hits"),
                recommend=None,
                attachments=[],
                comments=[],
                era="2003",
                capturedAt=e["ts"],
                parsedAt=parsed_at,
                originalUrl=e["url"],
                sourceEngine="zeroboard",
            )
        except ValidationError as err:
            print(f"[02h] {board}/{post_id}: {err}", file=sys.stderr)
            stats["invalid"] = stats.get("invalid", 0) + 1
            continue
        if zb40.ip_like_fields(post):
            quarantined.append(f"{board}\t{post_id}\t{','.join(zb40.ip_like_fields(post))}")
            continue
        stats["written"] = stats.get("written", 0) + 1
        stats["undated" if how == "unknown" else "dated"] = stats.get("undated" if how == "unknown" else "dated", 0) + 1
        if not args.dry_run:
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(post.model_dump_json(indent=2) + "\n", encoding="utf-8")
    if quarantined and not args.dry_run:
        QUARANTINE.write_text("\n".join(quarantined) + "\n")
    stats["quarantined"] = len(quarantined)
    print(f"[02h-reply] {json.dumps(stats)}", file=sys.stderr)


if __name__ == "__main__":
    main()
