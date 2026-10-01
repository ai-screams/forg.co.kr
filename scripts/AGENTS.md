<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-01 | Updated: 2026-10-01 -->

# scripts

## Purpose

Everything that runs outside the Next.js build: the Python ETL that turns Wayback captures into `src/content/`, the R2 upload and download scripts, post-build steps and an ad-hoc screenshot helper.

## Subdirectories

| Directory    | Purpose                                                                             |
| ------------ | ----------------------------------------------------------------------------------- |
| `etl/`       | CDX planning, download, decode, parse, index, image recovery (see `etl/AGENTS.md`)  |
| `deploy/`    | R2 uploads for images and the search index, and image pull (see `deploy/AGENTS.md`) |
| `postbuild/` | Steps `pnpm build` runs after `next build` (see `postbuild/AGENTS.md`)              |
| `dev/`       | Local verification helpers (see `dev/AGENTS.md`)                                    |

## For AI Agents

### Working In This Directory

ETL scripts run from the project venv (`.venv/bin/python3`); setup and the re-run traps are in `.claude/rules/etl.md`. Anything that talks to Wayback or R2 has outside effects — see `.claude/rules/repo-hygiene.md` before running a deploy script.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
