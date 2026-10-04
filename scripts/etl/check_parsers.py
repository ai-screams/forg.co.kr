#!/usr/bin/env python3
"""Compare the post parsers of a git ref with the working tree on every capture.

The CI check (`tests/test_parser_snapshots.py`) covers a sample; this runs
both versions of each parser over every silver capture it reads and reports
what differs. It needs the silver tier (`.docs/research/archive-clean/`) and
the CDX plan, so it runs locally, before a parser change is committed.

The ref's `scripts/etl/` is unpacked into `scripts/.etl-against/` (same
depth, so its paths still resolve to this repository) and removed after.
Each side runs in its own process: loaded together, the two versions would
share `post_parse`, `schemas` and `sanitise` and compare a parser with
itself. Nothing is written but the unpacked copy and a temporary
directory.

USAGE:
    .venv/bin/python3 scripts/etl/check_parsers.py [--against REF]
        [--parsers zb,g4,g5,zb40] [--workers N] [--show N]

Exit status: 0 when every result matches, 1 when any differs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime
from pathlib import Path

ETL_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = ETL_DIR.parent.parent
AGAINST_DIR = PROJECT_ROOT / "scripts" / ".etl-against"
PARSERS = {
    "zb": "02-parse-zeroboard.py",
    "g4": "02b-parse-gnuboard4.py",
    "g5": "02d-parse-gnuboard5.py",
    "zb40": "02f-parse-zeroboard40.py",
}
PARSED_AT = datetime(2026, 1, 1)

_stage = None  # the parser module of the tree a worker runs


def _load(tree: Path, file: str):
    """Load one tree's parser with only that tree importable.

    This script's own folder is the working tree's `scripts/etl`, first on
    `sys.path`; left there, a ref that lacks a helper would quietly import
    the working tree's copy and compare a mix.
    """
    import importlib.util

    sys.path[:] = [str(tree)] + [p for p in sys.path if p and Path(p).resolve() != ETL_DIR]
    spec = importlib.util.spec_from_file_location("stage_under_check", tree / file)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["stage_under_check"] = module
    spec.loader.exec_module(module)
    scripts = PROJECT_ROOT / "scripts"
    for name, mod in list(sys.modules.items()):
        origin = getattr(mod, "__file__", None)
        if origin and Path(origin).resolve().is_relative_to(scripts) and not Path(origin).resolve().is_relative_to(tree.resolve()):
            if Path(origin).resolve() != Path(__file__).resolve():
                raise RuntimeError(f"{name} came from {origin}, not from {tree}")
    return module


def _inputs(which: str, m) -> list[tuple]:
    """`(key, call args)` for every capture the parser reads, with its Wayback ts.

    The key ends with the capture's path: one (board, post) can be read from
    two phases' folders, and each is checked.
    """
    return [(key + (_rel(args[-2]),), args) for key, args in _keyed(which, m)]


def _rel(path: str) -> str:
    return str(Path(path).resolve().relative_to(PROJECT_ROOT))


def _keyed(which: str, m) -> list[tuple]:
    if which in ("zb", "g4"):
        ts = m.load_wayback_ts_index()
        return [((b, p), (b, p, str(f), ts[(b, p)])) for b, p, f in m.iter_input_files(None) if (b, p) in ts]
    if which == "g5":
        cap = m.load_capture_lookup()
        files = m.iter_input_files(None, m.load_plan_lookup())
        return [((b, p), (b, p, str(f), cap[(b.lower(), p)])) for b, p, f in files if (b.lower(), p) in cap]
    ts = m.capture_ts_index()
    out = []
    for ph in m.ORIGIN_BY_PHASE:
        for f in sorted((m.INPUT_BASE / ph).glob("*/*.html")):
            k = (ph, f.parent.name, f.stem)
            if k in ts:
                out.append((k, (ph, f.parent.name, f.stem, str(f), ts[k])))
    return out


def _outcome(which: str, args: tuple) -> str:
    html = Path(args[-2]).read_text("utf-8")
    try:
        if which in ("zb", "g4"):
            post = _stage.parse_one(html, board=args[0], post_id=args[1], captured_at=args[3], parsed_at=PARSED_AT)
        elif which == "g5":
            post = _stage.parse_one(args[0], args[1], html, args[3], PARSED_AT)
        else:
            post = _stage.parse_view(
                html, board=args[1], post_id=args[2], phase=args[0],
                created_at=datetime(1970, 1, 1), captured_at=args[4], parsed_at=PARSED_AT,
            )
    except Exception as e:  # noqa: BLE001 — the result under check
        reason = getattr(e, "reason", None)
        return f"skip:{reason}" if reason is not None else f"error:{type(e).__name__}:{e}"
    return "ok:" + post.model_dump_json()


def _init(tree: str, file: str) -> None:
    global _stage
    _stage = _load(Path(tree), file)


def _work(job: tuple) -> tuple:
    which, key, args = job
    out = _outcome(which, args)
    return key, hashlib.sha256(out.encode()).hexdigest(), out


def dump(tree: Path, which: str, workers: int, out_file: Path) -> None:
    """Run one tree's parser over its inputs; write key, hash and result as JSON lines."""
    m = _load(tree, PARSERS[which])
    jobs = [(which, key, args) for key, args in _inputs(which, m)]
    with ProcessPoolExecutor(workers, initializer=_init, initargs=(str(tree), PARSERS[which])) as ex, \
            out_file.open("w", encoding="utf-8") as f:
        for key, digest, prefix in ex.map(_work, jobs, chunksize=50):
            f.write(json.dumps({"key": list(key), "hash": digest, "out": prefix}, ensure_ascii=False) + "\n")


def _difference(a: str, b: str) -> str:
    """Which fields of two posts differ, or the two results when not both posts."""
    if a.startswith("ok:") and b.startswith("ok:"):
        pa, pb = json.loads(a[3:]), json.loads(b[3:])
        fields = [k for k in sorted(set(pa) | set(pb)) if pa.get(k) != pb.get(k)]
        shown = [f"{k}: {json.dumps(pa.get(k), ensure_ascii=False)[:80]} → {json.dumps(pb.get(k), ensure_ascii=False)[:80]}" for k in fields[:3]]
        return "fields " + ", ".join(fields) + "".join(f"\n        {s}" for s in shown)
    return f"{a[:120]}  →  {b[:120]}"


def _read(path: Path) -> dict[tuple, dict]:
    return {tuple(r["key"]): r for r in map(json.loads, path.read_text(encoding="utf-8").splitlines())}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--against", default="HEAD", help="git ref to compare with (default HEAD)")
    ap.add_argument("--parsers", default=",".join(PARSERS))
    ap.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 2))
    ap.add_argument("--show", type=int, default=5, help="differences to print per parser")
    ap.add_argument("--dump", nargs=3, metavar=("TREE", "PARSER", "OUT"), help=argparse.SUPPRESS)
    args = ap.parse_args()

    if args.dump:  # one side, in its own process
        dump(Path(args.dump[0]), args.dump[1], args.workers, Path(args.dump[2]))
        return 0

    if AGAINST_DIR.exists():
        sys.exit(f"{AGAINST_DIR} exists — a previous run did not finish; remove it first")
    status = 0
    try:
        AGAINST_DIR.mkdir(parents=True)
        archive = subprocess.run(["git", "archive", args.against, "scripts/etl"], cwd=PROJECT_ROOT, check=True, capture_output=True)
        subprocess.run(["tar", "-x", "--strip-components=2", "-C", str(AGAINST_DIR)], input=archive.stdout, check=True)
        with tempfile.TemporaryDirectory() as tmp:
            for which in args.parsers.split(","):
                sides = {}
                for name, tree in (("against", AGAINST_DIR), ("tree", ETL_DIR)):
                    out = Path(tmp) / f"{which}-{name}.jsonl"
                    subprocess.run(
                        [sys.executable, "-B", __file__, "--workers", str(args.workers), "--dump", str(tree), which, str(out)],
                        check=True, env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
                    )
                    sides[name] = _read(out)
                a, b = sides["against"], sides["tree"]
                if not a or not b:
                    sys.exit(f"{which}: no captures found — is the silver tier (.docs/research/archive-clean) here?")
                only_a, only_b = sorted(set(a) - set(b)), sorted(set(b) - set(a))
                differ = sorted(k for k in set(a) & set(b) if a[k]["hash"] != b[k]["hash"])
                print(f"{which}: {len(a)} vs {len(b)} inputs, {len(differ)} differ, "
                      f"{len(only_a)} only in {args.against}, {len(only_b)} only in the working tree")
                for k in differ[: args.show]:
                    print("  ", k[-1])
                    print("     ", _difference(a[k]["out"], b[k]["out"]))
                if differ or only_a or only_b:
                    status = 1
    finally:
        shutil.rmtree(AGAINST_DIR, ignore_errors=True)
    return status


if __name__ == "__main__":
    sys.exit(main())
