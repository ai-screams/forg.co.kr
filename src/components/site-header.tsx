/**
 * Top-of-page chrome shared by every route.
 *
 * Server-rendered, era-invariant markup. The only client island is the
 * embedded `<EraToggle>`. All visual differences between the eras
 * come from the `:root[data-era]` CSS variables in `src/styles/eras.css`.
 */

import type { ReactNode } from "react";

import Link from "@/components/link";

import { EraToggle } from "@/components/era-toggle";

/**
 * `crumb` follows "디지털 박물관" on the second line: a board list's name
 * and (i) (`components/board-info.tsx`), or nothing. On a phone the board's
 * name takes the line (base.css).
 */
export function SiteHeader({ crumb }: { crumb?: ReactNode }) {
  return (
    <header role="banner" className="border-b border-(--era-input-border) bg-(--era-content-bg)">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6">
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
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <Link
            href="/search"
            className="text-sm whitespace-nowrap text-forg-muted hover:text-(--era-link-hover)"
            aria-label="검색"
          >
            검색
          </Link>
          <EraToggle />
        </div>
      </div>
    </header>
  );
}
