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

Everything in `public/` is copied into `out/` and served, so its guide lives here, not in it (an `AGENTS.md` there was published as `/AGENTS.md`). The one exception is the image sidecars (`.manifest.json` beside each image folder, which the ETL scripts read and write there): `scripts/postbuild/drop-image-sidecars.mjs` removes them from `out/`.

- `_headers` — Cloudflare Pages response headers; its comment explains why no `Content-Type` is set there. It also sends `X-Robots-Tag: noindex` on preview deployments (`https://:version.:project.pages.dev/*`); the production alias carries none, its canonicals name forg.co.kr.
- `_routes.json` is not here: the postbuild (`scripts/postbuild/old-addresses.mjs`) writes it, with `_redirects` and `_old-images.json`, into `out/` from the content — the old site's folders no museum path uses run the Pages Function (`functions/[[path]].ts`); everything else, museum pages included, stays a static file, free and fast.
- `robots.txt` — static, not `app/robots.ts`: it carries a `Content-Signal` line (search and AI search yes, AI training no) and names the training crawlers to keep out; a search console's verification line (Daum's PIN) goes here too. `og.png` is the link-preview picture (`src/lib/seo.ts`), `{hex}.txt` the IndexNow key (`scripts/deploy/indexnow.mjs`).
- `scripts/` — behaviour content pages load in place of React (`daemon-names.js`), linted as a browser script.
- `img/chrome/` (era sets in `2001/`, `2003/`, `2014/`, the rest flat) and `img/emoticon/` (ADR-0017) are tracked in git; `img/placeholder/` holds `missing.svg` for posts and `missing-slot.svg` for `/site/` pages, where the route frames the whole slot.
- `img/posts/` — post and site-page images. Bytes are git-ignored and served from R2, only the `.manifest.json` sidecars are tracked. Don't add files by hand: `download-images.py` writes them and `pnpm deploy:img` uploads them. Gold refers to `/img/posts/…`; `src/lib/img-base.ts` adds the R2 host.

## Deploy

Cloudflare Pages (`forg.co.kr`, alias `forg-archive.pages.dev`, ADR-0015) builds on push. Images first, then push: `pnpm deploy:img` (supports `--dry-run`, uploads what changed by MD5 vs ETag), `pnpm deploy:search` (uploads every file; `--dry-run` only counts them per Cache-Control).
