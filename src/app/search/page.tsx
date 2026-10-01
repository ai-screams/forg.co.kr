/**
 * /search — global full-text search powered by Pagefind.
 *
 * Pagefind is a postbuild artifact. Locally (`pnpm dev`) the index does not
 * exist, so the load fails gracefully and a dev-mode notice is shown.
 *
 * In production the Pagefind bundle is hosted on Cloudflare R2 (separated
 * from the Cloudflare Pages site to satisfy the 20,000-file deploy cap —
 * see ADR-0015). The base URL is provided at build time via
 * `NEXT_PUBLIC_PAGEFIND_BASE` (default `/pagefind/` for local preview).
 *
 * We load `${PAGEFIND_BASE}pagefind.js` at runtime via an indirect `import()`
 * expression so TypeScript does not attempt to resolve the URL as a module
 * path at typecheck time.
 *
 * Tailwind v4 era-aware tokens (`bg-(--era-content-bg)` etc.) are used
 * throughout — no era-specific branching in JS, pure CSS variable resolution.
 */

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** Minimal Pagefind result data surface we need. */
interface PfResultData {
  url: string;
  excerpt: string;
  meta: Record<string, string | undefined>;
  filters: Record<string, string[] | undefined>;
}

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Load the Pagefind runtime. Uses an indirect dynamic import so TypeScript
 * never attempts to resolve `/pagefind/pagefind.js` as a module path during
 * typecheck — it only exists after the postbuild step.
 */
/**
 * Resolves to e.g. `/pagefind/` (local) or `https://search.forg.co.kr/`
 * (production R2 bundle). Always ends with `/` so we can concatenate.
 */
const PAGEFIND_BASE_RAW = process.env["NEXT_PUBLIC_PAGEFIND_BASE"] ?? "/pagefind/";
const PAGEFIND_BASE = PAGEFIND_BASE_RAW.endsWith("/") ? PAGEFIND_BASE_RAW : `${PAGEFIND_BASE_RAW}/`;

interface PagefindApi {
  search: (q: string) => Promise<{ results: Array<{ data: () => Promise<PfResultData> }> }>;
}

async function loadPagefind(): Promise<PagefindApi | null> {
  try {
    // Indirect expression import — prevents TS module resolution
    const url = `${PAGEFIND_BASE}pagefind.js`;
    const pf = await (Function("u", "return import(u)")(url) as Promise<unknown>);
    return pf as PagefindApi;
  } catch {
    return null;
  }
}

type PagefindState =
  | { status: "loading" }
  | { status: "ready"; api: PagefindApi }
  | { status: "unavailable" };

interface SearchResult {
  url: string;
  title: string;
  author: string;
  boardKr: string;
  excerpt: string;
}

function toResult(item: PfResultData): SearchResult {
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

// A static page's URL does not change under it, so there is nothing to
// subscribe to; useSyncExternalStore still needs the callback.
function subscribeToNothing() {
  return () => {};
}

function readUrlQuery(): string {
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

export default function SearchPage() {
  // The era shells carry the original's search box, which lands here as
  // `?q=`. The URL is an external system, so it is read the way the era
  // toggle reads localStorage: through useSyncExternalStore, with an empty
  // server snapshot so the static HTML and the hydrating client agree.
  const urlQuery = useSyncExternalStore(subscribeToNothing, readUrlQuery, () => "");
  // What the visitor has typed, if anything; until then the URL's query stands.
  const [typed, setTyped] = useState<string | null>(null);
  const query = typed ?? urlQuery;
  const [pagefind, setPagefind] = useState<PagefindState>({ status: "loading" });
  // The last finished search. Results stay on screen while a newer one runs.
  const [found, setFound] = useState<{ query: string; results: SearchResult[] } | null>(null);
  const debouncedQuery = useDebouncedValue(query, 200);

  useEffect(() => {
    void loadPagefind().then((api) => {
      setPagefind(api ? { status: "ready", api } : { status: "unavailable" });
    });
  }, []);

  // Depends on `pagefind` so a `?q=` search, which arrives before the
  // runtime has loaded, runs once it is ready. Pagefind answers searches in
  // the order they were asked, so the last to finish is the newest query.
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q || pagefind.status !== "ready") return;
    pagefind.api
      .search(q)
      .then(({ results: raw }) => Promise.all(raw.slice(0, 30).map((r) => r.data())))
      .then(
        (items) => setFound({ query: q, results: items.map(toResult) }),
        () => setFound({ query: q, results: [] }),
      );
  }, [debouncedQuery, pagefind]);

  const trimmedQuery = query.trim();
  const devMode = pagefind.status === "unavailable";
  const searching = trimmedQuery !== "" && !devMode && found?.query !== trimmedQuery;
  const results = trimmedQuery && found ? found.results : [];

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <div className="rounded-md border border-(--era-input-border) bg-(--era-content-bg) shadow-sm">
        {/* Search header */}
        <div className="border-b border-(--era-input-border) px-6 py-5">
          <h1 className="text-forg-ink text-xl font-bold">검색</h1>
          <p className="text-forg-muted mt-1 text-xs">
            forg.co.kr 아카이브 전체 — 게시글과 안내 페이지(스킬·던전·지도 등)
          </p>
          <div className="mt-4">
            <input
              type="search"
              value={query}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="제목·본문·작성자·댓글에서 검색…"
              autoFocus
              className="text-forg-ink focus:border-forg-gold focus:ring-forg-gold w-full rounded border border-(--era-input-border) bg-(--era-page-bg) px-3 py-2 text-sm outline-none placeholder:text-(--era-input-border) focus:ring-1"
            />
          </div>
        </div>

        {/* Results area */}
        <div className="px-6 py-5">
          {devMode && (
            <p className="text-forg-muted rounded border border-(--era-input-border) bg-(--era-page-bg) px-4 py-3 text-sm">
              검색 인덱스 준비 중 — <code className="font-mono text-xs">pnpm build</code> 실행 후
              사용할 수 있습니다.
            </p>
          )}

          {searching && <p className="text-forg-muted text-sm">검색 중…</p>}

          {!searching && trimmedQuery && !devMode && results.length === 0 && (
            <p className="text-forg-muted text-sm">
              &ldquo;{trimmedQuery}&rdquo;에 대한 결과가 없습니다.
            </p>
          )}

          {!devMode && !trimmedQuery && (
            <p className="text-forg-muted text-sm">검색어를 입력하면 결과가 나타납니다.</p>
          )}

          {results.length > 0 && (
            <ol className="space-y-4">
              {results.map((r) => (
                <li
                  key={r.url}
                  className="rounded-md border border-(--era-input-border) bg-(--era-page-bg) px-4 py-3"
                >
                  <a
                    href={r.url}
                    className="block text-sm leading-snug font-bold text-(--era-link) hover:text-(--era-link-hover)"
                  >
                    {r.title}
                  </a>
                  <div className="text-forg-muted mt-1 flex flex-wrap items-center gap-x-3 text-xs">
                    <span className="bg-forg-gold/20 text-forg-ink rounded px-1.5 py-0.5 text-[0.65rem] font-bold">
                      {r.boardKr}
                    </span>
                    {r.author && <span>{r.author}</span>}
                  </div>
                  {r.excerpt && (
                    <p
                      className="text-forg-muted mt-2 text-xs leading-relaxed"
                      /* Pagefind wraps matched terms in <mark>; safe to set innerHTML */
                      dangerouslySetInnerHTML={{ __html: r.excerpt }}
                    />
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
