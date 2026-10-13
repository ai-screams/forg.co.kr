#!/usr/bin/env python3
"""Fill a few missing site images with the identical copy another section kept.

forg copied its shared page frame (the memo-pad borders and the backgrounds
behind them) into each section's own images folder. Wayback kept some
sections' copies and not others: nothing under `skill/images/left_menu/` for
these seven names was captured as an image (the single-URL probe of
2026-10-03 found only redirects, error pages served as 200, and 404s), while
the copies under `map/`, `uocraft/`, `skill_newbie/`, `skill_knowhow/` and
`dungeon/` are byte-identical to each other. `dungeon/` itself lost one: the
panel behind the monster book's text, `alpha_background_1.gif`.

Only the files listed in BORROW: a name shared across sections is no proof on
its own (90 of the 221 names recovered in more than one folder differ;
`b_logo.gif` is each section's logo). A target is filled only when at least
two recovered copies exist and all have one SHA-256; anything else stops the
run. The target folder's `.manifest.json` gets an entry with no `capturedAt`
and the copies it was taken from in `borrowedFrom`.

A folder forg copied whole into a later section fills its own gaps from the
copy (MIRRORED). The Ultima history's pictures (`skill/images/uohistory/`,
2002) reappear under `skill_newbie/images/uohistory/` (captured 2004–2007):
every file both kept is byte-identical, so a picture only the copy kept is
taken for the gap. That needs at least MIN_SHARED files kept in both, all
identical; anything else stops the run. Only pictures a page uses and Wayback
did not keep are copied (`site-image-unrecoverable.jsonl`).

USAGE (after download-images.py, before 02g-parse-site.py)
    python3 scripts/etl/site-image-borrow.py [--dry-run]
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SITE_IMG = PROJECT_ROOT / "public" / "img" / "posts" / "site"
MISSES = PROJECT_ROOT / "scripts" / "etl" / "site-image-unrecoverable.jsonl"

BORROW = [
    "skill/images/left_menu/memo_t.gif",
    "skill/images/left_menu/memo_m.gif",
    "skill/images/left_menu/memo_b.gif",
    "skill/images/left_menu/forg_background.gif",
    "skill/images/left_menu/alpha/alpha_background.gif",
    "skill/images/left_menu/alpha/alpha_background_1.gif",
    "skill/images/left_menu/alpha/alpha_background_2.gif",
    # The text panel of the 2007 monster book and the dungeon maps (87 pages);
    # `dungeon/image/alpha_background.gif` beside it is the shared copy too.
    "dungeon/image/alpha_background_1.gif",
]

MIRRORED = [("skill/images/uohistory", "skill_newbie/images/uohistory")]
MIN_SHARED = 5


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def borrow(root: Path, target: str) -> tuple[bytes, list[str]] | None:
    """The bytes every copy of `target`'s name shares, and the copies' paths.

    None when the target already exists. Raises when fewer than two copies
    exist or they differ.
    """
    if (root / target).is_file():
        return None
    name = target.rsplit("/", 1)[-1]
    copies = sorted(p for p in root.rglob(name) if p.is_file())
    digests = {sha256(p.read_bytes()) for p in copies}
    if len(copies) < 2 or len(digests) != 1:
        raise ValueError(f"{target}: {len(copies)} copies with {len(digests)} different contents")
    return copies[0].read_bytes(), [p.relative_to(root).as_posix() for p in copies]


def mirror_gaps(root: Path, folder: str, copy: str, wanted: set[str]) -> list[tuple[str, bytes]]:
    """The files of `wanted` (paths under `folder`) missing there and kept in
    `copy`, with their bytes. Raises unless the two folders share at least
    MIN_SHARED files, all byte-identical."""
    shared = [p.name for p in (root / folder).iterdir()
              if p.is_file() and not p.name.startswith(".") and (root / copy / p.name).is_file()]
    differ = [n for n in shared if sha256((root / folder / n).read_bytes()) != sha256((root / copy / n).read_bytes())]
    if len(shared) < MIN_SHARED or differ:
        raise ValueError(f"{folder} vs {copy}: {len(shared)} shared files, {len(differ)} differ")
    gaps = []
    for path in sorted(wanted):
        name = path.rsplit("/", 1)[-1]
        if path.rsplit("/", 1)[0] == folder and not (root / path).is_file() and (root / copy / name).is_file():
            gaps.append((path, (root / copy / name).read_bytes()))
    return gaps


def record(root: Path, target: str, data: bytes, sources: list[str], original_url: str) -> None:
    folder = (root / target).parent
    manifest = folder / ".manifest.json"
    entries = json.loads(manifest.read_text(encoding="utf-8")) if manifest.exists() else []
    name = target.rsplit("/", 1)[-1]
    entries = [e for e in entries if e.get("filename") != name]
    entries.append({
        "filename": name,
        "originalUrl": original_url,
        "capturedAt": None,
        "sizeBytes": len(data),
        "sha256": sha256(data),
        "digest": base64.b32encode(hashlib.sha1(data).digest()).decode("ascii"),
        "borrowedFrom": sources,
    })
    entries.sort(key=lambda e: e["filename"])
    manifest.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    urls = {}
    for line in MISSES.read_text(encoding="utf-8").splitlines():
        if line.strip():
            ref = json.loads(line)
            urls[ref["path"]] = ref["url"]
    filled = 0
    for target in BORROW:
        found = borrow(SITE_IMG, target)
        if found is None:
            continue
        data, sources = found
        print(f"[borrow] {target} ← {len(sources)} identical copies ({sources[0]}, …)", file=sys.stderr)
        filled += 1
        if not args.dry_run:
            (SITE_IMG / target).parent.mkdir(parents=True, exist_ok=True)
            (SITE_IMG / target).write_bytes(data)
            record(SITE_IMG, target, data, sources, urls[target])
    for folder, copy in MIRRORED:
        for target, data in mirror_gaps(SITE_IMG, folder, copy, set(urls)):
            print(f"[borrow] {target} ← {copy}/", file=sys.stderr)
            filled += 1
            if not args.dry_run:
                (SITE_IMG / target).write_bytes(data)
                record(SITE_IMG, target, data, [f"{copy}/{target.rsplit('/', 1)[-1]}"], urls[target])
    print(f"[borrow] filled={filled}", file=sys.stderr)


if __name__ == "__main__":
    main()
