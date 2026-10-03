/**
 * The part of the Pagefind browser API the search page uses
 * (https://pagefind.app/docs/api/). `pagefind.js` is a postbuild artifact
 * loaded at run time from `NEXT_PUBLIC_PAGEFIND_BASE`, so nothing can import
 * its types; they are declared here.
 */

export interface PagefindResultData {
  url: string;
  excerpt: string;
  meta: Record<string, string | undefined>;
  filters: Record<string, string[] | undefined>;
}

export interface PagefindApi {
  search: (query: string) => Promise<{ results: { data: () => Promise<PagefindResultData> }[] }>;
}
