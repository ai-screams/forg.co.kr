"""File writes the ETL scripts share.

Each script still builds its own text (its JSON layout, indent and trailing
newline are its own); these only put it on disk.
"""
from __future__ import annotations

import json
from pathlib import Path


def write_atomic(path: Path, data: str | bytes) -> None:
    """Write through a sibling `.tmp` and rename it over `path`.

    A reader — or a run killed halfway — never sees half a file. Text is
    UTF-8.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    if isinstance(data, bytes):
        tmp.write_bytes(data)
    else:
        tmp.write_text(data, encoding="utf-8")
    tmp.replace(path)


def append_jsonl(path: Path, rec: dict[str, object]) -> None:
    """Append one record as a JSON line (UTF-8, Korean kept as is)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
