#!/usr/bin/env python3
"""Download queue for the images on forg's static pages (after `02g`).

`02g-parse-site.py` writes every forg image a page uses to
`site-image-refs.jsonl` (path, original URL, the page capture's timestamp).
This joins them against the image CDX sweeps (`cdx-image.py`, prefixes
[3], [5] and [7]) and writes `site-image-queue.json` in Phase D's format,
each image saved once at `public/img/posts/site/{original path}` — pages
of one section share their backgrounds and menu buttons.

USAGE
    python3 scripts/etl/cdx-image.py --prefix forg-diablo,…   # sweep first
    python3 scripts/etl/site-image-queue.py
    python3 scripts/etl/download-images.py --queue scripts/etl/site-image-queue.json
    python3 scripts/etl/02g-parse-site.py                      # rewrite to the files
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from wayback_client import canonical_key  # noqa: E402

REFS = HERE / "site-image-refs.jsonl"
QUEUE = HERE / "site-image-queue.json"
MISSES = HERE / "site-image-unrecoverable.jsonl"


def _cdx_image():
    spec = importlib.util.spec_from_file_location("cdx_image", HERE / "cdx-image.py")
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> None:
    cdx = _cdx_image()
    index, total = cdx.load_cdx_index([slug for slug, _ in cdx.PREFIX_LIST])
    refs = [json.loads(line) for line in REFS.read_text().splitlines() if line.strip()]
    queue, misses = [], []
    for ref in refs:
        row = cdx.pick_cdx_row(index.get(canonical_key(ref["url"]), []), ref["ts"])
        if row is None:
            misses.append(ref)
            continue
        queue.append({
            "board": "site",
            "post_id": ref["path"].rsplit("/", 1)[0] if "/" in ref["path"] else "",
            "source": "site-page",
            "page": ref["page"],
            "normalized_url": ref["url"],
            "wayback_ts": row["timestamp"],
            "wayback_original": row["original"],
            "cdx_digest": row.get("digest"),
            "target_path": f"public/img/posts/site/{ref['path']}",
            "filename": ref["path"].rsplit("/", 1)[-1],
        })
    QUEUE.write_text(json.dumps(queue, ensure_ascii=False, indent=2) + "\n")
    with MISSES.open("w") as fh:
        for ref in misses:
            fh.write(json.dumps(ref, ensure_ascii=False) + "\n")
    print(f"[site-image-queue] cdx_rows={total} refs={len(refs)} queued={len(queue)} "
          f"unrecoverable={len(misses)}", file=sys.stderr)


if __name__ == "__main__":
    main()
