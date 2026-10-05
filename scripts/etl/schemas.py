"""Pydantic models for parsed forg.co.kr posts.

These mirror the TypeScript interfaces in `src/types/post.ts` 1:1.
When changing the schema, update both files together — the React build
expects the Python parser's JSON output to match the TS types exactly.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

PostEra = Literal["2003", "2014"]
SourceEngine = Literal["zeroboard", "gnuboard4", "gnuboard5"]


class Attachment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    fileNum: int
    sizeBytes: int | None = None


class Comment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    author: str = Field(min_length=1)
    authorMemberNo: str | None = None
    createdAt: datetime
    bodyHtml: str


class Post(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Identity
    board: str = Field(min_length=1)
    boardKr: str
    postId: str = Field(min_length=1)

    # Content
    title: str = Field(min_length=1)
    # `[xxx]` prefix stripped from the title; null when no prefix was present.
    categoryLabel: str | None = None
    bodyHtml: str
    bodyText: str = Field(min_length=1)

    # Meta
    author: str = Field(min_length=1)
    authorMemberNo: str | None = None
    authorHomepage: str | None = None
    createdAt: datetime
    # True when the capture carried no post date and `createdAt` is the
    # earliest comment's time instead — an upper bound, not the post's own
    # timestamp. The webbus2009 Gnuboard4 skin printed the date only in the
    # board listing under the post, and that listing had scrolled past the
    # post in 27 captures (collection audit 2026-09-19, G4).
    createdAtApprox: bool = False

    hits: int | None = None
    recommend: int | None = None

    # Children
    attachments: list[Attachment] = Field(default_factory=list)
    comments: list[Comment] = Field(default_factory=list)

    # Provenance
    era: PostEra
    # Real Wayback ts ("YYYYMMDDhhmmss") loaded from e-policy-plan.json (1차)
    # or .progress.jsonl (2차). ADR-0010 §Decision #7 — fail loud if missing.
    capturedAt: str
    # ISO 8601 — when the parser last wrote this record. Not archival.
    parsedAt: datetime
    originalUrl: str
    sourceEngine: SourceEngine


# ── Board index (paginated listing) ──────────────────────────────────
# Mirrors `BoardIndexEntry` / `BoardIndexPage` in src/types/post.ts.
# Page size is hard-coded in both languages — keep in sync.

BOARD_INDEX_PAGE_SIZE = 50


class BoardIndexEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    postId: str = Field(min_length=1)
    title: str = Field(min_length=1)
    categoryLabel: str | None = None
    author: str = Field(min_length=1)
    authorMemberNo: str | None = None
    createdAt: datetime
    createdAtApprox: bool = False
    # Row came from a captured list page (ADR-0017 §4): the year of its
    # MM/DD date was inferred, see `02c-parse-listing.py`.
    yearApprox: bool = False
    commentCount: int = Field(ge=0)
    attachmentCount: int = Field(ge=0)
    hits: int | None = None
    recommend: int | None = None
    era: PostEra
    # False for a row known only from a list page — no post to link to.
    hasPost: bool = True
    # Set on a row carried in from the board this one continues (03's
    # CONTINUES): the board whose `/{board}/{postId}` the row links to.
    # Omitted from the JSON when None.
    board: str | None = None
    # A captured list showed the row as a notice / as a reply (its depth).
    # Omitted from the JSON when false / 0.
    isNotice: bool = False
    replyDepth: int = Field(default=0, ge=0)


class BoardIndexPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    board: str = Field(min_length=1)
    page: int = Field(ge=1)
    totalPages: int = Field(ge=1)
    # Every row, including the ones known only from list pages.
    totalPosts: int = Field(ge=0)
    # Rows the museum holds the post for.
    totalWithPost: int = Field(ge=0)
    generatedAt: datetime
    entries: list[BoardIndexEntry]


# ── Board listing (from captured list pages, ADR-0017) ───────────────
# Mirrors `BoardListingEntry` / `BoardListing` in src/types/post.ts.
# A listing row is the only trace of a post whose view page was never
# captured; for 43 boards it is the only trace of the board at all.


class BoardListingEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    no: str = Field(min_length=1)
    title: str = Field(min_length=1)
    categoryLabel: str | None = None
    author: str = Field(min_length=1)
    authorMemberNo: str | None = None
    # The list printed only MM/DD (Zeroboard) or YYYY-MM-DD (Gnuboard). Day
    # precision; None when the row carried no date.
    createdAt: date | None = None
    # True when the year is not in the row and had to be taken from the
    # capture date (no gold post or gold neighbours to pin it).
    yearApprox: bool = False
    hits: int | None = None
    commentCount: int = Field(ge=0)
    isNotice: bool = False
    # 0 for a post; for a reply, its depth (1 when the skin did not show it).
    # Omitted from the JSON when 0.
    replyDepth: int = Field(default=0, ge=0)
    # Wayback ts of the list page this row came from.
    capturedAt: str
    listPage: int = Field(ge=1)
    # True when the museum holds the post itself (`src/content/posts`).
    hasPost: bool = False


class BoardListing(BaseModel):
    model_config = ConfigDict(extra="forbid")

    board: str = Field(min_length=1)
    engine: SourceEngine
    # Distinct list pages read, and the captures of them (L2 adds more
    # captures of the same pages).
    pagesCaptured: int = Field(ge=1)
    capturesRead: int = Field(ge=1)
    # As printed on the newest captured page ("total N"), when present.
    totalReported: int | None = None
    generatedAt: datetime
    entries: list[BoardListingEntry]
