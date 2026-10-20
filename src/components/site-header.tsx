/**
 * Top-of-page chrome shared by every route.
 *
 * Server-rendered, era-invariant markup. The only client island is the
 * embedded `<EraToggle>`. All visual differences between the eras
 * come from the `:root[data-era]` CSS variables in `src/styles/eras.css`.
 */

import type { ReactNode } from "react";

import Link from "@/components/link";

import { EraFold, EraHint, EraToggle } from "@/components/era-toggle";

/**
 * `crumb` follows "디지털 박물관" on the second line: a board list's name
 * and (i) (`components/board-info.tsx`), or nothing. On a phone the board's
 * name takes the line (base.css).
 */
export function SiteHeader({ crumb }: { crumb?: ReactNode }) {
  return (
    <header role="banner" className="border-b border-(--era-input-border) bg-(--era-content-bg)">
      <div className="relative mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 flex-col font-forg leading-tight">
          <Link
            href="/"
            aria-label="forg.co.kr 디지털 박물관 — 처음으로"
            className="text-lg font-bold tracking-tight text-forg-ink"
          >
            forg.co.kr
          </Link>
          <div className="forg-crumb-line flex min-w-0 items-center gap-1 text-xs text-forg-muted">
            <span className="forg-museum">디지털 박물관</span>
            {crumb}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 max-[410px]:gap-2 sm:gap-4">
          {/* Below 410px "검색" is a magnifier, its word kept for screen
              readers: beside four era buttons the word ran into "forg.co.kr".
              The box is 28px wide and its ::before widens the target to 44px,
              into the gaps on either side. */}
          <Link
            href="/search"
            className="text-sm whitespace-nowrap text-forg-muted hover:text-(--era-link-hover) max-[410px]:relative max-[410px]:flex max-[410px]:h-11 max-[410px]:w-7 max-[410px]:items-center max-[410px]:justify-center max-[410px]:before:absolute max-[410px]:before:-inset-x-2 max-[410px]:before:inset-y-0"
          >
            <svg
              aria-hidden
              focusable="false"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="size-5 min-[410px]:hidden"
            >
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4.5 4.5" />
            </svg>
            <span className="max-[410px]:sr-only">검색</span>
          </Link>
          <EraToggle />
          <EraFold />
        </div>
        <EraHint />
      </div>
    </header>
  );
}
