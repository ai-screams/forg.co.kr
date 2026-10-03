# Repository hygiene and deploy

## .gitignore traps

- `/lib/`, `/lib64/`, `/var/`, `/parts/`, `/sdist/`, `/wheels/` are root-anchored on purpose — unanchored `lib/` once swallowed `src/lib/era.ts` and broke CI (`155034f`).
- `.docs/`, `.venv/`, `archive/`, `archive-utf8/`, run logs, `skills-lock.json`, `.agents/` are ignored on purpose; don't commit them.
- `.claude/` is ignored except `.claude/rules/`; `.vscode/*.json`, `.editorconfig`, `.npmrc`, `.nvmrc` are whitelisted re-includes.

## Not in the repo

- Wayback captures (bronze/silver) — in `.docs/research/`, reproducible from CDX.
- Post image bytes — R2 (`pnpm img:pull` hydrates a clone with the files it lacks; it never overwrites one).

Chrome assets are in git at `public/img/chrome/` (recovered by single-URL probes because prefix CDX returned nothing). A name `chromeUrl` asks for that is not there stops the build; `optionalChrome` marks the few Wayback never kept.

## Deploy

Cloudflare Pages (`forg-archive.pages.dev`, ADR-0015) builds on push. Images first, then push: `pnpm deploy:img` (supports `--dry-run`, uploads what changed by MD5 vs ETag), `pnpm deploy:search` (uploads every file; `--dry-run` only counts them per Cache-Control).
