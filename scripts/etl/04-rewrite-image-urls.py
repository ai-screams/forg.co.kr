#!/usr/bin/env python3
"""ETL Phase F (ADR-0010 §Decision #5) — rewrite gold-tier <img src> to point
at locally-saved Wayback recoveries (or a museum placeholder).

For every Post JSON we walk every `<img>` in `bodyHtml` and every
`comment.bodyHtml`. Each `<img>` falls into one of four states:

    1. already recovered   src starts with /img/posts/ or /img/emoticon/
                           → leave alone (idempotent re-runs are safe)
                           a placeholder (/img/placeholder/) is looked up
                           again by its data-original-src, so a later
                           Phase C/D retry can promote it to state 2

    2. recoverable + on disk
                           → src = /img/posts/{board}/{post_id}/{filename}
                           → data-recovery="ok"
                           → data-original-src=<original full URL>

    3. recoverable + NOT yet on disk (Phase D in flight or partially failed)
                           → leave alone, next Phase F run will pick it up

    4. unrecoverable / unknown to the pipeline
                           → src = /img/placeholder/missing.svg
                           → data-recovery="failed"
                           → data-original-src=<original full URL>
                           → title="복원 실패 — 원본: <host/path>"

Inputs:
    src/content/posts/{board}/{post_id}.json     gold tier (in-place rewrite)
    scripts/etl/image-download-queue.json         Phase C output
    scripts/etl/image-unrecoverable.jsonl         Phase C analysis output
    public/img/posts/{board}/{post_id}/...        Phase D outputs
    public/img/emoticon/...                       shared emoticon store

The queue entry's `raw_src` is the same value the parser extracted from
the Zeroboard HTML, so `(board, post_id, raw_src)` is the join key we use
when matching an `<img>` to its recovery state. A placeholder carries the
entry's `normalized_url` in `data-original-src` (state 4 writes it), which
differs from `raw_src` whenever the post used a relative src
(`essay/k1.jpg`), so recoverable entries are also keyed by
`(board, post_id, normalized_url)`.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.parse import urlsplit

from bs4 import BeautifulSoup, Tag

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
POSTS_DIR = PROJECT_ROOT / "src" / "content" / "posts"
QUEUE_FILE = PROJECT_ROOT / "scripts" / "etl" / "image-download-queue.json"
UNRECOVERABLE_FILE = PROJECT_ROOT / "scripts" / "etl" / "image-unrecoverable.jsonl"
PLACEHOLDER_REL_URL = "/img/placeholder/missing.svg"


# ── Lookup index ────────────────────────────────────────────────────────


def build_lookup() -> dict[tuple[str, str, str], dict]:
    """Return `(board, post_id, raw_src) -> recovery info`.

    `recovery info` is one of:
        {"state": "recoverable", "normalized_url": str, "target_path": str}
        {"state": "unrecoverable", "normalized_url": str}
    """
    lookup: dict[tuple[str, str, str], dict] = {}

    if QUEUE_FILE.exists():
        queue = json.loads(QUEUE_FILE.read_text(encoding="utf-8"))
        for e in queue:
            info = {
                "state": "recoverable",
                "normalized_url": e["normalized_url"],
                "target_path": e["target_path"],
            }
            lookup[(e["board"], e["post_id"], e["raw_src"])] = info
            lookup.setdefault((e["board"], e["post_id"], e["normalized_url"]), info)

    if UNRECOVERABLE_FILE.exists():
        for line in UNRECOVERABLE_FILE.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                continue
            key = (e["board"], e["post_id"], e["raw_src"])
            # Don't overwrite a recoverable entry with an unrecoverable one
            # (shouldn't happen with current pipeline, but defensive).
            lookup.setdefault(
                key,
                {"state": "unrecoverable", "normalized_url": e["normalized_url"]},
            )

    return lookup


def public_url(target_path: str) -> str:
    """`public/img/posts/B/1/x.gif` → `/img/posts/B/1/x.gif`. Emoticons
    resolve under `/img/emoticon/` the same way."""
    return "/" + target_path.removeprefix("public/")


def short_title_for_failed(original_url: str) -> str:
    """Tooltip text for failed images — keep it short and stable."""
    p = urlsplit(original_url)
    host = p.hostname or ""
    short = host + p.path
    if len(short) > 80:
        short = short[:77] + "..."
    return f"복원 실패 — 원본: {short}"


# ── HTML rewrite ────────────────────────────────────────────────────────


def is_already_recovered(src: str) -> bool:
    return src.startswith(("/img/posts/", "/img/emoticon/"))


def is_placeholder(src: str) -> bool:
    return src.startswith(PLACEHOLDER_REL_URL.rsplit("/", 1)[0] + "/")


def rewrite_html(
    html: str,
    *,
    board: str,
    post_id: str,
    lookup: dict[tuple[str, str, str], dict],
    counters: dict[str, int],
) -> str:
    """Return rewritten HTML and update counters in place.

    The parser + formatter combo is `html.parser + html5`. The built-in
    html.parser preserves leading whitespace (lxml / html5lib both strip
    it during parsing), and the html5 formatter emits `<br>` / `<img>`
    without the XHTML self-closing slash so the rewritten output matches
    the gold-tier serialization style produced by nh3 in
    `02-parse-zeroboard.py`. Failing to match would silently churn every
    body across museum re-runs.
    """
    if not html or "<img" not in html.lower():
        return html
    soup = BeautifulSoup(html, "html.parser")
    changed = False
    for img in soup.find_all("img"):
        if not isinstance(img, Tag):
            continue
        raw_src_val = img.get("src")
        if not isinstance(raw_src_val, str):
            continue
        raw_src = raw_src_val.strip()
        if not raw_src:
            continue
        if is_already_recovered(raw_src):
            counters["skipped_already_rewritten"] += 1
            continue

        retry = is_placeholder(raw_src)
        if retry:
            original = img.get("data-original-src")
            if not isinstance(original, str) or not original.strip():
                counters["skipped_already_rewritten"] += 1
                continue
            raw_src = original.strip()

        info = lookup.get((board, post_id, raw_src))
        if info is None:
            counters["skipped_untracked"] += 1
            continue

        if info["state"] == "recoverable":
            target = PROJECT_ROOT / info["target_path"]
            if not target.exists() or target.stat().st_size == 0:
                # Phase D hasn't fetched this one yet — leave for later run.
                counters["pending_recoverable"] += 1
                continue
            img["src"] = public_url(info["target_path"])
            img["data-recovery"] = "ok"
            img["data-original-src"] = info["normalized_url"]
            if retry:
                del img["title"]
                counters["retried_ok"] += 1
            else:
                counters["rewritten_ok"] += 1
            changed = True
        elif retry:
            # Still unrecoverable — the placeholder is already in place.
            counters["skipped_already_rewritten"] += 1
        else:  # unrecoverable
            img["src"] = PLACEHOLDER_REL_URL
            img["data-recovery"] = "failed"
            img["data-original-src"] = info["normalized_url"]
            img["title"] = short_title_for_failed(info["normalized_url"])
            counters["rewritten_failed"] += 1
            changed = True

    if not changed:
        return html
    # html.parser does not synthesise <html><body>; decode the soup directly.
    # Use the html5 formatter so void elements stay HTML4-style (`<br>`,
    # `<img>`) — see the docstring for why round-trip serialisation matters.
    body = soup.find("body")
    out = body if isinstance(body, Tag) else soup
    return out.decode_contents(formatter="html5")


def rewrite_post(
    post_path: Path,
    *,
    lookup: dict[tuple[str, str, str], dict],
    counters: dict[str, int],
    dry_run: bool,
) -> bool:
    """Rewrite one post's body + comments. Returns True if file was modified."""
    raw = post_path.read_text(encoding="utf-8")
    post = json.loads(raw)
    board = post["board"]
    post_id = post["postId"]

    new_body = rewrite_html(
        post.get("bodyHtml", ""),
        board=board,
        post_id=post_id,
        lookup=lookup,
        counters=counters,
    )
    body_changed = new_body != post.get("bodyHtml", "")

    comments_changed = False
    for c in post.get("comments", []):
        new_c_body = rewrite_html(
            c.get("bodyHtml", ""),
            board=board,
            post_id=post_id,
            lookup=lookup,
            counters=counters,
        )
        if new_c_body != c.get("bodyHtml", ""):
            c["bodyHtml"] = new_c_body
            comments_changed = True

    if not body_changed and not comments_changed:
        return False
    post["bodyHtml"] = new_body
    if dry_run:
        return True
    tmp = post_path.with_suffix(post_path.suffix + ".tmp")
    tmp.write_text(
        json.dumps(post, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    tmp.replace(post_path)
    return True


# ── Driver ──────────────────────────────────────────────────────────────


def iter_post_files(board_filter: str | None) -> list[Path]:
    if not POSTS_DIR.is_dir():
        sys.exit(f"FATAL: posts dir not found: {POSTS_DIR}")
    out: list[Path] = []
    for board_dir in sorted(POSTS_DIR.iterdir()):
        if not board_dir.is_dir():
            continue
        if board_filter and board_dir.name != board_filter:
            continue
        out.extend(sorted(board_dir.glob("*.json")))
    return out


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(__doc__ or "rewrite gold-tier <img src>").split("\n", 1)[0]
    )
    parser.add_argument("--board", default=None, help="restrict to one board id")
    parser.add_argument("--limit", type=int, default=0, help="process at most N posts")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--print-every", type=int, default=500)
    args = parser.parse_args()

    lookup = build_lookup()
    print(f"[rewrite] lookup keys: {len(lookup)}", file=sys.stderr)

    files = iter_post_files(args.board)
    if args.limit:
        files = files[: args.limit]

    counters: dict[str, int] = {
        "rewritten_ok": 0,
        "retried_ok": 0,
        "rewritten_failed": 0,
        "pending_recoverable": 0,
        "skipped_already_rewritten": 0,
        "skipped_untracked": 0,
    }
    posts_changed = 0

    for i, f in enumerate(files, 1):
        try:
            if rewrite_post(
                f, lookup=lookup, counters=counters, dry_run=args.dry_run
            ):
                posts_changed += 1
        except Exception as e:  # noqa: BLE001 — log + continue
            print(f"  ERROR {f}: {type(e).__name__}: {e}", file=sys.stderr)
            continue
        if i % args.print_every == 0 or i == len(files):
            print(
                f"[{i:>5}/{len(files)}] posts_changed={posts_changed} "
                f"ok={counters['rewritten_ok']} retried={counters['retried_ok']} "
                f"failed={counters['rewritten_failed']} "
                f"pending={counters['pending_recoverable']} "
                f"untracked={counters['skipped_untracked']} "
                f"already={counters['skipped_already_rewritten']}",
                file=sys.stderr,
                flush=True,
            )

    print(
        f"\n[rewrite] DONE posts_changed={posts_changed} "
        f"counters={counters} dry_run={args.dry_run}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
