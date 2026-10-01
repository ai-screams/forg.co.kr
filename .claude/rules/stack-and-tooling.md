# Stack versions and quality tooling

## Versions (they matter)

- **Next.js 16.x**, App Router, Turbopack, `output: "export"`. `turbopack.root` uses `import.meta.dirname`. `next lint` is gone — use `eslint`.
- **React 19.x** — server components by default, no `forwardRef`.
- **TypeScript 6.x** — strict + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, …; `@total-typescript/ts-reset` (`src/types/reset.d.ts`) makes `JSON.parse` return `unknown`.
- **Tailwind v4** CSS-first: no `tailwind.config.js`, tokens in `@theme`. The class-sort Prettier plugin must come **after** `prettier-plugin-organize-imports`.
- **ESLint 9.x** — held until `eslint-config-next@17` supports 10.
- **`@types/node` 25.x** matches the `ts6.0` dist-tag; don't downgrade for Node 24 LTS.
- **pnpm 10.33.x** pinned in `packageManager` (needed by `pnpm/action-setup@v4`).

## Hooks and CI

- pre-commit: `lint-staged` (eslint --fix, prettier, secretlint; markdownlint on `.md`). Hook scripts source `~/.nvm/nvm.sh`; copy that prelude into any new hook.
- commit-msg: commitlint, Conventional Commits, header ≤100, body line ≤120.
- pre-push: `pnpm typecheck && pnpm lint`.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, format, build, knip and size on push/PR; `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` opts runner JS actions into Node 24.
