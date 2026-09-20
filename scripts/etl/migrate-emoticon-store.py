#!/usr/bin/env python3
"""ETL one-off — move Zeroboard comment emoticons into the shared store.

Phase D saved every recovered image under its post, so the 73 site-wide
emoticons (`/_zb/emoticon/*.gif`) landed 2,503 times across
`public/img/posts/{board}/{post_id}/` (collection audit 2026-09-19, G13).
This moves them to `public/img/emoticon/` once each, keyed on content:
a second version of a name becomes `stem~digest8.ext`, the way
`cdx-image.py` names new downloads.

Steps, all offline:
    1. read every per-post `.manifest.json`, pick the emoticon entries
    2. copy each distinct content into the store, write its manifest
    3. rewrite gold `<img src="/img/posts/…/x.gif">` to `/img/emoticon/…`
    4. delete the per-post copies and their manifest entries

Idempotent: a second run finds nothing to move.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import shutil
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlsplit

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
POSTS_DIR = PROJECT_ROOT / "src" / "content" / "posts"
IMG_ROOT = PROJECT_ROOT / "public" / "img" / "posts"
STORE = PROJECT_ROOT / "public" / "img" / "emoticon"
STORE_MANIFEST = STORE / ".manifest.json"
EMOTICON_PATH_PREFIX = "/_zb/emoticon/"


def wayback_digest(data: bytes) -> str:
    return base64.b32encode(hashlib.sha1(data).digest()).decode("ascii")


def read_manifest(path: Path) -> list[dict]:
    try:
        entries = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return entries if isinstance(entries, list) else []


def write_json(path: Path, payload: object) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def store_filename(basename: str, digest: str, by_name: dict[str, list[dict]]) -> tuple[str, bool]:
    """`(filename in the store, already there)` for a capture with this digest."""
    known = by_name.get(basename.lower(), [])
    for e in known:
        if e["digest"] == digest:
            return e["filename"], True
    if not known:
        return basename, False
    stem, dot, ext = basename.rpartition(".")
    variant = f"{stem}~{digest[:8].lower()}{dot}{ext}" if dot else f"{basename}~{digest[:8].lower()}"
    return variant, False


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n", 1)[0])
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    store_entries = read_manifest(STORE_MANIFEST)
    by_name: dict[str, list[dict]] = defaultdict(list)
    for e in store_entries:
        by_name[urlsplit(e["originalUrl"]).path.rsplit("/", 1)[-1].lower()].append(e)

    # 1–2. per-post copies → store
    moves: dict[str, str] = {}  # old public URL → new public URL
    copied = removed = 0
    sidecars = sorted(IMG_ROOT.glob("*/*/.manifest.json"))
    for sidecar in sidecars:
        post_dir = sidecar.parent
        entries = read_manifest(sidecar)
        keep: list[dict] = []
        for e in entries:
            if EMOTICON_PATH_PREFIX not in urlsplit(e["originalUrl"]).path.lower():
                keep.append(e)
                continue
            src = post_dir / e["filename"]
            if not src.exists():
                continue  # already moved by an interrupted run
            data = src.read_bytes()
            digest = wayback_digest(data)
            name, in_store = store_filename(e["filename"], digest, by_name)
            if not in_store:
                if not args.dry_run:
                    STORE.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(src, STORE / name)
                entry = {
                    "filename": name,
                    "originalUrl": e["originalUrl"],
                    "capturedAt": e["capturedAt"],
                    "sizeBytes": len(data),
                    "sha256": hashlib.sha256(data).hexdigest(),
                    "digest": digest,
                }
                store_entries.append(entry)
                by_name[e["filename"].lower()].append(entry)
                copied += 1
            old_url = f"/img/posts/{post_dir.parent.name}/{post_dir.name}/{e['filename']}"
            moves[old_url] = f"/img/emoticon/{name}"
            if not args.dry_run:
                src.unlink()
            removed += 1
        if len(keep) != len(entries) and not args.dry_run:
            if keep:
                write_json(sidecar, keep)
            else:
                sidecar.unlink()
                if not any(post_dir.iterdir()):
                    post_dir.rmdir()
                    if not any(post_dir.parent.iterdir()):
                        post_dir.parent.rmdir()

    if not args.dry_run and copied:
        store_entries.sort(key=lambda e: e["filename"])
        write_json(STORE_MANIFEST, store_entries)

    # 3. gold src rewrite — exact string replacement on the JSON text keeps
    #    every other byte of the record untouched.
    posts_changed = refs_moved = 0
    if moves:
        for post_path in sorted(POSTS_DIR.glob("*/*.json")):
            text = post_path.read_text(encoding="utf-8")
            prefix = f"/img/posts/{post_path.parent.name}/{post_path.stem}/"
            if prefix not in text:
                continue
            new_text = text
            for old_url, new_url in moves.items():
                if old_url.startswith(prefix) and old_url in new_text:
                    n = new_text.count(f'\\"{old_url}\\"')
                    new_text = new_text.replace(f'\\"{old_url}\\"', f'\\"{new_url}\\"')
                    refs_moved += n
            if new_text != text:
                posts_changed += 1
                if not args.dry_run:
                    post_path.write_text(new_text, encoding="utf-8")

    print(
        f"[migrate-emoticon-store] store={len(store_entries)} files "
        f"(+{copied}) removed_copies={removed} posts_changed={posts_changed} "
        f"refs_moved={refs_moved} dry_run={args.dry_run}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
