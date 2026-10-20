import { DEFAULT_ERA, ERA_LABELS, ERAS } from "@/lib/era";

/**
 * 2026 · 2014 · 2003 · 2001 시기를 즉시 전환하는 토글.
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
      {/* Four eras and the search link share a 360px phone's header row with
          "forg.co.kr": the "era" label goes below 399px, and `<SiteHeader>`
          sets the search link 8px from the buttons below 640px. */}
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

/**
 * 첫 방문 안내: the note under the era buttons that the old looks are a click
 * away. Server markup, hidden (`.forg-era-hint`, `src/styles/base.css`) until
 * the era script, on a visitor's first page, sets `html.forg-era-hint-on`
 * before the page paints; its close button and the era buttons take it down
 * (`src/app/_scripts/era.js`). Placed by `<SiteHeader>`, whose row it hangs
 * from.
 */
export function EraHint() {
  return (
    <div
      role="note"
      className="forg-era-hint absolute top-[calc(100%-0.375rem)] right-4 z-40 w-[min(17rem,calc(100vw-2rem))] flex-col gap-1 rounded-md border border-forg-gold bg-forg-hint px-3 py-2.5 text-xs leading-relaxed text-forg-ink shadow-lg before:absolute before:-top-[7px] before:right-16 before:size-3 before:rotate-45 before:border-t before:border-l before:border-forg-gold before:bg-forg-hint sm:right-6"
    >
      <b className="text-[13px]">옛 모습으로 보기</b>
      <span>
        2003·2001을 누르면 그 시절 forg 모습으로 바뀝니다. 2026은 박물관이 새로 만든 모습입니다.
      </span>
      <button
        type="button"
        data-era-hint-close
        aria-label="안내 닫기"
        className="self-end rounded border border-forg-gold-hover bg-white px-2 text-forg-ink"
      >
        닫기
      </button>
    </div>
  );
}
