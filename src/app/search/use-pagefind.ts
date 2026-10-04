/**
 * The search page's state: the Pagefind runtime, the `?q=` query, and the
 * last finished search, reduced to what the page shows (`searchView`).
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { preloadModule } from "react-dom";

import type { PagefindApi, PagefindResultData } from "@/types/pagefind";

/**
 * Resolves to e.g. `/pagefind/` (local) or `https://search.forg.co.kr/1.4.0/`
 * (production R2 bundle). Always ends with `/` so we can concatenate.
 */
const PAGEFIND_BASE_RAW = process.env["NEXT_PUBLIC_PAGEFIND_BASE"] ?? "/pagefind/";
const PAGEFIND_BASE = PAGEFIND_BASE_RAW.endsWith("/") ? PAGEFIND_BASE_RAW : `${PAGEFIND_BASE_RAW}/`;
const PAGEFIND_JS = `${PAGEFIND_BASE}pagefind.js`;

/** How long the runtime may take to load before the page calls it unavailable. */
const LOAD_TIMEOUT_MS = 15_000;

/** How long a search may run before the page says it failed. A slow first
 *  search also loads the wasm and an index chunk; a runtime whose wasm did
 *  not load never answers at all. */
const SEARCH_TIMEOUT_MS = 15_000;

/** Load the Pagefind runtime; it only exists after the postbuild step. */
async function loadPagefind(): Promise<PagefindApi | null> {
  try {
    return (await import(/* webpackIgnore: true */ PAGEFIND_JS)) as PagefindApi;
  } catch {
    return null;
  }
}

export type PagefindState =
  | { status: "loading" }
  | { status: "ready"; api: PagefindApi }
  | { status: "unavailable" };

/**
 * The runtime, kept in state (not a ref) so a search that arrived before it
 * loaded runs again once it is ready. Preloaded from the static HTML, so the
 * download starts before hydration.
 */
export function usePagefind(): PagefindState {
  const [pagefind, setPagefind] = useState<PagefindState>({ status: "loading" });
  preloadModule(PAGEFIND_JS);
  useEffect(() => watchLoad(loadPagefind(), setPagefind), []);
  return pagefind;
}

/**
 * Reports the runtime's state once `load` settles. Past LOAD_TIMEOUT_MS
 * without an answer it reports `unavailable`; a runtime that arrives after
 * that still becomes `ready`. Returns the effect's cleanup, after which
 * nothing is reported.
 */
export function watchLoad(
  load: Promise<PagefindApi | null>,
  report: (state: PagefindState) => void,
): () => void {
  let active = true;
  const timer = setTimeout(() => report({ status: "unavailable" }), LOAD_TIMEOUT_MS);
  void load.then((api) => {
    clearTimeout(timer);
    if (active) report(api ? { status: "ready", api } : { status: "unavailable" });
  });
  return () => {
    active = false;
    clearTimeout(timer);
  };
}

// A static page's URL does not change under it, so there is nothing to
// subscribe to; useSyncExternalStore still needs the callback.
function subscribeToNothing() {
  return () => {};
}

function readUrlQuery(): string {
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

/**
 * `?q=`, as the era shells' search boxes send it. The URL is an external
 * system, so it is read the way the era toggle reads localStorage: through
 * useSyncExternalStore, with an empty server snapshot so the static HTML and
 * the hydrating client agree.
 */
export function useUrlQuery(): string {
  return useSyncExternalStore(subscribeToNothing, readUrlQuery, () => "");
}

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export interface SearchResult {
  url: string;
  title: string;
  author: string;
  boardKr: string;
  excerpt: string;
}

function toResult(item: PagefindResultData): SearchResult {
  const boardId = item.filters["board"]?.[0] ?? "";
  return {
    url: item.url,
    title: item.meta["title"] ?? "(제목 없음)",
    author: item.meta["author"] ?? "",
    // Post pages carry their board's Korean name as `boardKr` meta, so the
    // board catalog stays out of this client bundle.
    boardKr: boardId === "site" ? "안내 페이지" : (item.meta["boardKr"] ?? boardId),
    excerpt: item.excerpt,
  };
}

/** The last finished search. */
export interface Found {
  query: string;
  results: SearchResult[];
  failed?: true;
}

/**
 * Runs `query` (debounced) once the runtime is ready and keeps the last
 * finished search; its results stay on screen while a newer one runs.
 */
export function usePagefindSearch(pagefind: PagefindState, query: string): Found | null {
  const [found, setFound] = useState<Found | null>(null);
  const debouncedQuery = useDebouncedValue(query, 200);
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q || pagefind.status !== "ready") return;
    return startSearch(pagefind.api, q, setFound);
  }, [debouncedQuery, pagefind]);
  return found;
}

/**
 * Runs one search and reports what it found. Past SEARCH_TIMEOUT_MS it
 * reports a failure; results that arrive after that still replace it.
 * Returns the effect's cleanup: once the query has moved on, this search
 * reports nothing, so a slow older query cannot replace a newer one's
 * results.
 */
export function startSearch(
  api: PagefindApi,
  query: string,
  report: (found: Found) => void,
): () => void {
  let active = true;
  const timer = setTimeout(() => report({ query, results: [], failed: true }), SEARCH_TIMEOUT_MS);
  const settle = (found: Found) => {
    clearTimeout(timer);
    if (active) report(found);
  };
  api
    .search(query)
    .then(({ results: raw }) => Promise.all(raw.slice(0, 30).map((r) => r.data())))
    .then(
      (items) => settle({ query, results: items.map(toResult) }),
      () => settle({ query, results: [], failed: true }),
    );
  return () => {
    active = false;
    clearTimeout(timer);
  };
}

/**
 * What the page says, at most one at a time, and the results it lists.
 * `unavailable`: the runtime could not load. `failed`: this query's search
 * failed. `searching`: a search for this query is still running (the
 * previous results stay listed). `empty`: it found nothing. `idle`: nothing
 * typed yet.
 */
export function searchView(
  pagefind: PagefindState,
  query: string,
  found: Found | null,
): {
  notice: "unavailable" | "failed" | "searching" | "empty" | "idle" | null;
  results: SearchResult[];
} {
  const results = query && found ? found.results : [];
  if (pagefind.status === "unavailable") return { notice: "unavailable", results };
  if (!query) return { notice: "idle", results };
  if (found?.query !== query) return { notice: "searching", results };
  if (found.failed) return { notice: "failed", results };
  return { notice: results.length === 0 ? "empty" : null, results };
}
