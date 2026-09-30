import type { NextConfig } from "next";

// The search index lives on R2 behind search.forg.co.kr (ADR-0015), and the
// search page reads its address from NEXT_PUBLIC_PAGEFIND_BASE at build time.
// The Pages project does not set that variable, so production looked for
// /pagefind/ on the site itself and found nothing. A Cloudflare Pages build
// (CF_PAGES=1) now defaults to the R2 address; a variable set in the
// dashboard still wins, and a local build keeps /pagefind/.
const PAGEFIND_ON_PAGES = "https://search.forg.co.kr/";
const pagefindEnv: Record<string, string> =
  process.env["CF_PAGES"] && !process.env["NEXT_PUBLIC_PAGEFIND_BASE"]
    ? { NEXT_PUBLIC_PAGEFIND_BASE: PAGEFIND_ON_PAGES }
    : {};

const nextConfig: NextConfig = {
  // Static export for archival site (ADR-0003)
  output: "export",
  env: pagefindEnv,
  images: {
    unoptimized: true,
  },
  trailingSlash: true,

  // Pin Turbopack workspace root to silence detection of unrelated parent lockfiles
  // Uses Node 20.11+ `import.meta.dirname` (we target Node 24+).
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
