<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-01 | Updated: 2026-10-01 -->

# scripts/deploy

## Purpose

Node scripts that move build artifacts (recovered post images, the Pagefind
search index) to and from Cloudflare R2, since both exceed what ships in
git or in the Cloudflare Pages deploy itself. Deploy order and the
Pages file-count constraint are documented in `.claude/rules/repo-hygiene.md`
— read that first.

## Key Files

| File                      | Description                                                                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `r2-client.mjs`           | Shared R2 client — SigV4 signing via `aws4fetch`, made on the first request; `putObject`, `getObject`, `listKeys` (all through a retry that covers network errors aws4fetch's own 5xx/429 retry doesn't), `runPool`, `walk`, `mime`   |
| `upload-images-to-r2.mjs` | Uploads `public/img/posts/` to R2 bucket `forg-img` under key prefix `posts/`, skipping files whose MD5 matches the existing ETag. Wired as `pnpm deploy:img`                                                                         |
| `pull-images-from-r2.mjs` | Reverse of the above — downloads the `posts/` keys missing from `public/img/posts/` for a clone that needs the bytes locally; never overwrites a local file (one of another size is listed). Wired as `pnpm img:pull`                 |
| `indexnow.mjs`            | Submits every `out/sitemap.xml` address to IndexNow (Bing, Naver, Yandex…) after checking `https://forg.co.kr/{key}.txt` serves the key in `public/`. `--dry-run` counts. Wired as `pnpm indexnow`; run after a deploy, with approval |
| `upload-search-to-r2.mjs` | Uploads `dist-search/` (the separated Pagefind bundle) to R2 bucket `forg-search`. Wired as `pnpm deploy:search`                                                                                                                      |

## For AI Agents

### Working In This Directory

- Env vars (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) come from `.env.r2.local` (gitignored). `r2-client.mjs` reads them on the first request, and a missing one exits the process with a message; a dry run that never talks to R2 (`deploy:search --dry-run`) needs none.
- Bucket names and concurrency are overridable: `R2_IMG_BUCKET` (default `forg-img`), `R2_BUCKET` (default `forg-search`), `R2_CONCURRENCY` (default `20`).
- `upload-images-to-r2.mjs` supports `--dry-run` (report only, no PUTs). `upload-search-to-r2.mjs --dry-run` only counts the files per Cache-Control (hashed `.pf_*` a year, the rest five minutes); without it every file is PUT. `pull-images-from-r2.mjs --dry-run` lists the bucket and reports what it would fetch and which local files differ, without downloading.
- Deploy order matters: images before the site push, per `.claude/rules/repo-hygiene.md`.

### Testing Requirements

No automated test suite. Verify a change by running the affected script with `--dry-run` where supported, or against a scratch bucket; otherwise confirm behavior by reading the diffed PUT/GET calls before running against the real `forg-img`/`forg-search` buckets.

### Common Patterns

- All three upload/download scripts import shared primitives from `r2-client.mjs` rather than reimplementing signing or concurrency control — add new R2 operations there, not inline.
- Idempotency is content-addressed: uploads compare local MD5 against the R2 object's ETag (single-PUT ETag is the object's MD5) and skip matches; downloads fetch only files missing locally and never overwrite one.

## Dependencies

### Internal

- `public/img/posts/` — git-ignored image bytes these scripts move to/from R2 (ADR-0018); per-post `.manifest.json` sidecars stay in git and are never uploaded.
- `dist-search/` — produced by `scripts/postbuild/separate-search-bundle.mjs`, consumed by `upload-search-to-r2.mjs`.
- `src/lib/img-base.ts` — reads `NEXT_PUBLIC_IMG_BASE` at render time to point `<img>` at the R2-hosted copy instead of a local file.

### External

- `aws4fetch` — S3-compatible SigV4 request signing against the R2 endpoint.
- Cloudflare R2 (S3-compatible API) — two buckets, `forg-img` and `forg-search`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
