#!/usr/bin/env python3
"""Analyze CDX harvest: dedup by post identity, apply E-policy (latest 200 with max length).

Prints the per-board breakdown. `--out PATH` also writes the plan there.
`.docs/research/cdx/e-policy-plan.json` is the plan every parser stamps
`capturedAt` from and may carry manual edits, so writing over an existing
file takes `--force`.
"""
import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote

CDX_DIR = Path(__file__).resolve().parent.parent.parent / ".docs" / "research" / "cdx"

# 12 UO 본판 게시판 (Phase A)
PHASE_A = {
    # Zeroboard era IDs
    "UoBoard", "UoBoard2", "Q_A", "Role", "UOForum",
    "Notice", "Events", "column", "Recall",
    "ScreenShot", "HouseScreenshot", "Items",
}
# Phase B: 확장 게시판 + 거래/유머/잡동
PHASE_B = {
    "Tarirang", "Tarirang2", "Tbalhae", "Vendor", "Sell",
    "FunBoard", "porato", "Trash", "Reveal",
    "knowledge", "monster", "Ogame",
    "DF", "LoL", "Star2", "Console", "Shop", "Boo", "Ultima",
    "Diablo",
    # forg.kr g5 IDs
    "ultima", "trtrtr", "gonggg", "aseeee",
    "free", "humorrr", "screee", "dataaa", "qnaaa", "notice",
}


def post_key(url: str):
    """Return (board_id, post_id) from a board URL, or None if not a post."""
    p = urlparse(url)
    qs = parse_qs(p.query)

    # Zeroboard: zboard.php?id=X&no=N
    if "/zboard.php" in p.path or "/zboard.php" == p.path.split(":")[0].split("/")[-1]:
        bid = qs.get("id", [None])[0]
        pid = qs.get("no", [None])[0]
        if bid and pid:
            return ("zb", bid, pid)
        if bid:
            return ("zb-list", bid, qs.get("page", ["1"])[0])

    # Gnuboard: bbs/board.php?bo_table=X&wr_id=N
    if "/bbs/board.php" in p.path or p.path.endswith("/board.php"):
        bid = qs.get("bo_table", [None])[0]
        pid = qs.get("wr_id", [None])[0]
        if bid and pid:
            return ("g", bid, pid)
        if bid:
            return ("g-list", bid, qs.get("page", ["1"])[0])

    return None


def load_cdx(path: Path):
    with path.open() as f:
        rows = json.load(f)
    if not rows:
        return []
    header, *data = rows
    cols = {name: i for i, name in enumerate(header)}
    out = []
    for r in data:
        try:
            out.append({
                "ts": r[cols["timestamp"]],
                "url": r[cols["original"]],
                "status": r[cols["statuscode"]],
                "mime": r[cols["mimetype"]],
                "length": int(r[cols["length"]] or 0),
                "digest": r[cols["digest"]],
            })
        except (IndexError, KeyError, ValueError):
            continue
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--out", type=Path, help="write the plan here (e.g. .docs/research/cdx/e-policy-plan.json)")
    ap.add_argument("--force", action="store_true", help="overwrite --out if it exists")
    args = ap.parse_args()
    if args.out and args.out.exists() and not args.force:
        sys.exit(f"{args.out} exists — it may hold manual edits; pass --force to overwrite it")

    files = ["zb-posts.json", "g4-posts.json", "g5-posts.json"]
    all_rows = []
    for f in files:
        rows = load_cdx(CDX_DIR / f)
        print(f"{f}: {len(rows)} captures", file=sys.stderr)
        all_rows.extend(rows)

    # Group by post identity
    by_post = defaultdict(list)
    listings = defaultdict(list)
    skipped = 0
    for r in all_rows:
        k = post_key(r["url"])
        if not k:
            skipped += 1
            continue
        if k[0] in ("zb-list", "g-list"):
            listings[k].append(r)
        else:
            by_post[k].append(r)

    print(f"\nSkipped (non-post URLs): {skipped}", file=sys.stderr)
    print(f"Unique posts: {len(by_post)}", file=sys.stderr)
    print(f"Unique board listings: {len(listings)}", file=sys.stderr)

    # E-policy: pick best capture per post
    chosen = {}
    no_200 = []
    for k, captures in by_post.items():
        ok = [c for c in captures if c["status"] == "200" and c["mime"] == "text/html"]
        if ok:
            # A capture whose URL carries raw non-ASCII bytes (a Korean
            # `keyword=` the CDX hands back as Latin-1 mojibake) does not
            # replay under any encoding — FunBoard/2012's longest capture
            # 404s while its CP949-percent-encoded 2002 capture serves.
            # Prefer a URL Wayback can resolve, then length, then recency.
            best = max(ok, key=lambda c: (c["url"].isascii(), c["length"], c["ts"]))
            chosen[k] = best
        else:
            no_200.append((k, captures))

    print(f"Posts with 200 capture: {len(chosen)}", file=sys.stderr)
    print(f"Posts with no 200 (only redirect/error): {len(no_200)}", file=sys.stderr)

    # Per-board breakdown
    by_board = defaultdict(lambda: {"count": 0, "bytes": 0})
    for (era, bid, pid), best in chosen.items():
        by_board[bid]["count"] += 1
        by_board[bid]["bytes"] += best["length"]

    print(f"\n=== Per-board (E-policy chosen captures) ===")
    print(f"{'board':<20} {'count':>7} {'MB':>8}  phase")
    for bid in sorted(by_board, key=lambda b: -by_board[b]["count"]):
        info = by_board[bid]
        phase = "A" if bid in PHASE_A else ("B" if bid in PHASE_B else "?")
        print(f"{bid:<20} {info['count']:>7} {info['bytes']/1024/1024:>8.1f}  {phase}")

    # Phase A summary
    pa_posts = sum(by_board[b]["count"] for b in PHASE_A if b in by_board)
    pa_bytes = sum(by_board[b]["bytes"] for b in PHASE_A if b in by_board)
    pb_posts = sum(by_board[b]["count"] for b in PHASE_B if b in by_board)
    pb_bytes = sum(by_board[b]["bytes"] for b in PHASE_B if b in by_board)
    other_posts = sum(by_board[b]["count"] for b in by_board if b not in PHASE_A and b not in PHASE_B)

    print(f"\n=== Summary ===")
    print(f"Phase A (UO core 12 boards):  {pa_posts:>6} posts, {pa_bytes/1024/1024:>7.1f} MB HTML")
    print(f"Phase B (community boards):   {pb_posts:>6} posts, {pb_bytes/1024/1024:>7.1f} MB HTML")
    print(f"Other/unknown:                {other_posts:>6} posts")
    print(f"Total chosen:                 {len(chosen):>6} posts, {sum(c['length'] for c in chosen.values())/1024/1024:>7.1f} MB HTML")

    if not args.out:
        print("\nNo --out: plan not written.", file=sys.stderr)
        return

    plan = []
    for (era, bid, pid), best in chosen.items():
        plan.append({
            "era": era,
            "board": bid,
            "post_id": pid,
            "phase": "A" if bid in PHASE_A else ("B" if bid in PHASE_B else "C"),
            "ts": best["ts"],
            "url": best["url"],
            "length": best["length"],
            "digest": best["digest"],
        })
    plan.sort(key=lambda x: (x["phase"], x["board"], x["post_id"]))
    # `x` without --force: also refuse a file that appeared while this ran.
    with args.out.open("w" if args.force else "x", encoding="utf-8") as f:
        f.write(json.dumps(plan, ensure_ascii=False, indent=1))
    print(f"\nPlan written: {args.out} ({len(plan)} entries)", file=sys.stderr)


if __name__ == "__main__":
    main()
