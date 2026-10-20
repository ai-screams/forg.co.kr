<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<!-- Generated: 2026-10-01 | Updated: 2026-10-01 -->

# forg.co.kr museum

## Purpose

A read-only digital museum of forg.co.kr (1998–2016): Wayback captures turned into JSON by a Python ETL, served by a Next.js static export that switches between the 2014, 2003 and 2001 looks and the museum's own 2026 frame. Project context and topic rules: `CLAUDE.md` and `.claude/rules/`.

## Key Files

| File                                                      | Description                                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `CLAUDE.md`                                               | Project identity, rule index, where decisions live, commands                                                 |
| `package.json`                                            | pnpm scripts (build, quality tools, R2 deploy); `postbuild` runs Pagefind and the `scripts/postbuild/` steps |
| `next.config.ts`                                          | `output: "export"`, Turbopack root, Pagefind base default for Cloudflare Pages                               |
| `eslint.config.mjs`, `knip.json`, `commitlint.config.mjs` | Lint, unused-code and commit-message rules                                                                   |
| `LICENSE`                                                 | MIT, for the code and docs                                                                                   |
| `CONTENT-NOTICE.md`                                       | The content: original authors keep their rights; fair use, takedowns, game IP                                |
| `DEVELOPMENT.md`                                          | Stack, commands, ETL stages and the tree, for people building the site (README introduces the museum)        |

## Subdirectories

| Directory            | Purpose                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/`               | The Next.js site and its generated content (see `src/AGENTS.md`)                                                                                                                |
| `scripts/`           | ETL, deploy, post-build and dev scripts (see `scripts/AGENTS.md`)                                                                                                               |
| `public/`            | Static files served as they are (see `.claude/rules/repo-hygiene.md`)                                                                                                           |
| `functions/`         | The one Cloudflare Pages Function: old forg.co.kr addresses (posts, guide pages, pictures) to the museum's; the build's `out/_routes.json` gives it only the old site's folders |
| `.claude/rules/`     | Topic rules loaded by Claude Code                                                                                                                                               |
| `.github/workflows/` | CI (`ci.yml`)                                                                                                                                                                   |
| `.husky/`            | pre-commit, commit-msg and pre-push hooks                                                                                                                                       |

Build output (`out/`, `dist-search/`) and `.docs/` are not tracked.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
