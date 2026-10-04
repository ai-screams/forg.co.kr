import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { expect, it } from "vitest";

/** Every file under `src/` that starts with the `"use client"` directive. */
function clientFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return clientFiles(path);
    if (!/\.tsx?$/.test(entry.name)) return [];
    // A directive may follow comments, as the search page's does.
    const head = readFileSync(path, "utf8").replace(/^(?:\s+|\/\*[\s\S]*?\*\/|\/\/[^\n]*)*/, "");
    return /^["']use client["']/.test(head) ? [relative(process.cwd(), path)] : [];
  });
}

// The content pages ship no React runtime (scripts/postbuild/strip-react-runtime.mjs
// keeps it on /search/ only): a client component anywhere else would render
// but never run. Behaviour on those pages is a plain script in public/scripts/.
it("keeps the search page the one client component", () => {
  expect(clientFiles(join(process.cwd(), "src"))).toEqual(["src/app/search/page.tsx"]);
});
