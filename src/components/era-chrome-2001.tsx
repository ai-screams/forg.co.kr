/**
 * 2001-era chrome (ADR-0019): forg_t, the top frame — the banner and the
 * 14-button menu — worn by every route through `<EraShell>`. The frameset
 * and the front page it sat over are described in `home-2001.tsx`.
 */

import type { CSSProperties } from "react";

import Link from "@/components/link";

import { LazyImg } from "@/components/lazy-img";
import { chromeUrl } from "@/lib/chrome";
import type { Era } from "@/lib/era";
import { TOP_MENU_2001 } from "@/lib/era-menus";

const ERA: Era = "2001";

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: top — banner and the 14-button menu (forg_t.htm)               */
/* ────────────────────────────────────────────────────────────────────── */
export function FrameTop2001() {
  const right = chromeUrl("t_logo_r.gif", ERA);
  return (
    <header className="bg-white">
      {/* Below the frame width the banner keeps its art whole. Up to 475px,
          t_logo.gif at its size and, after it, the start of t_logo_r.gif
          (95px of plain marble before its copyright line) as background.
          From 476px both halves share the width, each scaled to half, so the
          copyright line is never cut off. */}
      <div
        className="flex bg-forg2001-page max-frame:bg-(image:--banner-right) max-frame:bg-[position:380px_0] max-frame:bg-no-repeat"
        style={{ "--banner-right": `url(${right})` } as CSSProperties}
      >
        <Link
          href="/"
          aria-label="forg.co.kr 메인"
          className="block max-frame:min-w-0 min-[476px]:max-frame:w-1/2"
        >
          <LazyImg
            src={chromeUrl("t_logo.gif", ERA)}
            alt="Ultima Online of Forg"
            width={380}
            height={35}
            className="block max-w-full min-[476px]:max-frame:w-full"
          />
        </Link>
        <LazyImg
          src={right}
          alt="All Contents Copyright(C) 1999. FORG.COM. All right reserved."
          width={410}
          height={35}
          className="block max-w-full max-frame:hidden min-[476px]:max-frame:block min-[476px]:max-frame:w-1/2"
        />
      </div>
      {/* `.forg2001-menu` (eras.css): below the frame width the buttons
          spread over the row in the buttons' own face. */}
      <nav aria-label="2001 상단 메뉴" className="forg2001-menu flex flex-wrap bg-forg2001-page">
        <LazyImg
          src={chromeUrl("t_l.gif", ERA)}
          alt=""
          width={10}
          height={20}
          className="block max-frame:hidden"
        />
        {TOP_MENU_2001.map((item) => (
          <Link key={item.asset} href={item.href}>
            <LazyImg
              src={chromeUrl(item.asset, ERA)}
              alt={item.label}
              title={item.label}
              width={55}
              height={20}
              className="block"
            />
          </Link>
        ))}
        <LazyImg
          src={chromeUrl("t_r.gif", ERA)}
          alt=""
          width={10}
          height={20}
          className="block max-frame:hidden"
        />
      </nav>
    </header>
  );
}
