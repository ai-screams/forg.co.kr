# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project identity

This repository is a **digital museum for forg.co.kr** (1998–2016: "Since 1998" on its own footer; last post 2016-03-09, last normal capture 2016-08-20), the largest Korean Ultima Online community fan site. It is a non-commercial preservation project — read-only archive of Wayback-captured posts, plus a modern Next.js shell that switches between three visual eras (2014 default; 2003 and 2001 toggles).

The README describes the goal in detail. The two non-obvious facts that affect every change:

- The site is fundamentally **read-only**. There is no auth, no posting, no DB. Comments will be added later via Giscus (GitHub Discussions backend), not a self-hosted system.
- forg's **signature gold `#FFC73B` is invariant across the eras**. Era toggling only swaps the chrome (page bg, sidebar, links). Do not introduce era-aware utilities for token values that should be era-invariant.

## Topic rules (`.claude/rules/`)

Details live in rule files. Rules with `paths:` frontmatter load once a matching file is read (rules without it load at launch); before planning work in an area, read its rule directly.

| File                                                       | Covers                                                                      | Loads for                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------- |
| [etl.md](.claude/rules/etl.md)                             | data tiers, parsers, re-run traps, image recovery, Wayback politeness, venv | `scripts/**`, `src/content/**`, `public/img/**` |
| [routing-and-pages.md](.claude/rules/routing-and-pages.md) | routes, board rendering, `/site/` pages, search                             | `src/app/**`, `src/components/**`, `src/lib/**` |
| [era-and-ui.md](.claude/rules/era-and-ui.md)               | era toggle, tokens, OKLCH, mobile layout                                    | `src/**`                                        |
| [stack-and-tooling.md](.claude/rules/stack-and-tooling.md) | versions, hooks, CI                                                         | always                                          |
| [repo-hygiene.md](.claude/rules/repo-hygiene.md)           | `.gitignore` traps, what is not in git, deploy                              | always                                          |

## Where decisions live (gitignored, internal)

`.docs/` holds the internal context and is **gitignored on purpose** — never stage it.

- `.docs/ADR/` — 19 ADRs (index `.docs/ADR/README.md`; 0009 and 0011 superseded). Read the ADR before changing tokens, the era system, ETL or the stack; append a new ADR rather than editing an accepted one. Key ones: 0012 single-URL CDX fallback, 0013 every board enumerated, 0014 licensing (MIT code, authors keep content), 0015 Cloudflare Pages, 0016 visual fidelity + chrome second pass, 0017 collection gaps (list-page tier, emoticon store), 0018 post images on R2, 0019 the 2001 era.
- `.docs/considerations/` — deferred decisions (`CONS-NNNN`), each with its re-evaluation trigger.
- `.docs/plan/ROADMAP.md` — phased checklist (P0–P5).
- `.docs/research/` — CDX results, raw captures, `FORG-RECONSTRUCTION-GUIDE.md` (original boards, colours, engines).
- `.docs/decisions/`, `.docs/gotchas.md`, `.docs/prs/`, `.docs/followups.md` — per-topic decisions, gotchas, PR logs and the backlog.

## Commands

```bash
pnpm dev               # Next.js dev server (Turbopack)
pnpm build             # static export to out/
pnpm typecheck         # tsc --noEmit
pnpm lint              # eslint
pnpm lint:md           # markdownlint-cli2
pnpm format:check      # prettier --check .
pnpm secret            # secretlint scan
pnpm knip              # unused exports/files/deps
pnpm size              # size-limit (200KB JS / 50KB CSS budgets)
pnpm deploy:img        # R2 image upload (--dry-run available)
pnpm deploy:search     # R2 search index upload — no dry-run
```
