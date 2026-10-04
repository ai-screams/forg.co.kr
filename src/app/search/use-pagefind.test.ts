import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PagefindApi } from "@/types/pagefind";

import { startSearch, watchLoad, type Found, type PagefindState } from "./use-pagefind";

/** Lets the promise chains inside the functions under test run. */
async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

/** A Pagefind runtime whose searches answer when the test says so. */
function fakePagefind() {
  type Answer = Awaited<ReturnType<PagefindApi["search"]>>;
  const pending = new Map<string, { resolve: (a: Answer) => void; reject: (e: Error) => void }>();
  const api: PagefindApi = {
    search: (query) =>
      new Promise<Answer>((resolve, reject) => {
        pending.set(query, { resolve, reject });
      }),
  };
  const call = (query: string) => {
    const p = pending.get(query);
    if (!p) throw new Error(`no search for ${query}`);
    return p;
  };
  return {
    api,
    answer: (query: string, ...urls: string[]) => {
      call(query).resolve({
        results: urls.map((url) => ({
          data: () => Promise.resolve({ url, excerpt: "", meta: { title: url }, filters: {} }),
        })),
      });
    },
    fail: (query: string) => {
      call(query).reject(new Error("broken"));
    },
  };
}

const urlsOf = (found: Found) => (found.failed ? "failed" : found.results.map((r) => r.url));

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("startSearch", () => {
  it("ignores a search the query has moved past", async () => {
    const { api, answer } = fakePagefind();
    const found: Found[] = [];
    const stopOld = startSearch(api, "울티", (f) => found.push(f));
    stopOld();
    startSearch(api, "울티마", (f) => found.push(f));
    answer("울티마", "/new/");
    answer("울티", "/old/");
    await flush();
    expect(found.map((f) => [f.query, urlsOf(f)])).toEqual([["울티마", ["/new/"]]]);
  });

  it("reports a search that fails", async () => {
    const { api, fail } = fakePagefind();
    const found: Found[] = [];
    startSearch(api, "q", (f) => found.push(f));
    fail("q");
    await flush();
    expect(found.map(urlsOf)).toEqual(["failed"]);
  });

  it("gives up on a search that never answers, and takes its results if they come", async () => {
    const { api, answer } = fakePagefind();
    const found: Found[] = [];
    startSearch(api, "q", (f) => found.push(f));
    await vi.advanceTimersByTimeAsync(14_999);
    expect(found).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(found.map(urlsOf)).toEqual(["failed"]);
    answer("q", "/late/");
    await flush();
    expect(found.map(urlsOf)).toEqual(["failed", ["/late/"]]);
  });

  it("does not time out a search that answered, or one the query moved past", async () => {
    const { api, answer } = fakePagefind();
    const found: Found[] = [];
    startSearch(api, "answered", (f) => found.push(f));
    answer("answered", "/a/");
    await flush();
    startSearch(api, "dropped", (f) => found.push(f))();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(found.map(urlsOf)).toEqual([["/a/"]]);
  });
});

describe("watchLoad", () => {
  const api: PagefindApi = { search: () => Promise.resolve({ results: [] }) };

  it("reports the runtime once it loads, or that it is unavailable", async () => {
    const states: PagefindState[] = [];
    watchLoad(Promise.resolve(api), (s) => states.push(s));
    watchLoad(Promise.resolve(null), (s) => states.push(s));
    await flush();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(states.map((s) => s.status)).toEqual(["ready", "unavailable"]);
  });

  it("calls a load that hangs unavailable, and takes the runtime if it comes", async () => {
    let arrive: (api: PagefindApi) => void = () => {};
    const states: PagefindState[] = [];
    watchLoad(new Promise((resolve) => (arrive = resolve)), (s) => states.push(s));
    await vi.advanceTimersByTimeAsync(14_999);
    expect(states).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    arrive(api);
    await flush();
    expect(states.map((s) => s.status)).toEqual(["unavailable", "ready"]);
  });

  it("reports nothing after its cleanup, whether the load finishes or hangs", async () => {
    const states: PagefindState[] = [];
    watchLoad(Promise.resolve(api), (s) => states.push(s))();
    watchLoad(new Promise(() => {}), (s) => states.push(s))();
    await flush();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(states).toEqual([]);
  });
});
