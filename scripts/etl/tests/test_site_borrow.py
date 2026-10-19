"""site-image-borrow: a missing site picture filled from identical captured copies."""
import json

import pytest

from stages import load_stage

borrow_stage = load_stage("site-image-borrow.py")


def copy(root, path, data, borrowed_from=None):
    f = root / path
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_bytes(data)
    entry = {"filename": f.name, **({"borrowedFrom": borrowed_from} if borrowed_from else {})}
    (f.parent / ".manifest.json").write_text(json.dumps([entry]))


# Fails if: a copy that was itself borrowed counts as a second witness, so one
# captured copy would be enough to fill a picture.
def test_a_borrowed_copy_is_no_second_witness(tmp_path):
    copy(tmp_path, "map/a.gif", b"same")
    copy(tmp_path, "skill/a.gif", b"same", borrowed_from=["map/a.gif"])
    with pytest.raises(ValueError):
        borrow_stage.borrow(tmp_path, "dungeon/a.gif")
    copy(tmp_path, "uocraft/a.gif", b"same")
    data, sources = borrow_stage.borrow(tmp_path, "dungeon/a.gif")
    assert data == b"same"
    assert sources == ["map/a.gif", "uocraft/a.gif"]


# Fails if: a target the misses file does not name is caught only after its
# picture is written (it would then pass for a captured copy), or not at all
# in a dry run.
@pytest.mark.parametrize("argv", [[], ["--dry-run"]])
def test_a_target_without_a_known_address_stops_before_writing(tmp_path, monkeypatch, argv):
    copy(tmp_path, "map/a.gif", b"same")
    copy(tmp_path, "uocraft/a.gif", b"same")
    misses = tmp_path / "misses.jsonl"
    misses.write_text("")
    monkeypatch.setattr(borrow_stage, "SITE_IMG", tmp_path)
    monkeypatch.setattr(borrow_stage, "MISSES", misses)
    monkeypatch.setattr(borrow_stage, "BORROW", ["dungeon/a.gif"])
    monkeypatch.setattr(borrow_stage, "MIRRORED", [])
    monkeypatch.setattr("sys.argv", ["site-image-borrow.py", *argv])
    with pytest.raises(ValueError, match="dungeon/a.gif"):
        borrow_stage.main()
    assert not (tmp_path / "dungeon").exists()
