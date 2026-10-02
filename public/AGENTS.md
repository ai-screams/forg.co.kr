<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-01 | Updated: 2026-10-01 -->

# public

## Purpose

Static files copied as-is into `out/`.

## Key Files

| File | Description |
| -- | -- |
| `_headers` | Cloudflare Pages response headers; its comment explains why no `Content-Type` is set here |
| `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | create-next-app starter icons; nothing in `src/` or `scripts/` references them |

## Subdirectories

| Directory | Purpose |
| -- | -- |
| `img/chrome/` | Recovered site chrome (buttons, headers, skins), tracked in git; `2003/` and `2014/` hold era-specific sets |
| `img/emoticon/` | The shared comment emoticon store (ADR-0017), tracked in git |
| `img/placeholder/` | `missing.svg` for images Wayback never captured in posts; `missing-slot.svg`, the same without its dashed frame, on the static pages, where the `/site/` route frames the whole slot |
| `img/posts/` | Recovered post and site-page images. Bytes are git-ignored and served from R2; only the per-post `.manifest.json` sidecars are tracked |

## For AI Agents

### Working In This Directory

- Don't add files under `img/posts/` by hand — `scripts/etl/download-images.py` writes them with their sidecars, and `pnpm deploy:img` uploads them (see `.claude/rules/etl.md`).
- Gold JSON refers to images as `/img/posts/…`; `src/lib/img-base.ts` adds the R2 host at render time.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
