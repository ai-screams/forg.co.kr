import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for archival site (ADR-0003)
  output: "export",
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
