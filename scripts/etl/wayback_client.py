#!/usr/bin/env python3
"""Shared Wayback Machine client — polite, retry-aware, cross-process safe.

Extracted from `download.py` so multiple ETL stages (post capture, image
recovery, chrome recovery) can share a single rate-limit slot. Without
cross-process coordination, two scripts running in parallel would each obey
their own 4s-per-request budget but collectively flood Wayback at 8 req/8s.

Usage:
    from wayback_client import global_polite_slot, fetch_with_retry, wayback_url

    raw_url = "http://forg.co.kr/_zb/zboard.php?id=Notice&no=1"
    url = wayback_url("20030902080926", raw_url)
    with global_polite_slot():
        data: bytes = fetch_with_retry(url)

The context manager holds an fcntl flock for the entire fetch — fetch happens
INSIDE the lock so any second process blocks until this one completes.
ADR-0010 §Decision #1 explains why this strict 1-worker policy is required.
"""
from __future__ import annotations

import contextlib
import fcntl
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from collections.abc import Generator
from pathlib import Path
from urllib.parse import quote, unquote_to_bytes, urlsplit, urlunsplit

# ── Filesystem layout ─────────────────────────────────────────────────-
ROOT = Path(__file__).resolve().parent.parent.parent / ".docs" / "research"
WAYBACK_RATE_LOCK = ROOT / ".wayback-rate-limit.lock"
WAYBACK_RATE_STATE = ROOT / ".wayback-rate-limit.json"

# ── Polite policy constants ───────────────────────────────────────────-
DELAY_BETWEEN = 4.0       # base delay between requests (≤15 RPM target)
JITTER = (0.0, 2.0)       # extra random sleep range
MAX_RETRIES = 4
RETRY_BACKOFF = [10, 60, 300, 1800]   # 10s → 1m → 5m → 30m
BLOCK_THRESHOLD = 5        # N consecutive connection-refused → long sleep
BLOCK_SLEEP = 3600         # 1 hour
TIMEOUT = 60
USER_AGENT = (
    "forg-archive/1.0 (hanyul.ryu@gmail.com; "
    "Korean MMORPG community preservation)"
)


# ── Errors ─────────────────────────────────────────────────────────────-
class WaybackError(Exception):
    """Base class for all Wayback client failures."""


class WaybackHTTPError(WaybackError):
    """HTTP status outside 2xx after retries are exhausted."""

    def __init__(self, status: int, url: str, message: str = "") -> None:
        super().__init__(f"HTTP {status} on {url}: {message}".rstrip(": "))
        self.status = status
        self.url = url


class WaybackGoneError(WaybackError):
    """404 / 410 — capture does not exist. Permanent, no retry."""

    def __init__(self, status: int, url: str) -> None:
        super().__init__(f"HTTP {status} on {url} — capture missing")
        self.status = status
        self.url = url


class WaybackBlockedError(WaybackError):
    """Too many consecutive connection refusals — assume IP block."""


# ── URL helpers ────────────────────────────────────────────────────────-
def _ascii_safe_url(url: str) -> str:
    """Percent-encode non-ASCII codepoints so urllib's ASCII codec accepts the URL.

    Wayback CDX entries occasionally embed the original (non-ASCII) Korean
    `keyword=` value the forg user typed when sharing the link. urllib's
    `Request` constructor refuses such URLs with `UnicodeEncodeError`. We
    UTF-8 / percent-encode only path + query + fragment, leaving the scheme
    and host alone (RFC 3986 IRI → URI normalization, conservative variant).
    """
    if url.isascii():
        return url
    parts = urlsplit(url)
    safe_path = "/%:@!$&'()*+,;=-._~"
    safe_query = "=&%:@!$'()*+,;-._~"
    safe_frag = "%:@!$&'()*+,;=-._~"
    return urlunsplit((
        parts.scheme,
        parts.netloc,
        quote(parts.path, safe=safe_path),
        quote(parts.query, safe=safe_query),
        quote(parts.fragment, safe=safe_frag),
    ))


def wayback_url(ts: str, original: str) -> str:
    """Build a raw-content Wayback URL using the `id_` modifier so the response
    is the original archived bytes (no Wayback chrome injected)."""
    return f"https://web.archive.org/web/{ts}id_/{original}"


# ── Join key shared by every CDX consumer ──────────────────────────────-
_PERCENT_SAFE = "/-._~!$&'()*+,;=:@"


def path_text(path: str) -> str:
    """Percent-decode a URL path segment to text, honouring the site's encoding.

    forg served EUC-KR, so Wayback rows carry Korean basenames as CP949
    percent-escapes (`%b9%df%c7%d8…`). The gold tier holds the same names
    as decoded Unicode. `unquote()` assumes UTF-8 and turns the CP949 bytes
    into U+FFFD, so the two sides never met (collection audit 2026-09-19,
    G1: 61 body images Wayback *has* were filed as unrecoverable). Decode
    to bytes first, try UTF-8, then CP949.
    """
    raw = unquote_to_bytes(path)
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("cp949", errors="replace")


def canonical_key(url: str) -> str:
    """Stable join key — host preserved, port normalized, path percent-encoding
    normalized to UTF-8 upper-case hex, then case-folded.

    ADR-0010 Iteration 2: do NOT strip `www.`. Wayback may capture
    `www.host` and `host` as separate URLs. Host variants live in the
    manifest's candidates list, not in the key.

    The path is lower-cased because Wayback's own urlkey is (SURT form),
    so a `.JPG` reference and a `.jpg` capture replay as one resource.
    Audit G1 counted 11 references lost to case alone.
    """
    p = urlsplit(url)
    scheme = (p.scheme or "http").lower()
    host = (p.hostname or "").lower()
    port = "" if p.port in (None, 80, 443) else f":{p.port}"
    try:
        path = quote(path_text(p.path), safe=_PERCENT_SAFE).lower()
    except ValueError:
        path = p.path.lower()
    base = f"{scheme}://{host}{port}{path}"
    return f"{base}?{p.query}" if p.query else base


# ── Local CDX inventory ────────────────────────────────────────────────-
CDX_DIR = ROOT / "cdx"
_local_cdx: dict[str, list[dict]] | None = None


def local_cdx_rows(url: str) -> list[dict]:
    """CDX rows already on disk for `url`, keyed by `canonical_key`.

    Every `cdx/image-*.jsonl` prefix sweep is loaded once per process. A
    single-URL probe that finds its answer here costs no request; the
    collection audit found 1,517 `/images/` rows that no stage had ever
    consulted while `recover-chrome.py` asked Wayback for the same files.
    """
    global _local_cdx
    if _local_cdx is None:
        index: dict[str, list[dict]] = {}
        for path in sorted(CDX_DIR.glob("image-*.jsonl")):
            for line in path.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                index.setdefault(canonical_key(row["original"]), []).append(row)
        _local_cdx = index
    return _local_cdx.get(canonical_key(url), [])


# ── Cross-process polite slot ──────────────────────────────────────────-
def _read_state() -> dict:
    if not WAYBACK_RATE_STATE.exists():
        return {"next_allowed_at": 0.0, "consecutive_blocks": 0}
    try:
        return json.loads(WAYBACK_RATE_STATE.read_text())
    except (OSError, json.JSONDecodeError):
        return {"next_allowed_at": 0.0, "consecutive_blocks": 0}


def _write_state(state: dict) -> None:
    WAYBACK_RATE_STATE.parent.mkdir(parents=True, exist_ok=True)
    tmp = WAYBACK_RATE_STATE.with_suffix(WAYBACK_RATE_STATE.suffix + ".tmp")
    tmp.write_text(json.dumps(state, indent=2))
    os.replace(tmp, WAYBACK_RATE_STATE)


@contextlib.contextmanager
def global_polite_slot() -> Generator[dict, None, None]:
    """Cross-process strict 1-worker polite slot.

    Holds `fcntl.flock(LOCK_EX)` for the entire fetch. While inside the
    context, no other process can acquire the slot, so Wayback never sees
    two in-flight requests from this archive — even if `download.py` and
    `download-images.py` are running simultaneously.

    Sequence:
      1. Acquire exclusive flock on .wayback-rate-limit.lock
      2. Read .wayback-rate-limit.json (next_allowed_at, consecutive_blocks)
      3. Sleep until next_allowed_at (polite gap from previous fetch)
      4. Yield to caller (caller runs the urllib fetch)
      5. Update next_allowed_at = now + DELAY_BETWEEN + jitter
      6. Release the lock

    The state dict is yielded so callers can update consecutive_blocks
    after detecting a block. Caller must NOT close the file handle.
    """
    WAYBACK_RATE_LOCK.parent.mkdir(parents=True, exist_ok=True)
    with open(WAYBACK_RATE_LOCK, "w") as lock_fh:
        fcntl.flock(lock_fh, fcntl.LOCK_EX)
        try:
            state = _read_state()
            wait = state["next_allowed_at"] - time.time()
            if wait > 0:
                time.sleep(wait)
            yield state
            state["next_allowed_at"] = (
                time.time() + DELAY_BETWEEN + random.uniform(*JITTER)
            )
            _write_state(state)
        finally:
            fcntl.flock(lock_fh, fcntl.LOCK_UN)


# ── Fetch with retry ───────────────────────────────────────────────────-
def _is_connection_refused(err: BaseException) -> bool:
    msg = str(err)
    return "Connection refused" in msg or "Errno 61" in msg


def _log_retry(url: str, err: str, attempt: int) -> None:
    """Every backoff is visible. A silent 30-minute sleep looks like a hang
    from outside (2026-09-20: a timed-out CDX probe held the polite lock for
    half an hour with nothing in the log)."""
    wait = RETRY_BACKOFF[min(attempt, len(RETRY_BACKOFF) - 1)]
    print(f"  [retry] {err} on {url}, sleeping {wait}s", file=sys.stderr, flush=True)


def fetch_with_retry(url: str) -> bytes:
    """Fetch a URL with retry, backoff, and block-detection.

    MUST be called from inside `global_polite_slot()`. The slot guarantees
    that no other process runs urllib in parallel, so this function obeys
    Wayback's per-IP rate limit by construction.

    Block detection: BLOCK_THRESHOLD consecutive ConnectionRefused responses
    trigger a 1-hour sleep. The consecutive_blocks counter is shared via the
    state file, so block-induced cooldowns survive process restarts.

    Raises:
        WaybackGoneError — 404 / 410 (permanent miss, no retry)
        WaybackHTTPError — non-recoverable HTTP error after retries
        WaybackBlockedError — sustained block detected
        WaybackError — generic transport failure after retries
    """
    safe = _ascii_safe_url(url)
    last_err: str | None = None

    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(safe, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                data = resp.read()
            # Reset block counter on success (read & write outside the urllib block)
            state = _read_state()
            state["consecutive_blocks"] = 0
            _write_state(state)
            return data

        except urllib.error.HTTPError as e:
            last_err = f"HTTP {e.code}"
            if e.code in (404, 410):
                raise WaybackGoneError(e.code, url) from e
            if e.code in (429, 503):
                retry_after = int(e.headers.get("Retry-After", "0") or 0)
                wait = max(retry_after, RETRY_BACKOFF[min(attempt, len(RETRY_BACKOFF) - 1)])
                print(
                    f"  [rate-limited] HTTP {e.code} on {url}, sleeping {wait}s",
                    file=sys.stderr,
                    flush=True,
                )
                time.sleep(wait)
                continue
            # Other 5xx / 4xx: backoff and retry
            _log_retry(url, last_err, attempt)
            time.sleep(RETRY_BACKOFF[min(attempt, len(RETRY_BACKOFF) - 1)])

        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last_err = str(e)[:200]
            if _is_connection_refused(e):
                state = _read_state()
                state["consecutive_blocks"] = state.get("consecutive_blocks", 0) + 1
                _write_state(state)
                if state["consecutive_blocks"] >= BLOCK_THRESHOLD:
                    print(
                        f"  [BLOCK DETECTED] {state['consecutive_blocks']} "
                        f"consecutive refusals — sleeping {BLOCK_SLEEP}s (1h)",
                        file=sys.stderr,
                        flush=True,
                    )
                    state["consecutive_blocks"] = 0
                    _write_state(state)
                    time.sleep(BLOCK_SLEEP)
                    continue
            _log_retry(url, last_err, attempt)
            time.sleep(RETRY_BACKOFF[min(attempt, len(RETRY_BACKOFF) - 1)])

        except Exception as e:  # noqa: BLE001 — outermost retry guard
            last_err = f"{type(e).__name__}: {e}"[:200]
            _log_retry(url, last_err, attempt)
            time.sleep(RETRY_BACKOFF[min(attempt, len(RETRY_BACKOFF) - 1)])

    raise WaybackError(f"Exhausted {MAX_RETRIES} retries for {url}: {last_err}")
