#!/usr/bin/env python3
"""ETL Phase B (ADR-0010 §Decision #2) — Build the image manifest.

Walks every gold-tier Post JSON and records each `<img>` reference (body +
comment emoticons) as one line of `image-manifest.jsonl`. The manifest is
the single source of truth for what we *want* to recover in Phase C/D —
chrome assets, dedup, and CDX coverage decisions all derive from it.

Inputs:
    src/content/posts/{board}/{post_id}.json     (Phase A2 gold tier)

Outputs:
    scripts/etl/image-manifest.jsonl             one line per <img> reference
    scripts/etl/.image-manifest-summary.json     per-host / per-source counts

Manifest fields per line (stable schema):
    board, post_id           — gold-tier identity
    source                   — "body" | "comment"
    comment_index            — int (0-indexed) when source == "comment", else None
    raw_src                  — original src attribute, untouched; for a tag
                               Phase F already rewrote, its `data-original-src`
    recovery_state           — "pending" (never rewritten) | "ok" (on disk)
                               | "failed" (placeholder) — Phase F's verdict
    base_url                 — post.originalUrl, used as urljoin base
    normalized_url           — urljoin(base_url, raw_src)
    candidates               — list of variant URLs for CDX matching
    post_wayback_ts          — post.capturedAt (Phase A2 single source of truth)

Skipped src patterns (do not emit):
    - empty / whitespace
    - already-rewritten paths (`/img/posts/`, `/img/placeholder/`) that lost
      their `data-original-src` — nothing left to look up
    - `data:` (inline base64 — can't recover from Wayback)
    - `javascript:` / `mailto:` / `about:`
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup, Tag

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
INPUT_DIR = PROJECT_ROOT / "src" / "content" / "posts"
OUTPUT_FILE = PROJECT_ROOT / "scripts" / "etl" / "image-manifest.jsonl"
SUMMARY_FILE = PROJECT_ROOT / "scripts" / "etl" / ".image-manifest-summary.json"

# Phase F rewrites `src` in place and keeps the original on this attribute.
# Before the collection audit (2026-09-19) rewritten tags were skipped, so a
# placeholder could never be retried — 3,781 failed body refs were invisible
# to every later join.
_ORIGINAL_SRC_ATTR = "data-original-src"
_REWRITTEN_SRC_PREFIXES = ("/img/posts/", "/img/placeholder/")

# src prefixes we never want to emit as recovery targets.
_SKIP_SRC_PREFIXES = (
    "data:",                # inline base64 — not on Wayback
    "javascript:",
    "mailto:",
    "about:",
    "#",                    # fragment-only
)


@dataclass
class ImgRef:
    raw_src: str
    source: str                   # "body" | "comment"
    comment_index: int | None     # which comment (0-based) for source="comment"
    recovery_state: str           # "pending" | "ok" | "failed"


def iter_imgs(html: str, *, source: str, comment_index: int | None) -> Iterator[ImgRef]:
    """Yield every `<img src=...>` from one HTML chunk, skipping bad srcs."""
    if not html or "<img" not in html.lower():
        return
    soup = BeautifulSoup(html, "lxml")
    for img in soup.find_all("img"):
        if not isinstance(img, Tag):
            continue
        raw = img.get("src")
        if not isinstance(raw, str):
            continue
        src = raw.strip()
        if not src:
            continue
        state = "pending"
        if src.startswith(_REWRITTEN_SRC_PREFIXES):
            original = img.get(_ORIGINAL_SRC_ATTR)
            if not isinstance(original, str) or not original.strip():
                continue
            state = "ok" if src.startswith("/img/posts/") else "failed"
            src = original.strip()
        lowered = src.lower()
        if any(lowered.startswith(p) for p in _SKIP_SRC_PREFIXES):
            continue
        yield ImgRef(
            raw_src=src, source=source, comment_index=comment_index, recovery_state=state
        )


def extract_post_refs(post: dict) -> Iterator[ImgRef]:
    yield from iter_imgs(post.get("bodyHtml", ""), source="body", comment_index=None)
    for i, comment in enumerate(post.get("comments", [])):
        yield from iter_imgs(
            comment.get("bodyHtml", ""), source="comment", comment_index=i
        )


def build_candidates(base_url: str, raw_src: str) -> tuple[str, list[str]]:
    """Return `(normalized_url, candidates)` — variants worth trying against CDX.

    Variants we generate (most-specific first so the first hit wins):
      1. normalized_url itself                — urljoin result
      2. :80 strip variant                    — Wayback CDX rows often drop default port
      3. :80 add variant                      — and sometimes preserve it explicitly
      4. with-`www.` host variant
      5. without-`www.` host variant

    We do *not* generate CP949 / UTF-8 percent-encoding variants here because
    the gold-tier raw_src is already byte-faithful to the original markup;
    Phase C will normalise percent-encoding on the canonical-key side at
    join time, where it belongs (one place to reason about).
    """
    normalized = urljoin(base_url, raw_src)
    seen: set[str] = set()
    candidates: list[str] = []

    def add(url: str) -> None:
        if url and url not in seen:
            seen.add(url)
            candidates.append(url)

    add(normalized)

    parts = urlsplit(normalized)
    if not parts.netloc:
        # Probably a non-http scheme that escaped the skip filter (e.g. ftp,
        # IRC). Keep the bare normalized form as the only candidate so Phase C
        # marks it unrecoverable cleanly.
        return normalized, candidates

    netloc = parts.netloc
    host = parts.hostname or ""
    explicit_port = (
        f":{parts.port}" if parts.port not in (None, 80, 443) else ""
    )

    # Default-port toggle.
    if ":80" in netloc:
        no_port = host + explicit_port
        add(urlunsplit((parts.scheme, no_port, parts.path, parts.query, parts.fragment)))
    elif parts.scheme == "http" and parts.port in (None, 80):
        with_port = f"{host}:80{explicit_port}"
        add(urlunsplit((parts.scheme, with_port, parts.path, parts.query, parts.fragment)))

    # www. toggle (only meaningful for hosts with at least two labels).
    if host.startswith("www.") and host.count(".") >= 2:
        no_www = host[4:]
        for nl in (no_www, f"{no_www}:80") if parts.scheme == "http" else (no_www,):
            add(urlunsplit((parts.scheme, nl, parts.path, parts.query, parts.fragment)))
    elif host and host.count(".") >= 1 and not host.startswith("www."):
        with_www = f"www.{host}"
        for nl in (with_www, f"{with_www}:80") if parts.scheme == "http" else (with_www,):
            add(urlunsplit((parts.scheme, nl, parts.path, parts.query, parts.fragment)))

    return normalized, candidates


def main() -> int:
    description = (__doc__ or "extract image references from gold-tier posts").split(
        "\n", 1
    )[0]
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument(
        "--dry-run", action="store_true", help="parse + summarise; do not write"
    )
    parser.add_argument(
        "--limit", type=int, default=0, help="process only the first N posts (0=all)"
    )
    parser.add_argument(
        "--print-every", type=int, default=2000, help="progress cadence"
    )
    args = parser.parse_args()

    if not INPUT_DIR.is_dir():
        sys.exit(f"FATAL: input directory not found: {INPUT_DIR}")

    post_files = sorted(
        f for board_dir in sorted(INPUT_DIR.iterdir())
        if board_dir.is_dir()
        for f in sorted(board_dir.glob("*.json"))
    )
    if args.limit:
        post_files = post_files[: args.limit]

    print(
        f"[extract-image-urls] posts={len(post_files)} input={INPUT_DIR} "
        f"output={OUTPUT_FILE} dry_run={args.dry_run}",
        file=sys.stderr,
    )

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUTPUT_FILE.with_suffix(OUTPUT_FILE.suffix + ".tmp")

    posts_with_imgs = 0
    body_refs = 0
    comment_refs = 0
    host_counter: Counter[str] = Counter()
    source_counter: Counter[str] = Counter()
    state_counter: Counter[str] = Counter()
    skipped_no_ts: list[tuple[str, str]] = []

    out_handle = None if args.dry_run else tmp.open("w", encoding="utf-8")

    try:
        for i, f in enumerate(post_files, 1):
            post = json.loads(f.read_text(encoding="utf-8"))
            board = post["board"]
            post_id = post["postId"]
            base_url = post["originalUrl"]
            ts = post.get("capturedAt")
            if not ts:
                # Phase A2 contract guarantees this is set; record + skip if not.
                skipped_no_ts.append((board, post_id))
                continue

            had_ref = False
            for ref in extract_post_refs(post):
                normalized, candidates = build_candidates(base_url, ref.raw_src)
                host = (urlsplit(normalized).hostname or "").lower()
                host_counter[host] += 1
                source_counter[ref.source] += 1
                state_counter[ref.recovery_state] += 1
                if ref.source == "body":
                    body_refs += 1
                else:
                    comment_refs += 1
                had_ref = True

                if out_handle is not None:
                    out_handle.write(
                        json.dumps(
                            {
                                "board": board,
                                "post_id": post_id,
                                "source": ref.source,
                                "comment_index": ref.comment_index,
                                "raw_src": ref.raw_src,
                                "base_url": base_url,
                                "normalized_url": normalized,
                                "candidates": candidates,
                                "post_wayback_ts": ts,
                                "recovery_state": ref.recovery_state,
                            },
                            ensure_ascii=False,
                        )
                        + "\n"
                    )

            if had_ref:
                posts_with_imgs += 1

            if i % args.print_every == 0 or i == len(post_files):
                print(
                    f"[{i:>5}/{len(post_files)}] posts_with_imgs={posts_with_imgs} "
                    f"body={body_refs} comment={comment_refs}",
                    file=sys.stderr,
                    flush=True,
                )
    finally:
        if out_handle is not None:
            out_handle.close()

    if not args.dry_run:
        tmp.replace(OUTPUT_FILE)

    summary = {
        "posts_total": len(post_files),
        "posts_with_imgs": posts_with_imgs,
        "body_refs": body_refs,
        "comment_refs": comment_refs,
        "total_refs": body_refs + comment_refs,
        "by_source": dict(source_counter),
        "by_recovery_state": dict(state_counter),
        "top_hosts": dict(host_counter.most_common(20)),
        "host_count": len(host_counter),
        "skipped_no_ts": [list(t) for t in skipped_no_ts],
        "output": str(OUTPUT_FILE),
        "dry_run": args.dry_run,
    }
    SUMMARY_FILE.write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    print(
        f"\n[extract-image-urls] DONE posts={len(post_files)} "
        f"posts_with_imgs={posts_with_imgs} total_refs={body_refs + comment_refs} "
        f"unique_hosts={len(host_counter)} skipped_no_ts={len(skipped_no_ts)}",
        file=sys.stderr,
    )
    if skipped_no_ts:
        print(
            "WARNING: posts without capturedAt — A2 contract violation, "
            "should not happen after the fail-loud parser change.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
