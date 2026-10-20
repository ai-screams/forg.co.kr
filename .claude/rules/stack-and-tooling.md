# Stack versions and quality tooling

## Versions (they matter)

- **Next.js 16.x**, App Router, Turbopack, `output: "export"`. `turbopack.root` uses `import.meta.dirname`. `next lint` is gone — use `eslint`.
- **React 19.x** — server components by default, no `forwardRef`.
- **TypeScript 6.x** — strict + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, …; `@total-typescript/ts-reset` (`src/types/reset.d.ts`) makes `JSON.parse` return `unknown`.
- **Tailwind v4** CSS-first: no `tailwind.config.js`, tokens in `@theme`. The class-sort Prettier plugin must come **after** `prettier-plugin-organize-imports`.
- **ESLint 9.x** — held until `eslint-config-next@17` supports 10.
- **`@types/node` 25.x** matches the `ts6.0` dist-tag; don't downgrade for Node 24 LTS.
- **pnpm 10.33.x** pinned in `packageManager` (needed by `pnpm/action-setup@v4`).
- **One Pages Function** (`functions/[[path]].ts`, ADR-0022): Cloudflare compiles `functions/` itself at deploy; the build's `out/_routes.json` keeps every museum path static. It imports `src/lib/old-urls.ts` by a relative path (no `@/` alias there). TypeScript checks it (`tsconfig` includes `**/*.ts`); knip has it as an entry. Try it locally with `pnpm dlx wrangler@4 pages dev out` after a build.
- **The 2026 fonts are committed files**, not `next/font`, which would put their `@font-face` rules in every era's stylesheet: `public/fonts/2026/` holds Google's unicode-range slices (IBM Plex Sans KR renamed Forg Sans KR, Do Hyeon), Forg Digits and `2026.css`, which the era script links only in 2026. `scripts/dev/subset-digits-font.sh` then `scripts/dev/fetch-fonts-2026.mjs` remake them (uv and fonttools); the build reaches no font service.
- **Pagefind pinned 1.4.0.** 1.5.x keys words without diacritics and leaves composed Hangul in `additional_variants`, which its chunker does not count, so every Korean word lands in one 17.9 MB index chunk (CloudCannon/pagefind#1211, fixed by #1316, unreleased on 2026-10-03). Move up once a release carries #1316 and the Hangul range splits.

## Hooks and CI

- pre-commit: `lint-staged` (eslint --fix, prettier, secretlint; markdownlint on `.md`). Hook scripts source `~/.nvm/nvm.sh`; copy that prelude into any new hook.
- commit-msg: commitlint, Conventional Commits, header ≤100, body line ≤120.
- pre-push: `pnpm typecheck && pnpm lint`.
- Tests: `pnpm test` (Vitest, `src/**/*.test.ts`, node environment, `@/` alias in `vitest.config.mts`).
- The postbuild ends with `scripts/postbuild/check-page-weight.mjs`: a 2026 bar over 3,072 bytes, 2026 notes over their page kind's limit (a post 1,024, a list 2,048, the front page 10,240, others 512) or a deploy over 19,500 files fails the build, and so the Pages deploy; sample pages that outgrow main's bytes plus 2026's share only warn. Its sample bases are main c789b673a's (2026-10-20); rebuild main to move them.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, format and knip on push/PR. It does not build: Cloudflare Pages builds every push (its PR check), and the build on the 2-core runner hit the job limit. Run `pnpm build` and `pnpm size` locally before a PR that changes pages or bundles; `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` opts runner JS actions into Node 24.
