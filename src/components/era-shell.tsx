/**
 * The frame every exhibit sits in — five columns, both eras.
 *
 *   ┌─10─┬─100─┬──────────680──────────┬─7─┬────*────┐
 *   │rail│side │ header (53px)         │   │ slate   │
 *   │    │bar  │ content               │   │ (ad col)│
 *   │    │     │ counter / bgm (24px)  │   │         │
 *   └────┴─────┴───────────────────────┴───┴─────────┘
 *
 * The geometry is era-invariant: `frameset cols="10, 100, 680, 7, 1*"` is
 * character-identical across the 2003, 2007 and 2010 captures, and
 * 2014-12-18 reproduces the same numbers as a `<table>`. Only the chrome
 * inside those columns differs, so one shell serves both eras and the CSS
 * in globals.css (`.era-2014-only` / `.era-2003-only`) picks which chrome
 * is visible.
 *
 * The fixed columns appear from 800px, where 10 + 100 + 680 + 7 = 797 fits.
 * Below that the rails and sidebar are dropped and the 680 column takes the
 * whole width; at `sm` (640px) the full frame ran a 768px tablet off-screen.
 *
 * Content is rendered **once**. Board and post routes pass `children`;
 * the home passes `content2014` / `content2003` because its exhibit
 * genuinely differs per era. Duplicating a post body per era would double
 * the HTML of 13,290 pages for nothing.
 */

import type { ReactNode } from "react";

import {
  AdSenseColumn,
  GameCategorySidebar,
  LeftRail,
  RightRail,
  SiteHeader2014,
  TOTAL_VISITORS,
  VisitorCounter,
} from "@/components/era-chrome-2014";
import { FrameBottom2003, FrameLeft2003, FrameTop2003 } from "@/components/home-2003";

interface EraShellProps {
  /** Rendered in both eras. Ignored when `content2014`/`content2003` are set. */
  children?: ReactNode;
  content2014?: ReactNode;
  content2003?: ReactNode;
}

export function EraShell({ children, content2014, content2003 }: EraShellProps) {
  const splitContent = content2014 !== undefined || content2003 !== undefined;

  return (
    <div className="flex flex-1 bg-(--era-page-bg)">
      <div className="forg-2014-shell flex w-full gap-0">
        <LeftRail />

        <div className="era-2014-only contents">
          <GameCategorySidebar />
        </div>
        <div className="era-2003-only contents">
          <FrameLeft2003 />
        </div>

        <main className="flex w-full flex-col bg-(--era-content-bg) min-[800px]:w-[680px] min-[800px]:shrink-0">
          <div className="era-2014-only">
            <SiteHeader2014 />
          </div>
          <div className="era-2003-only">
            <FrameTop2003 />
          </div>

          {splitContent ? (
            <>
              <div className="era-2014-only grow">{content2014}</div>
              <div className="era-2003-only grow">{content2003}</div>
            </>
          ) : (
            <div className="grow">{children}</div>
          )}

          <div className="era-2014-only">
            <VisitorCounter total={TOTAL_VISITORS} />
          </div>
          <div className="era-2003-only">
            <FrameBottom2003 />
          </div>
        </main>

        <RightRail />
        <AdSenseColumn />
      </div>
    </div>
  );
}
