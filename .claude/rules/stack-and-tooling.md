# Stack versions and quality tooling

## Versions (they matter)

- **Next.js 16.x**, App Router, Turbopack, `output: "export"`. `turbopack.root` uses `import.meta.dirname`. `next lint` is gone — use `eslint`.
- **React 19.x** — server components by default, no `forwardRef`.
- **TypeScript 6.x** — strict + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, …; `@total-typescript/ts-reset` (`src/types/reset.d.ts`) makes `JSON.parse` return `unknown`.
- **Tailwind v4** CSS-first: no `tailwind.config.js`, tokens in `@theme`. The class-sort Prettier plugin must come **after** `prettier-plugin-organize-imports`.
- **ESLint 9.x** — held until `eslint-config-next@17` supports 10.
- **`@types/node` 25.x** matches the `ts6.0` dist-tag; don't downgrade for Node 24 LTS.
- **pnpm 10.33.x** pinned in `packageManager` (needed by `pnpm/action-setup@v4`).
- **Pagefind pinned 1.4.0.** 1.5.x keys words without diacritics and leaves composed Hangul in `additional_variants`, which its chunker does not count, so every Korean word lands in one 17.9 MB index chunk (CloudCannon/pagefind#1211, fixed by #1316, unreleased on 2026-10-03). Move up once a release carries #1316 and the Hangul range splits.

## Hooks and CI

- pre-commit: `lint-staged` (eslint --fix, prettier, secretlint; markdownlint on `.md`). Hook scripts source `~/.nvm/nvm.sh`; copy that prelude into any new hook.
- commit-msg: commitlint, Conventional Commits, header ≤100, body line ≤120.
- pre-push: `pnpm typecheck && pnpm lint`.
- Tests: `pnpm test` (Vitest, `src/**/*.test.ts`, node environment, `@/` alias in `vitest.config.mts`).
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, format and knip on push/PR. It does not build: Cloudflare Pages builds every push (its PR check), and the build on the 2-core runner hit the job limit. Run `pnpm build` and `pnpm size` locally before a PR that changes pages or bundles; `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` opts runner JS actions into Node 24.
