/**
 * /search — global full-text search powered by Pagefind.
 *
 * Pagefind is a postbuild artifact. Locally (`pnpm dev`) the index does not
 * exist, so the load fails the way a network failure does and the page says
 * the index could not be loaded.
 *
 * In production the Pagefind bundle is hosted on Cloudflare R2 (separated
 * from the Cloudflare Pages site to satisfy the 20,000-file deploy cap —
 * see ADR-0015). The base URL is provided at build time via
 * `NEXT_PUBLIC_PAGEFIND_BASE` (default `/pagefind/` for local preview).
 *
 * The runtime, the query and the last search live in `use-pagefind.ts`;
 * this file draws the box, the one notice `searchView` allows and the
 * results.
 *
 * Tailwind v4 era-aware tokens (`bg-(--era-content-bg)` etc.) draw the panel
 * and its borders — no era-specific branching in JS, pure CSS variable
 * resolution. The boxes inside the panel (the input, the notice, each
 * result) are white in every era: `--era-page-bg` is white in 2003 and 2001
 * but slate in 2014, where it buried the dark text.
 */

"use client";

import { useState } from "react";

import {
  searchView,
  usePagefind,
  usePagefindSearch,
  useUrlQuery,
  type SearchResult,
} from "./use-pagefind";

const NOTICE_TEXT = {
  unavailable: "검색 색인을 불러오지 못했습니다.",
  failed: "검색 중 오류가 났습니다.",
} as const;

export default function SearchPage() {
  const urlQuery = useUrlQuery();
  // What the visitor has typed, if anything; until then the URL's query stands.
  const [typed, setTyped] = useState<string | null>(null);
  const query = typed ?? urlQuery;
  const pagefind = usePagefind();
  const found = usePagefindSearch(pagefind, query);
  const trimmedQuery = query.trim();
  const { notice, results } = searchView(pagefind, trimmedQuery, found);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <div className="rounded-md border border-(--era-input-border) bg-(--era-content-bg) shadow-sm">
        {/* Search header */}
        <div className="border-b border-(--era-input-border) px-6 py-5">
          <h1 className="text-xl font-bold text-forg-ink">검색</h1>
          <p className="mt-1 text-xs text-forg-muted">
            forg.co.kr 아카이브 전체 — 게시글과 안내 페이지(스킬·던전·지도 등)
          </p>
          <div className="mt-4">
            <input
              type="search"
              value={query}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="제목·본문·작성자·댓글에서 검색…"
              autoFocus
              className="w-full rounded border border-(--era-input-border) bg-white px-3 py-2 text-sm text-forg-ink outline-none placeholder:text-(--era-input-border) focus:border-forg-gold focus:ring-1 focus:ring-forg-gold"
            />
          </div>
        </div>

        {/* Results area */}
        <div className="px-6 py-5">
          {(notice === "unavailable" || notice === "failed") && (
            <p className="rounded border border-(--era-input-border) bg-white px-4 py-3 text-sm text-forg-muted">
              {NOTICE_TEXT[notice]} 잠시 뒤에 다시 시도해 주세요.
            </p>
          )}

          {notice === "searching" && <p className="text-sm text-forg-muted">검색 중…</p>}

          {notice === "empty" && (
            <p className="text-sm text-forg-muted">
              &ldquo;{trimmedQuery}&rdquo;에 대한 결과가 없습니다.
            </p>
          )}

          {notice === "idle" && (
            <p className="text-sm text-forg-muted">검색어를 입력하면 결과가 나타납니다.</p>
          )}

          {results.length > 0 && (
            <ol className="space-y-4">
              {results.map((r) => (
                <ResultItem key={r.url} result={r} />
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultItem({ result: r }: { result: SearchResult }) {
  return (
    <li className="rounded-md border border-(--era-input-border) bg-white px-4 py-3">
      <a
        href={r.url}
        className="block text-sm leading-snug font-bold text-(--era-link) hover:text-(--era-link-hover)"
      >
        {r.title}
      </a>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-forg-muted">
        <span className="rounded bg-forg-gold/20 px-1.5 py-0.5 text-[0.65rem] font-bold text-forg-ink">
          {r.boardKr}
        </span>
        {r.author && <span>{r.author}</span>}
      </div>
      {r.excerpt && (
        <p
          className="mt-2 text-xs leading-relaxed text-forg-muted"
          /* Pagefind wraps matched terms in <mark>; safe to set innerHTML */
          dangerouslySetInnerHTML={{ __html: r.excerpt }}
        />
      )}
    </li>
  );
}
