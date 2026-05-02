/** @type {import("markdownlint-cli2").Options} */
const config = {
  config: {
    default: true,
    // Allow long lines (we have wide tables and code blocks)
    "line-length": false,
    // Allow inline HTML (we use <br/>, <details>, etc.)
    "no-inline-html": false,
    // Allow multiple top-level headers (some files use them)
    "single-h1": false,
    // First line doesn't have to be H1
    "first-line-h1": false,
    // Permit duplicate headings under different parents
    "no-duplicate-heading": { siblings_only: true },
  },
  globs: ["**/*.md"],
  ignores: [
    "node_modules/**",
    ".next/**",
    "out/**",
    ".docs/**",
    "archive/**",
    "AGENTS.md",
    "CLAUDE.md",
  ],
};

export default config;
