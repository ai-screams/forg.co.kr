import json

from etl_io import append_jsonl, write_atomic


def test_write_atomic_text_and_bytes(tmp_path):
    text_path = tmp_path / "a" / "b" / "post.json"
    write_atomic(text_path, '{"제목": "울티마"}\n')
    assert text_path.read_bytes() == '{"제목": "울티마"}\n'.encode("utf-8")

    bin_path = tmp_path / "img.gif"
    write_atomic(bin_path, b"GIF89a\x00\xff")
    assert bin_path.read_bytes() == b"GIF89a\x00\xff"

    write_atomic(text_path, "second\n")
    assert text_path.read_text(encoding="utf-8") == "second\n"
    assert not list(tmp_path.rglob("*.tmp"))


def test_append_jsonl_keeps_korean_and_one_record_per_line(tmp_path):
    log = tmp_path / "logs" / "failures.jsonl"
    append_jsonl(log, {"input": "a", "error": "권한 없음"})
    append_jsonl(log, {"input": "b"})
    lines = log.read_text(encoding="utf-8").splitlines()
    assert lines[0] == '{"input": "a", "error": "권한 없음"}'
    assert [json.loads(line)["input"] for line in lines] == ["a", "b"]
