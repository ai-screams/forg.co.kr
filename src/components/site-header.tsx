/**
 * Top-of-page chrome shared by every route.
 *
 * Server-rendered, era-invariant markup. The only client island is the
 * embedded `<EraToggle>`. All visual differences between 2014 and 2003
 * come from the `:root[data-era]` CSS variables in `globals.css`.
 */

import Link from "next/link";

import { EraToggle } from "@/components/era-toggle";

export function SiteHeader() {
  return (
    <header role="banner" className="border-b border-(--era-input-border) bg-(--era-content-bg)">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          aria-label="forg.co.kr 디지털 박물관 — 처음으로"
          className="font-forg flex flex-col leading-tight"
        >
          <span className="text-forg-ink text-lg font-bold tracking-tight">forg.co.kr</span>
          <span className="text-forg-muted text-xs">디지털 박물관</span>
        </Link>
        <EraToggle />
      </div>
    </header>
  );
}
