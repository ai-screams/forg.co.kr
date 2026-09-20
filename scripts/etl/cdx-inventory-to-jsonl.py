#!/usr/bin/env python3
"""ETL helper — turn a saved CDX JSON array into a prefix-sweep jsonl.

Some CDX answers were saved by hand before the Phase C sweep existed
(`.docs/research/cdx/site-images.json`, `g4-attachments.json`: 2026-05-02)
and never joined to anything. Meanwhile the sweep's own files for the same
prefixes hold 0 rows — Wayback returned an empty body and `_parse_cdx_chunk`
cached that as "done" (collection audit 2026-09-19, findings #2 and #4).

This writes the saved answer in the sweep's line format so `cdx-image.py
--queue-only` and `wayback_client.local_cdx_rows()` see it.

    .venv/bin/python3 scripts/etl/cdx-inventory-to-jsonl.py \\
        .docs/research/cdx/site-images.json .docs/research/cdx/image-forg-images.jsonl

The saved arrays lack `urlkey`; it is derived in Wayback's SURT form
(`kr,co,forg)/images/5px.gif`). No stage joins on it.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import urlsplit

COLUMNS = ("urlkey", "timestamp", "original", "mimetype", "statuscode", "digest", "length")


def surt_key(url: str) -> str:
    p = urlsplit(url)
    host = (p.hostname or "").lower().removeprefix("www.")
    key = ",".join(reversed(host.split("."))) + ")" + p.path.lower()
    return f"{key}?{p.query.lower()}" if p.query else key


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        sys.exit(f"usage: {argv[0]} <saved-cdx.json> <out.jsonl>")
    src, dst = Path(argv[1]), Path(argv[2])
    try:
        data = json.loads(src.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        data = None
    if not data or not isinstance(data, list) or not isinstance(data[0], list):
        sys.exit(f"{src}: not a CDX JSON array (a saved error page?)")
    header, *rows = data
    cols = {name: i for i, name in enumerate(header)}
    missing = [c for c in COLUMNS if c not in cols and c != "urlkey"]
    if missing:
        sys.exit(f"{src}: header lacks {missing}")

    tmp = dst.with_suffix(dst.suffix + ".tmp")
    written = 0
    with tmp.open("w", encoding="utf-8") as out:
        for r in rows:
            if len(r) < len(header):
                continue
            row = {c: r[cols[c]] for c in COLUMNS if c in cols}
            row["urlkey"] = r[cols["urlkey"]] if "urlkey" in cols else surt_key(row["original"])
            out.write(json.dumps(row, ensure_ascii=False) + "\n")
            written += 1
    tmp.replace(dst)
    print(f"{src.name} -> {dst.name}: {written} rows", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
