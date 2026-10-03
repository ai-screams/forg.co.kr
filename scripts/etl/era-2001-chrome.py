#!/usr/bin/env python3
"""Copy the 2001 front page's artwork into the 2001 chrome pool.

The 2001 era (ADR-0019) draws the site as it stood in August 2001: the top
frame `forg_t.htm` (banner and 55×20 menu buttons) over the front page
`forg_b.htm`. Those pictures were recovered as site images
(`public/img/posts/site/`, R2) for the guide-page captures; the era chrome
lives in git under `public/img/chrome/2001/` like the 2003 and 2014 pools
(`src/lib/chrome.ts`), so this copies them there with the capture each came
from (the site image sidecars).

USAGE
    python3 scripts/etl/era-2001-chrome.py [--dry-run]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SITE_IMG = PROJECT_ROOT / "public" / "img" / "posts" / "site"
OUT = PROJECT_ROOT / "public" / "img" / "chrome" / "2001"

# Site image path → chrome filename. forg_t 2001-08-03 and forg_b 2001-08-03.
FILES = {
    "t_logo.gif": "t_logo.gif",
    "t_logo_r.gif": "t_logo_r.gif",
    "images/t_l.gif": "t_l.gif",
    "images/t_r.gif": "t_r.gif",
    "images/m_m.gif": "m_m.gif",
    "images/m_n.gif": "m_n.gif",
    "images/m_c.gif": "m_c.gif",
    "images/m_j.gif": "m_j.gif",
    "images/m_t.gif": "m_t.gif",
    "images/m_map.gif": "m_map.gif",
    "images/m_f.gif": "m_f.gif",
    "images/m_q.gif": "m_q.gif",
    "images/m_r.gif": "m_r.gif",
    "images/m_e.gif": "m_e.gif",
    "images/m_b.gif": "m_b.gif",
    "images/m_fun.gif": "m_fun.gif",
    "images/m_s.gif": "m_s.gif",
    "images/m_k.gif": "m_k.gif",
    "left_logo_uo_1.gif": "left_logo_uo_1.gif",
    "forg_main_logo_1.gif": "forg_main_logo_1.gif",
    "main_notice.gif": "main_notice.gif",
    "main_notice_1.gif": "main_notice_1.gif",
    "freeboard.gif": "freeboard.gif",
    "question.gif": "question.gif",
    "images/a.gif": "a.gif",
    "best_screen.gif": "best_screen.gif",
}


def sidecar_entry(path: str) -> dict:
    folder, name = (SITE_IMG / path).parent, path.rsplit("/", 1)[-1]
    entries = json.loads((folder / ".manifest.json").read_text(encoding="utf-8"))
    return next(e for e in entries if e["filename"] == name)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    manifest = []
    for src, name in FILES.items():
        data = (SITE_IMG / src).read_bytes()
        meta = sidecar_entry(src)
        manifest.append({
            "originalPath": "/" + src,
            "originalUrl": meta["originalUrl"],
            "filename": name,
            "capturedAt": meta["capturedAt"],
            "sizeBytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
            "mimetype": "image/gif",
        })
        if not args.dry_run:
            OUT.mkdir(parents=True, exist_ok=True)
            (OUT / name).write_bytes(data)
    if not args.dry_run:
        (OUT / ".manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"[era-2001-chrome] {len(manifest)} files"
          f" ({min(m['capturedAt'] for m in manifest)}–{max(m['capturedAt'] for m in manifest)})",
          file=sys.stderr)


if __name__ == "__main__":
    main()
