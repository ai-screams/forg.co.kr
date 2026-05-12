#!/usr/bin/env python3
"""ETL Stage 2d — Gnuboard5 `st-basic` skin HTML → Post JSON.

Handles:
  - forg.co.kr `Ultima` board (G5 era, 24 posts in plan)
  - forg.kr 10 successor-site boards: `ultima` · `aseeee` · `dataaa`
    `free` · `gonggg` · `humorrr` · `notice` · `qnaaa` · `screee`
    · `trtrtr`  (66 posts total in plan)

Both sites use the **st-basic** theme, NOT the documented `bo_v_atc`
basic skin. Anchors:
  - `<section id="st-view">` wraps the post
  - `h4.subject` carries the title (+ `[N]` comment-count suffix)
  - `div.desc strong:nth-of-type(1..4)` is the meta line:
       [author, "YYYY-MM-DD HH:MM:SS", hits, comments_count]
  - `article.text` is the post body
  - `<section id="st-comment"> article[id^="c_"]` are comments

Origin disambiguation: APFS is case-insensitive so the forg.co.kr
`Ultima` and forg.kr `ultima` bronze files share one inode. The
`e-policy-plan.json` `board` field preserves the original case, so
we look each post up by `post_id` to decide the gold-tier board id.

forg.kr boards land at `src/content/posts/kr_{board}/{post}.json` to
avoid case collisions with forg.co.kr's Notice/Ultima. forg.co.kr
Ultima keeps `Ultima/` (no other case variant exists for it).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import cast

import nh3
from bs4 import BeautifulSoup, Tag
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parent))
from schemas import Attachment, Comment, Post  # noqa: E402

# ── Paths ───────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
INPUT_BASE = PROJECT_ROOT / ".docs" / "research" / "archive-clean"
OUTPUT_DIR = PROJECT_ROOT / "src" / "content" / "posts"
FAILURES_FILE = PROJECT_ROOT / "scripts" / "etl" / ".parse-failures-g5.jsonl"
SUMMARY_FILE = PROJECT_ROOT / "scripts" / "etl" / ".parse-summary-g5.json"

PLAN_FILE = PROJECT_ROOT / ".docs" / "research" / "cdx" / "e-policy-plan.json"
PROGRESS_FILE = PROJECT_ROOT / ".docs" / "research" / "archive" / ".progress.jsonl"

# Case-insensitive directory names this parser walks. The plan resolves
# original case (forg.co.kr `Ultima` vs forg.kr `ultima`).
INCLUDE_BOARDS_CI: frozenset[str] = frozenset({
    "ultima",  # case-collides with forg.co.kr Ultima
    "aseeee", "dataaa", "free", "gonggg", "humorrr",
    "notice",  # case-collides with forg.co.kr Notice
    "qnaaa", "screee", "trtrtr",
})

# All G5 captures are from 2019+ → post-2011 → 2014 era.
ERA: str = "2014"


# ── Plan-based origin disambiguation ────────────────────────────────────
def load_plan_lookup() -> dict[tuple[str, str], str]:
    """Return `(board_ci, post_id) -> original_plan_board`.

    The plan keeps the exact case forg.co.kr / forg.kr used. We key
    by lowercase board name so the case-collided pairs share the same
    bucket and we can look up the right origin per post.
    """
    if not PLAN_FILE.exists():
        sys.exit(f"FATAL: plan file not found: {PLAN_FILE}")
    plan = json.loads(PLAN_FILE.read_text(encoding="utf-8"))
    lookup: dict[tuple[str, str], str] = {}
    for entry in plan:
        board = entry.get("board")
        post_id = entry.get("post_id")
        if not (isinstance(board, str) and isinstance(post_id, str)):
            continue
        lookup[(board.lower(), post_id)] = board
    return lookup


def load_capture_lookup() -> dict[tuple[str, str], str]:
    """Return `(board_ci, post_id) -> wayback_ts` from plan + progress."""
    lookup: dict[tuple[str, str], str] = {}
    if PLAN_FILE.exists():
        plan = json.loads(PLAN_FILE.read_text(encoding="utf-8"))
        for entry in plan:
            b, p, ts = entry.get("board"), entry.get("post_id"), entry.get("ts")
            if isinstance(b, str) and isinstance(p, str) and isinstance(ts, str):
                lookup[(b.lower(), p)] = ts
    if PROGRESS_FILE.exists():
        with PROGRESS_FILE.open() as f:
            for line in f:
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                b = entry.get("board")
                p = entry.get("post_id")
                ts = entry.get("ts")
                if isinstance(b, str) and isinstance(p, str) and isinstance(ts, str):
                    lookup.setdefault((b.lower(), p), ts)
    return lookup


def map_output_board(plan_board: str) -> str:
    """Map a plan-board name to a gold-tier directory id.

    forg.co.kr Ultima keeps its name. Every other entry comes from
    forg.kr and gets a `kr_` prefix so case-insensitive APFS can't
    collide its content with forg.co.kr posts.
    """
    if plan_board == "Ultima":
        return "Ultima"
    return f"kr_{plan_board}"


# ── Non-post page detection ─────────────────────────────────────────────
_NON_POST_MARKERS: tuple[tuple[str, str], ...] = (
    ("선택하신 게시물이 존재하지 않습니다", "deleted_before_capture"),
    ("글이 존재하지 않습니다", "deleted_before_capture"),
    ("글이 삭제되었거나 이동된 경우입니다", "deleted_before_capture"),
    ("접근 권한이 없으므로 글읽기가 불가합니다", "permission_denied"),
    ("글을 읽을 권한이 없습니다", "permission_denied"),
    ("목록을 볼 권한이 없습니다", "permission_denied"),
    ("존재하지 않는 게시판입니다", "board_not_found"),
    ("비회원은 이 게시판에 접근할 권한이 없습니다", "members_only"),
)


def detect_non_post_page(soup: BeautifulSoup, html: str) -> str | None:
    for marker, reason in _NON_POST_MARKERS:
        if marker in html:
            return reason
    if soup.find(id="st-view") is None:
        return "g5_skin_unsupported"
    return None


class _NonPostPage(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


# ── nh3 sanitiser (mirror Zeroboard parser, ADR-0008 §5) ────────────────
_SANITISER_TAGS = {
    "p", "br", "b", "i", "u", "strong", "em", "a", "img", "span",
    "div", "table", "tr", "td", "th", "tbody", "thead", "tfoot",
    "ul", "ol", "li", "blockquote", "font", "center", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6", "pre", "code",
}  # fmt: skip
_SANITISER_ATTRS: dict[str, set[str]] = {
    "a": {"href", "title"},
    "img": {
        "src", "alt", "width", "height", "border", "title",
        "data-recovery", "data-original-src",
    },  # fmt: skip
    "td": {"colspan", "rowspan", "align", "valign", "bgcolor", "width", "height"},
    "th": {"colspan", "rowspan", "align", "valign", "bgcolor", "width", "height"},
    "table": {"border", "cellpadding", "cellspacing", "width", "bgcolor"},
    "font": {"color", "size", "face"},
    "*": {"style", "class"},
}
_SANITISER_URL_SCHEMES = {"http", "https", "mailto"}


def sanitise_html(html: str) -> str:
    return nh3.clean(
        html,
        tags=_SANITISER_TAGS,
        attributes=_SANITISER_ATTRS,
        url_schemes=_SANITISER_URL_SCHEMES,
        link_rel=None,
    )


# ── Selectors ───────────────────────────────────────────────────────────
def find_title(sv: Tag) -> str:
    h4 = sv.find("h4", class_="subject")
    if not isinstance(h4, Tag):
        return ""
    # Strip the trailing `<small>[N]</small>` comment-count badge.
    h4_clone = BeautifulSoup(str(h4), "lxml").find("h4")
    if isinstance(h4_clone, Tag):
        for small in h4_clone.find_all("small"):
            small.decompose()
        return h4_clone.get_text(strip=True)
    return h4.get_text(strip=True)


def find_meta(sv: Tag) -> dict[str, object]:
    """Pull author / created_at / hits from `<div class="desc">`."""
    desc = sv.find("div", class_="desc")
    out: dict[str, object] = {"author": None, "created_at": None, "hits": None}
    if not isinstance(desc, Tag):
        return out
    strongs = [s.get_text(strip=True) for s in desc.find_all("strong")]
    if len(strongs) >= 1 and strongs[0]:
        out["author"] = strongs[0]
    if len(strongs) >= 2:
        ts = strongs[1].replace("/", "-").strip()
        try:
            out["created_at"] = datetime.fromisoformat(ts.replace(" ", "T"))
        except ValueError:
            out["created_at"] = None
    if len(strongs) >= 3:
        try:
            out["hits"] = int(re.sub(r"[^\d]", "", strongs[2]) or "0")
        except ValueError:
            out["hits"] = None
    return out


def find_body(sv: Tag) -> str:
    art = sv.find("article", class_="text")
    if not isinstance(art, Tag):
        return ""
    return art.decode_contents()


def find_comments(soup: BeautifulSoup) -> list[Comment]:
    cc = soup.find(id="st-comment")
    if not isinstance(cc, Tag):
        return []
    out: list[Comment] = []
    for art in cc.find_all("article"):
        if not isinstance(art, Tag):
            continue
        cid = art.get("id", "")
        if not (isinstance(cid, str) and cid.startswith("c_")):
            continue
        header = art.find("div", class_="header")
        scope = header if isinstance(header, Tag) else art
        strong = scope.find("strong")
        author = strong.get_text(strip=True) if isinstance(strong, Tag) else None
        time_tag = scope.find("time")
        created_at: datetime | None = None
        if isinstance(time_tag, Tag):
            iso = time_tag.get("datetime", "")
            if isinstance(iso, str) and iso:
                try:
                    created_at = datetime.fromisoformat(iso)
                except ValueError:
                    created_at = None
        # Comment body: first <p> child inside the article.
        body_p = art.find("p")
        body_html_raw = body_p.decode_contents() if isinstance(body_p, Tag) else ""
        body_html = sanitise_html(body_html_raw)
        if not author or created_at is None:
            continue
        out.append(
            Comment(
                author=author,
                authorMemberNo=None,
                createdAt=created_at,
                bodyHtml=body_html,
            )
        )
    return out


# ── Parsing pipeline ────────────────────────────────────────────────────
def parse_one(
    plan_board: str,
    post_id: str,
    html: str,
    captured_at: str,
    parsed_at: datetime,
) -> Post:
    """Parse one G5 capture. Raises `_NonPostPage` for skippable inputs."""
    soup = BeautifulSoup(html, "lxml")
    reason = detect_non_post_page(soup, html)
    if reason is not None:
        raise _NonPostPage(reason)

    sv = soup.find(id="st-view")
    if not isinstance(sv, Tag):
        raise _NonPostPage("g5_skin_unsupported")

    raw_title = find_title(sv) or ""
    if not raw_title.strip():
        raise _NonPostPage("missing_title")

    meta = find_meta(sv)
    created_at = meta["created_at"]
    if not isinstance(created_at, datetime):
        raise _NonPostPage("missing_createdAt")

    body_html_raw = find_body(sv)
    body_html = sanitise_html(body_html_raw)
    body_text = BeautifulSoup(body_html, "lxml").get_text(separator=" ", strip=True)

    comments = find_comments(soup)
    # Attachments: G5's st-basic theme renders these inline; cleanly
    # separated parsing requires the `#bo_v_file` block which is absent
    # in the captures we have. Treat as `[]` for now.
    attachments: list[Attachment] = []

    output_board = map_output_board(plan_board)
    site_host = "forg.kr" if output_board.startswith("kr_") else "forg.co.kr"
    original_url = (
        f"http://{site_host}/bbs/board.php?bo_table={plan_board}&wr_id={post_id}"
    )

    return Post(
        board=output_board,
        boardKr=output_board,  # localisation will rewrite to nameKr at index time
        postId=post_id,
        title=raw_title or "(제목 없음)",
        categoryLabel=None,
        bodyHtml=body_html,
        bodyText=body_text or " ",
        author=cast(str, meta["author"]) if meta["author"] else "anonymous",
        authorMemberNo=None,
        authorHomepage=None,
        createdAt=created_at,
        hits=cast("int | None", meta["hits"]),
        recommend=None,
        attachments=attachments,
        comments=comments,
        era=ERA,
        capturedAt=captured_at,
        parsedAt=parsed_at,
        originalUrl=original_url,
        sourceEngine="gnuboard5",
    )


# ── Stats / reporting ──────────────────────────────────────────────────-
@dataclass
class Stats:
    total: int = 0
    success: int = 0
    skipped: int = 0
    failed_parse: int = 0
    failed_validate: int = 0
    skipped_no_content: int = 0
    skipped_reasons: Counter = field(default_factory=Counter)
    body_chars: int = 0
    posts_with_comments: int = 0
    per_board: Counter = field(default_factory=Counter)
    per_board_failed: Counter = field(default_factory=Counter)
    per_board_skipped: Counter = field(default_factory=Counter)
    start_ts: float = field(default_factory=time.time)


def _append_failure(rec: dict[str, object]) -> None:
    FAILURES_FILE.parent.mkdir(parents=True, exist_ok=True)
    with FAILURES_FILE.open("a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def _write_summary(stats: Stats) -> None:
    SUMMARY_FILE.write_text(
        json.dumps(
            {
                "total": stats.total,
                "success": stats.success,
                "skipped": stats.skipped,
                "skipped_no_content": stats.skipped_no_content,
                "skipped_reasons": dict(stats.skipped_reasons),
                "failed_parse": stats.failed_parse,
                "failed_validate": stats.failed_validate,
                "avg_body_chars": (
                    stats.body_chars // stats.success if stats.success else 0
                ),
                "posts_with_comments": stats.posts_with_comments,
                "per_board": dict(stats.per_board),
                "per_board_failed": dict(stats.per_board_failed),
                "per_board_skipped": dict(stats.per_board_skipped),
                "elapsed_s": int(time.time() - stats.start_ts),
                "ts": int(time.time()),
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )


# ── Driver ──────────────────────────────────────────────────────────────
def iter_input_files(
    board_filter: str | None,
    plan_lookup: dict[tuple[str, str], str],
) -> list[tuple[str, str, Path]]:
    """Yield `(plan_board, post_id, path)`.

    `plan_board` is the original-case board name from the plan, used
    to disambiguate case-collided dirs (Ultima/ultima, Notice/notice).
    """
    files: list[tuple[str, str, Path]] = []
    # G5 era only exists in Phase B (forg.co.kr 2019+ migrated to G5, and
    # the forg.kr successor site is g5-only). Restricting the walk to B
    # avoids Phase A's case-collided `Notice/` (865 Zeroboard forg.co.kr
    # posts that would all skip as `g5_skin_unsupported`).
    root = INPUT_BASE / "B"
    if not root.is_dir():
        sys.exit(f"FATAL: Phase B not found under {INPUT_BASE}")
    for board_dir in sorted(root.iterdir()):
        if board_dir.is_dir():
            board_ci = board_dir.name.lower()
            if board_ci not in INCLUDE_BOARDS_CI:
                continue
            for f in sorted(board_dir.glob("*.html")):
                post_id = f.stem
                plan_board = plan_lookup.get((board_ci, post_id))
                if plan_board is None:
                    # Unknown to plan — log and skip.
                    continue
                if board_filter and plan_board != board_filter:
                    continue
                files.append((plan_board, post_id, f))
    return files


def needs_processing(
    plan_board: str,
    post_id: str,
    force: bool,
) -> bool:
    if force:
        return True
    output_board = map_output_board(plan_board)
    output_path = OUTPUT_DIR / output_board / f"{post_id}.json"
    return not output_path.exists()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="ETL Stage 2d — Gnuboard5 st-basic parser (P2.3)."
    )
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--board", help="restrict to one plan-board id")
    parser.add_argument("--print-every", type=int, default=10)
    args = parser.parse_args()

    plan_lookup = load_plan_lookup()
    capture_lookup = load_capture_lookup()

    inputs = iter_input_files(args.board, plan_lookup)
    todo: list[tuple[str, str, Path]] = []
    skipped = 0
    for plan_board, post_id, path in inputs:
        if needs_processing(plan_board, post_id, args.force):
            todo.append((plan_board, post_id, path))
        else:
            skipped += 1
    if args.limit:
        todo = todo[: args.limit]

    print(
        f"[02d-parse-g5] planned={len(inputs)} todo={len(todo)} skipped={skipped} "
        f"input={INPUT_BASE}/{{A,B}} output={OUTPUT_DIR} dry_run={args.dry_run}",
        file=sys.stderr,
    )
    if not todo:
        return

    stats = Stats()
    parsed_at = datetime.now()
    last_print = 0
    for i, (plan_board, post_id, path) in enumerate(todo, 1):
        stats.total += 1
        captured_at = capture_lookup.get((plan_board.lower(), post_id))
        if not captured_at:
            stats.failed_parse += 1
            _append_failure(
                {
                    "input": str(path),
                    "plan_board": plan_board,
                    "post_id": post_id,
                    "error": "no_capture_ts",
                    "stage": "lookup",
                }
            )
            continue
        try:
            html = path.read_text(encoding="utf-8")
        except UnicodeDecodeError as e:
            stats.failed_parse += 1
            _append_failure(
                {"input": str(path), "error": f"decode: {e}", "stage": "read"}
            )
            continue
        try:
            post = parse_one(plan_board, post_id, html, captured_at, parsed_at)
        except _NonPostPage as e:
            stats.skipped_no_content += 1
            stats.skipped_reasons[e.reason] += 1
            stats.per_board_skipped[plan_board] += 1
            _append_failure(
                {
                    "input": str(path),
                    "plan_board": plan_board,
                    "post_id": post_id,
                    "error": e.reason,
                    "stage": "skipped_no_content",
                }
            )
            continue
        except ValidationError as e:
            stats.failed_validate += 1
            stats.per_board_failed[plan_board] += 1
            _append_failure(
                {
                    "input": str(path),
                    "plan_board": plan_board,
                    "post_id": post_id,
                    "error": str(e)[:300],
                    "stage": "validate",
                }
            )
            continue
        except Exception as e:  # noqa: BLE001
            stats.failed_parse += 1
            stats.per_board_failed[plan_board] += 1
            _append_failure(
                {
                    "input": str(path),
                    "plan_board": plan_board,
                    "post_id": post_id,
                    "error": f"{type(e).__name__}: {e}",
                    "stage": "parse",
                }
            )
            continue

        if not args.dry_run:
            output_board = map_output_board(plan_board)
            output_path = OUTPUT_DIR / output_board / f"{post_id}.json"
            output_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = output_path.with_suffix(output_path.suffix + ".tmp")
            tmp.write_text(
                post.model_dump_json(indent=2) + "\n", encoding="utf-8"
            )
            tmp.replace(output_path)

        stats.success += 1
        stats.body_chars += len(post.bodyText)
        if post.comments:
            stats.posts_with_comments += 1
        stats.per_board[map_output_board(plan_board)] += 1

        if i - last_print >= args.print_every or i == len(todo):
            elapsed = max(time.time() - stats.start_ts, 0.001)
            print(
                f"[{i:>4}/{len(todo)}] ok={stats.success} "
                f"parse_err={stats.failed_parse} valid_err={stats.failed_validate} "
                f"skipped={stats.skipped_no_content} "
                f"comments={stats.posts_with_comments} "
                f"{i/elapsed:.1f}/s",
                file=sys.stderr,
            )
            last_print = i

    _write_summary(stats)
    reasons = dict(stats.skipped_reasons)
    print(
        f"\n[02d-parse-g5] DONE total={stats.total} ok={stats.success} "
        f"parse_err={stats.failed_parse} valid_err={stats.failed_validate} "
        f"skipped_no_content={stats.skipped_no_content} ({reasons})",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
