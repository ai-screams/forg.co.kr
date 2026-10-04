# Repository hygiene and deploy

## .gitignore traps

- `/lib/`, `/lib64/`, `/var/`, `/parts/`, `/sdist/`, `/wheels/` are root-anchored on purpose — unanchored `lib/` once swallowed `src/lib/era.ts` and broke CI (`155034f`).
- `.docs/`, `.venv/`, `archive/`, `archive-utf8/`, run logs, `skills-lock.json`, `.agents/` are ignored on purpose; don't commit them.
- `.claude/` is ignored except `.claude/rules/`; `.vscode/*.json`, `.editorconfig`, `.npmrc`, `.nvmrc` are whitelisted re-includes.

## Not in the repo

- Wayback captures (bronze/silver) — in `.docs/research/`, reproducible from CDX.
- Post image bytes — R2 (`pnpm img:pull` hydrates a clone with the files it lacks; it never overwrites one).

Chrome assets are in git at `public/img/chrome/` (recovered by single-URL probes because prefix CDX returned nothing). A name `chromeUrl` asks for that is not there stops the build; `optionalChrome` marks the few Wayback never kept.

## `public/`

Everything in `public/` is copied into `out/` and served, so its guide lives here, not in it (an `AGENTS.md` there was published as `/AGENTS.md`).

- `_headers` — Cloudflare Pages response headers; its comment explains why no `Content-Type` is set there.
- `img/chrome/` (era sets in `2001/`, `2003/`, `2014/`, the rest flat) and `img/emoticon/` (ADR-0017) are tracked in git; `img/placeholder/` holds `missing.svg` for posts and `missing-slot.svg` for `/site/` pages, where the route frames the whole slot.
- `img/posts/` — post and site-page images. Bytes are git-ignored and served from R2, only the `.manifest.json` sidecars are tracked. Don't add files by hand: `download-images.py` writes them and `pnpm deploy:img` uploads them. Gold refers to `/img/posts/…`; `src/lib/img-base.ts` adds the R2 host.

## Deploy

Cloudflare Pages (`forg-archive.pages.dev`, ADR-0015) builds on push. Images first, then push: `pnpm deploy:img` (supports `--dry-run`, uploads what changed by MD5 vs ETag), `pnpm deploy:search` (uploads every file; `--dry-run` only counts them per Cache-Control).
