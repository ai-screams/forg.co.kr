/**
 * Top-of-page chrome shared by every route.
 *
 * Server-rendered, era-invariant markup. The only client island is the
 * embedded `<EraToggle>`. All visual differences between the eras
 * come from the `:root[data-era]` CSS variables in `src/styles/eras.css`.
 */

import Link from "@/components/link";

import { EraToggle } from "@/components/era-toggle";

export function SiteHeader() {
  return (
    <header role="banner" className="border-b border-(--era-input-border) bg-(--era-content-bg)">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6">
        <Link
          href="/"
          aria-label="forg.co.kr 디지털 박물관 — 처음으로"
          className="flex flex-col font-forg leading-tight"
        >
          <span className="text-lg font-bold tracking-tight text-forg-ink">forg.co.kr</span>
          <span className="text-xs text-forg-muted">디지털 박물관</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/search"
            className="text-sm text-forg-muted hover:text-(--era-link-hover)"
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
