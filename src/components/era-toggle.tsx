import { DEFAULT_ERA, ERA_LABELS, ERAS } from "@/lib/era";

/**
 * 2014 · 2003 · 2001 시기를 즉시 전환하는 토글.
 *
 * Server markup only: content pages ship no React runtime
 * (`scripts/postbuild/strip-react-runtime.mjs`), so the era script the
 * layout inlines (`src/app/_scripts/era.js`) presses the button matching
 * `<html data-era>`, switches and saves the era on a click and follows
 * another tab's change. It runs before the buttons exist, so no click is lost.
 *
 * 눌린 버튼의 색은 `src/styles/eras.css`의 `data-era` 규칙이 칠한다. 스크립트가
 * 돌기 전(SSR 상태는 늘 2014)에도 저장된 시기가 켜져 보이게 하기 위해서다.
 * `aria-pressed` is the script's to set, so React leaves it alone where it
 * still hydrates (the search page, `pnpm dev`): `suppressHydrationWarning`.
 */
export function EraToggle() {
  return (
    <div
      role="group"
      aria-label="디자인 시기 전환"
      className="inline-flex items-center gap-1 rounded-full border border-(--era-input-border) bg-(--era-content-bg) px-2 py-1 text-xs"
    >
      {/* Three eras and the search link share a 375px phone's header row. */}
      <span className="px-1 font-mono text-forg-ghost uppercase max-[399px]:hidden">era</span>
      {ERAS.map((candidate) => (
        <button
          key={candidate}
          type="button"
          aria-pressed={candidate === DEFAULT_ERA}
          data-era-option={candidate}
          suppressHydrationWarning
          className="min-w-11 rounded-full px-2 py-0.5 font-mono text-xs text-forg-muted transition-colors hover:bg-forg-cream hover:text-forg-ink sm:min-w-12"
        >
          {ERA_LABELS[candidate]}
        </button>
      ))}
    </div>
  );
}
