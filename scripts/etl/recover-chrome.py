#!/usr/bin/env python3
"""ETL helper — recover forg.co.kr chrome assets via single-URL Wayback CDX probes.

ADR-0010's Phase C prefix CDX query returned 0 rows for `forg.co.kr/images/`,
`/skin/`, `_zb/images/`, and `_zb/skin/`. A targeted single-URL probe shows
the picture is more nuanced: Wayback has captured **some** files in those
prefixes (left_logo1.gif, t_bar.gif) — they just don't surface via prefix
matching. This script walks the chrome inventory documented in
.docs/research/FORG-RECONSTRUCTION-GUIDE.md and recovers what's available.

Inputs:
    None — the CHROME_TARGETS list below is the source of truth.

Outputs:
    public/img/chrome/{path-segment-flattened}.gif    recovered binary
    public/img/chrome/.manifest.json                  flat sidecar:
        [{originalPath, filename, capturedAt, sizeBytes, sha256}]
    .docs/research/cdx/.chrome-recovery-report.json   stats sidecar (gitignored)

Polite policy: same fcntl.flock global slot as Phase D. Even if both run
side-by-side, Wayback sees one in-flight request total.

Re-runs are idempotent — files already on disk + non-empty are skipped.
The single-URL CDX probe picks the latest valid `image/*` capture in the
1999-2015 window (matches forg's active years).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode

sys.path.insert(0, str(Path(__file__).resolve().parent))
from wayback_client import (  # noqa: E402
    WaybackError,
    WaybackGoneError,
    fetch_with_retry,
    global_polite_slot,
    wayback_url,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
OUT_DIR = PROJECT_ROOT / "public" / "img" / "chrome"
MANIFEST_FILE = OUT_DIR / ".manifest.json"
REPORT_FILE = PROJECT_ROOT / ".docs" / "research" / "cdx" / ".chrome-recovery-report.json"

CDX_ENDPOINT = "https://web.archive.org/cdx/search/cdx"
DEFAULT_FROM = "19990101000000"
DEFAULT_TO = "20151231235959"


# Each target: (originalPath, savedFilename). originalPath is the
# server-relative URL we ask Wayback for. savedFilename is what we drop
# into public/img/chrome/. We flatten the structure so the 2014 main
# page can refer to assets with a single base path.
CHROME_TARGETS: list[tuple[str, str]] = [
    # ── Brand / sidebar background ──────────────────────────────────────
    ("/images/left_logo1.gif",        "left_logo1.gif"),
    ("/images/l_forg_logo.gif",       "l_forg_logo.gif"),
    ("/images/left_background.gif",   "left_background.gif"),
    ("/images/left_bg.gif",           "left_bg.gif"),
    # ── Accent rules ────────────────────────────────────────────────────
    ("/images/t_bar.gif",             "t_bar.gif"),
    ("/images/t_line.gif",            "t_line.gif"),
    ("/images/m_bar.gif",             "m_bar.gif"),
    ("/images/m_bar_logo.gif",        "m_bar_logo.gif"),
    ("/images/m_bar_b_1.gif",         "m_bar_b_1.gif"),
    ("/images/m_line.gif",            "m_line.gif"),
    ("/images/m_line_l.gif",          "m_line_l.gif"),
    ("/images/m_line_r.gif",          "m_line_r.gif"),
    # ── Login / signup ──────────────────────────────────────────────────
    ("/images/t_login.gif",           "t_login.gif"),
    ("/images/t_login_1.gif",         "t_login_1.gif"),
    ("/images/t_sign.gif",            "t_sign.gif"),
    ("/images/t_sign_1.gif",          "t_sign_1.gif"),
    # ── 2014 7-button top menu (with hover variants) ────────────────────
    ("/images/t_b_freeboard.gif",     "t_b_freeboard.gif"),
    ("/images/t_b_freeboard_1.gif",   "t_b_freeboard_1.gif"),
    ("/images/t_b_photo.gif",         "t_b_photo.gif"),
    ("/images/t_b_photo_1.gif",       "t_b_photo_1.gif"),
    ("/images/t_b_fun.gif",           "t_b_fun.gif"),
    ("/images/t_b_fun_1.gif",         "t_b_fun_1.gif"),
    ("/images/t_b_movie.gif",         "t_b_movie.gif"),
    ("/images/t_b_movie_1.gif",       "t_b_movie_1.gif"),
    ("/images/t_b_boo.gif",           "t_b_boo.gif"),
    ("/images/t_b_boo_1.gif",         "t_b_boo_1.gif"),
    ("/images/t_b_tra.gif",           "t_b_tra.gif"),
    ("/images/t_b_tra_1.gif",         "t_b_tra_1.gif"),
    ("/images/t_b_trash.gif",         "t_b_trash.gif"),
    ("/images/t_b_trash_1.gif",       "t_b_trash_1.gif"),
    # ── 2003 8-button top menu (kept for the 2003 toggle later) ─────────
    ("/images/t_b_question.gif",      "t_b_question.gif"),
    ("/images/t_b_question_1.gif",    "t_b_question_1.gif"),
    ("/images/t_b_roleplay.gif",      "t_b_roleplay.gif"),
    ("/images/t_b_roleplay_1.gif",    "t_b_roleplay_1.gif"),
    ("/images/t_b_essay.gif",         "t_b_essay.gif"),
    ("/images/t_b_essay_1.gif",       "t_b_essay_1.gif"),
    ("/images/t_b_screenshot.gif",    "t_b_screenshot.gif"),
    ("/images/t_b_screenshot_1.gif",  "t_b_screenshot_1.gif"),
    ("/images/t_b_kal.gif",           "t_b_kal.gif"),
    ("/images/t_b_kal_1.gif",         "t_b_kal_1.gif"),
    ("/images/t_hi.gif",              "t_hi.gif"),
    ("/images/t_hi_1.gif",            "t_hi_1.gif"),
    ("/images/t_b_right.gif",         "t_b_right.gif"),
    # ── Sidebar section headers (2003 frameset era) ─────────────────────
    ("/images/m_info.gif",            "m_info.gif"),
    ("/images/m_co.gif",              "m_co.gif"),
    ("/images/m_remember.gif",        "m_remember.gif"),
    ("/images/m_forg.gif",            "m_forg.gif"),
    ("/images/m_friend.gif",          "m_friend.gif"),
    # ── Main content section headers ────────────────────────────────────
    ("/images/m_notice.gif",          "m_notice.gif"),
    ("/images/m_role.gif",            "m_role.gif"),
    ("/images/m_column.gif",          "m_column.gif"),
    # ── Right sidebar headers ───────────────────────────────────────────
    ("/images/r_freeboard.gif",       "r_freeboard.gif"),
    ("/images/r_role.gif",            "r_role.gif"),
    ("/images/r_essay.gif",           "r_essay.gif"),
    ("/images/r_screen.gif",          "r_screen.gif"),
    # ── 6-box main grid headers ─────────────────────────────────────────
    *(
        (f"/images/main_list_{i}.gif", f"main_list_{i}.gif")
        for i in range(1, 9)
    ),
    # ── Counter / footer ────────────────────────────────────────────────
    ("/images/bgm_bg.gif",            "bgm_bg.gif"),
    ("/images/bgm_right.gif",         "bgm_right.gif"),
    # ── Decorative arrows / spacers ─────────────────────────────────────
    ("/images/a.gif",                 "a.gif"),
    ("/images/menu_arrow.gif",        "menu_arrow.gif"),
    ("/images/menu_arrow_1.gif",      "menu_arrow_1.gif"),
    ("/images/menu_arrow_2.gif",      "menu_arrow_2.gif"),
    # ── Latest-list skin icons ──────────────────────────────────────────
    ("/skin/latest/last_forg/img/icon_link.gif",  "skin_icon_link.gif"),
    ("/skin/latest/last_forg/img/icon_hot.gif",   "skin_icon_hot.gif"),
    ("/skin/latest/last_forg/img/icon_file.gif",  "skin_icon_file.gif"),
    ("/skin/latest/last_forg/img/icon_reply.gif", "skin_icon_reply.gif"),
]


# ── CDX probe ───────────────────────────────────────────────────────────


def cdx_probe(path: str, *, from_ts: str, to_ts: str) -> dict | None:
    """Run a single-URL CDX query for `forg.co.kr{path}`. Pick the latest
    `status==200 + mimetype image/*` row, return the picked CDX row dict
    or None if no valid capture exists.
    """
    target = f"forg.co.kr{path}"
    params = {
        "url": target,
        "output": "json",
        "from": from_ts,
        "to": to_ts,
        "limit": "20",
        # Single URL queries default to exact match — no matchType=prefix.
    }
    url = f"{CDX_ENDPOINT}?{urlencode(params)}"
    with global_polite_slot():
        try:
            raw = fetch_with_retry(url)
        except (WaybackGoneError, WaybackError):
            return None
    try:
        data = json.loads(raw.decode("utf-8") or "[]")
    except json.JSONDecodeError:
        return None
    if not data:
        return None
    header, *rows = data
    cols = {name: i for i, name in enumerate(header)}
    valid = []
    for r in rows:
        if not r or len(r) < len(header):
            continue
        if r[cols["statuscode"]] != "200":
            continue
        if not r[cols["mimetype"]].lower().startswith("image/"):
            continue
        # length parse (CDX may say "-")
        length_raw = r[cols["length"]]
        try:
            length = int(length_raw) if length_raw and length_raw != "-" else 0
        except ValueError:
            length = 0
        if length <= 0:
            continue
        valid.append({
            "timestamp": r[cols["timestamp"]],
            "original":  r[cols["original"]],
            "mimetype":  r[cols["mimetype"]],
            "statuscode": r[cols["statuscode"]],
            "digest":    r[cols["digest"]],
            "length":    length_raw,
        })
    if not valid:
        return None
    # Latest valid capture = biggest timestamp.
    return max(valid, key=lambda v: v["timestamp"])


# ── Per-asset fetch ─────────────────────────────────────────────────────


def fetch_asset(target_path: str, filename: str) -> dict:
    out = OUT_DIR / filename
    if out.exists() and out.stat().st_size > 0:
        return {
            "status": "skipped",
            "path": target_path,
            "filename": filename,
        }

    cdx = cdx_probe(target_path, from_ts=DEFAULT_FROM, to_ts=DEFAULT_TO)
    if cdx is None:
        return {
            "status": "missing",
            "path": target_path,
            "filename": filename,
            "reason": "no_valid_image_row",
        }

    wb = wayback_url(cdx["timestamp"], cdx["original"])
    try:
        with global_polite_slot():
            data = fetch_with_retry(wb)
    except WaybackGoneError as e:
        return {
            "status": "error",
            "path": target_path,
            "filename": filename,
            "wayback_url": wb,
            "error": str(e),
        }
    except WaybackError as e:
        return {
            "status": "error",
            "path": target_path,
            "filename": filename,
            "wayback_url": wb,
            "error": str(e)[:200],
        }

    out.parent.mkdir(parents=True, exist_ok=True)
    sha256_hex = hashlib.sha256(data).hexdigest()
    tmp = out.with_suffix(out.suffix + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(out)
    return {
        "status": "ok",
        "path": target_path,
        "filename": filename,
        "wayback_ts": cdx["timestamp"],
        "wayback_original": cdx["original"],
        "bytes": len(data),
        "sha256": sha256_hex,
        "mimetype": cdx["mimetype"],
    }


# ── Manifest sidecar ────────────────────────────────────────────────────


def update_manifest(entry: dict) -> None:
    """Append (or overwrite by filename) one entry in the flat manifest."""
    if entry.get("status") != "ok":
        return
    entries: list[dict] = []
    if MANIFEST_FILE.exists():
        try:
            entries = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
            if not isinstance(entries, list):
                entries = []
        except json.JSONDecodeError:
            entries = []
    entries = [e for e in entries if e.get("filename") != entry["filename"]]
    entries.append({
        "originalPath": entry["path"],
        "filename":     entry["filename"],
        "capturedAt":   entry["wayback_ts"],
        "sizeBytes":    entry["bytes"],
        "sha256":       entry["sha256"],
        "mimetype":     entry["mimetype"],
    })
    entries.sort(key=lambda e: e["filename"])
    tmp = MANIFEST_FILE.with_suffix(MANIFEST_FILE.suffix + ".tmp")
    tmp.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    tmp.replace(MANIFEST_FILE)


# ── Driver ──────────────────────────────────────────────────────────────


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(__doc__ or "chrome recovery").split("\n", 1)[0]
    )
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--print-every", type=int, default=5)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    targets = CHROME_TARGETS[: args.limit] if args.limit else CHROME_TARGETS
    print(
        f"[recover-chrome] targets={len(targets)} output={OUT_DIR} dry_run={args.dry_run}",
        file=sys.stderr,
    )

    stats = {"ok": 0, "skipped": 0, "missing": 0, "error": 0, "bytes": 0}
    results: list[dict] = []
    last_print = 0
    t0 = time.time()
    for i, (path, filename) in enumerate(targets, 1):
        if args.dry_run:
            print(f"  would probe forg.co.kr{path} -> {filename}", file=sys.stderr)
            continue
        result = fetch_asset(path, filename)
        results.append(result)
        stats[result["status"]] = stats.get(result["status"], 0) + 1
        if result["status"] == "ok":
            stats["bytes"] += result.get("bytes", 0)
            update_manifest(result)
        if i - last_print >= args.print_every or i == len(targets):
            last_print = i
            elapsed = int(time.time() - t0)
            print(
                f"[{i:>3}/{len(targets)}] ok={stats['ok']} skip={stats['skipped']} "
                f"missing={stats['missing']} err={stats['error']} "
                f"{stats['bytes'] / 1024:.1f}KB elapsed={elapsed}s",
                file=sys.stderr,
                flush=True,
            )

    if not args.dry_run:
        REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
        report = {
            "ts": datetime.now().isoformat(timespec="seconds"),
            "targets": len(targets),
            "stats": stats,
            "results": results,
        }
        REPORT_FILE.write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

    print(
        f"\n[recover-chrome] DONE ok={stats['ok']} skip={stats['skipped']} "
        f"missing={stats['missing']} err={stats['error']} "
        f"{stats['bytes'] / 1024:.1f}KB",
        file=sys.stderr,
    )
    if not args.dry_run:
        print(f"Report: {REPORT_FILE.relative_to(PROJECT_ROOT)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
