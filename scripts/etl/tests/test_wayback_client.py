"""The polite slot's shared state: the block counter and the gap after a fetch."""
import io
import json
import time
import urllib.error

import pytest

import wayback_client as wc


@pytest.fixture
def state_file(tmp_path, monkeypatch):
    monkeypatch.setattr(wc, "WAYBACK_RATE_LOCK", tmp_path / "rate.lock")
    monkeypatch.setattr(wc, "WAYBACK_RATE_STATE", tmp_path / "rate.json")

    def write(**state):
        (tmp_path / "rate.json").write_text(json.dumps(state))

    def read():
        return json.loads((tmp_path / "rate.json").read_text())

    return write, read


def test_a_success_inside_the_slot_resets_the_block_counter(state_file, monkeypatch):
    # What fails this: the slot writing back the dict it read on entry, which
    # restored the 4 that fetch_with_retry had just set to 0.
    write, read = state_file
    write(next_allowed_at=0.0, consecutive_blocks=4)
    monkeypatch.setattr(wc.urllib.request, "urlopen", lambda req, timeout: io.BytesIO(b"ok"))

    with wc.global_polite_slot():
        assert wc.fetch_with_retry("http://web.archive.org/web/2001id_/http://forg.co.kr/") == b"ok"

    assert read()["consecutive_blocks"] == 0


def test_a_fetch_that_raises_still_spaces_the_next_request(state_file, monkeypatch):
    # What fails this: setting next_allowed_at only after a fetch that returned,
    # so a request right after a failure went out with no gap.
    write, read = state_file
    write(next_allowed_at=0.0, consecutive_blocks=0)

    def gone(req, timeout):
        raise urllib.error.HTTPError(req.full_url, 404, "Not Found", {}, None)

    monkeypatch.setattr(wc.urllib.request, "urlopen", gone)
    before = time.time()

    with pytest.raises(wc.WaybackGoneError), wc.global_polite_slot():
        wc.fetch_with_retry("http://web.archive.org/web/2001id_/http://forg.co.kr/x")

    assert read()["next_allowed_at"] >= before + wc.DELAY_BETWEEN
