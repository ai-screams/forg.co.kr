"""Parser regression on a sample of real captures.

`fixtures/cases.json` lists one capture for each kind of result a parser
gives — a post with comments, with attachments, a homepage, each skin, each
reason a capture is skipped — picked from the silver captures (which are
not in git). `fixtures/<parser>/` holds those captures and
`snapshots/<parser>/` what the parser made of them. A parser change that
alters any of them fails here.

A change that means to alter them regenerates the snapshots and the diff of
`snapshots/` is reviewed with it:

    UPDATE_SNAPSHOTS=1 python -m pytest scripts/etl/tests/test_parser_snapshots.py

The update still fails a case whose outcome changes (a post that now
errors or is skipped, or the reverse), so a crash is never accepted in
bulk; delete that case's snapshot first when the change is meant.

`02f` takes a post's date from list rows, not from the view page, so its
cases are given 1970 and cover the view parsing only.

The snapshots are parser output, not gold: gold has since had its image
addresses rewritten (`04-rewrite-image-urls.py`).

Personal data the parsers drop and gold does not hold — posters' IP
addresses and e-mail addresses — is masked in the fixtures (192.0.2.x from
RFC 5737, userN@example.invalid); the parser output is the same either way.
"""
from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path

import pytest

from stages import load_stage

HERE = Path(__file__).parent
FIXTURES = HERE / "fixtures"
SNAPSHOTS = HERE / "snapshots"
CASES = json.loads((FIXTURES / "cases.json").read_text(encoding="utf-8"))
PARSED_AT = datetime(2026, 1, 1)
STAGES = {
    "zb": "02-parse-zeroboard.py",
    "g4": "02b-parse-gnuboard4.py",
    "g5": "02d-parse-gnuboard5.py",
    "zb40": "02f-parse-zeroboard40.py",
    "listing": "02c-parse-listing.py",
}


def parse(case: dict) -> dict:
    stage = load_stage(STAGES[case["parser"]])
    html = (FIXTURES / case["parser"] / case["file"]).read_text(encoding="utf-8")
    a = case["args"]
    try:
        if case["parser"] in ("zb", "g4"):
            post = stage.parse_one(
                html, board=a["board"], post_id=a["post_id"], captured_at=a["captured_at"], parsed_at=PARSED_AT
            )
        elif case["parser"] == "g5":
            post = stage.parse_one(a["plan_board"], a["post_id"], html, a["captured_at"], PARSED_AT)
        elif case["parser"] == "zb40":
            post = stage.parse_view(
                html,
                board=a["board"],
                post_id=a["post_id"],
                phase=a["phase"],
                created_at=datetime(1970, 1, 1),
                captured_at=a["captured_at"],
                parsed_at=PARSED_AT,
            )
        else:
            rows, total = stage.parse_page(html, a["engine"])
            return {"outcome": "ok", "total": total, "rows": json.loads(json.dumps(rows, default=str))}
    except Exception as e:  # noqa: BLE001 — the result under test
        reason = getattr(e, "reason", None)
        if reason is not None:
            return {"outcome": "skip", "reason": reason}
        return {"outcome": "error", "type": type(e).__name__, "message": str(e).splitlines()[0][:200]}
    return {"outcome": "ok", "post": json.loads(post.model_dump_json())}


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_parser_output_matches_snapshot(case: dict) -> None:
    got = parse(case)
    snapshot = SNAPSHOTS / f"{case['id']}.json"
    if os.environ.get("UPDATE_SNAPSHOTS") == "1":
        if snapshot.exists():
            before = json.loads(snapshot.read_text(encoding="utf-8"))["outcome"]
            assert got["outcome"] == before, (
                f"{case['id']}: outcome {before} → {got['outcome']}; delete the snapshot if meant"
            )
        snapshot.parent.mkdir(parents=True, exist_ok=True)
        snapshot.write_text(json.dumps(got, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return
    assert snapshot.exists(), f"no snapshot for {case['id']}; run with UPDATE_SNAPSHOTS=1"
    assert got == json.loads(snapshot.read_text(encoding="utf-8"))
