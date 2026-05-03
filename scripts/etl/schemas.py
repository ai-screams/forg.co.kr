"""Pydantic models for parsed forg.co.kr posts.

These mirror the TypeScript interfaces in `src/types/post.ts` 1:1.
When changing the schema, update both files together — the React build
expects the Python parser's JSON output to match the TS types exactly.
"""

from __future__ import annotations

from datetime import datetime
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
    commentCount: int = Field(ge=0)
    attachmentCount: int = Field(ge=0)
    hits: int | None = None
    recommend: int | None = None
    era: PostEra


class BoardIndexPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    board: str = Field(min_length=1)
    page: int = Field(ge=1)
    totalPages: int = Field(ge=1)
    totalPosts: int = Field(ge=0)
    generatedAt: datetime
    entries: list[BoardIndexEntry]
