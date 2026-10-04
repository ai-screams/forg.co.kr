/**
 * The frame every exhibit sits in — five columns in 2014 and 2003, one centred column in 2001.
 *
 *   ┌─slate─┬─10─┬─100─┬──────────680──────────┬─7─┬─slate─┐
 *   │       │rail│side │ header (53px)         │   │       │
 *   │       │    │bar  │ content               │   │       │
 *   │       │    │     │ counter / bgm (24px)  │   │       │
 *   └───────┴────┴─────┴───────────────────────┴───┴───────┘
 *
 * The geometry is era-invariant: `frameset cols="10, 100, 680, 7, 1*"` is
 * character-identical across the 2003, 2007 and 2010 captures, and
 * 2014-12-18 reproduces the same numbers as a `<table>`. Only the chrome
 * inside those columns differs, so one shell serves every era and the CSS
 * in `src/styles/eras.css` (`.era-2014-only` / `.era-2003-only` / `.era-2001-only`)
 * picks which chrome is visible. 2001 (ADR-0019) had no side columns: `.era-not-2001` hides
 * them, and `eras.css` centres a 790px content column under the 2001 top
 * frame.
 *
 * The originals put the frame at the left and filled the rest (`1*`) with
 * slate, where a 2014 AdSense unit sat. The museum centres the frame in every
 * era, with the slate on both sides (`.forg-shell` in `eras.css`).
 *
 * The fixed columns appear from 800px, where 10 + 100 + 680 + 7 = 797 fits.
 * Below that the rails and sidebar are dropped and the 680 column takes the
 * whole width; at `sm` (640px) the full frame ran a 768px tablet off-screen.
 *
 * Content is rendered **once**. Board and post routes pass `children`;
 * the home passes `content2014` / `content2003` / `content2001` because its exhibit
 * genuinely differs per era. Duplicating a post body per era would double
 * the HTML of 14,218 post pages for nothing.
 */

import type { ReactNode } from "react";

import { LeftRail, RightRail } from "@/components/chrome-primitives";
import { FrameTop2001 } from "@/components/era-chrome-2001";
import { FrameBottom2003, FrameLeft2003, FrameTop2003 } from "@/components/era-chrome-2003";
import { FrameBottom2014, FrameLeft2014, FrameTop2014 } from "@/components/era-chrome-2014";

interface EraShellProps {
  /** Rendered in every era. Ignored when the per-era contents are set. */
  children?: ReactNode;
  content2014?: ReactNode;
  content2003?: ReactNode;
  content2001?: ReactNode;
}

export function EraShell({ children, content2014, content2003, content2001 }: EraShellProps) {
  const splitContent =
    content2014 !== undefined || content2003 !== undefined || content2001 !== undefined;

  return (
    <div className="flex flex-1 bg-(--era-page-bg)">
      <div className="forg-shell flex w-full gap-0">
        <div className="era-not-2001 contents">
          <LeftRail />
        </div>

        <div className="era-2014-only contents">
          <FrameLeft2014 />
        </div>
        <div className="era-2003-only contents">
          <FrameLeft2003 />
        </div>

        {/* The right rail comes before the main column in the HTML and is put
            last by `order`. The browser paints before the whole page has
            arrived, and a rail parsed after the content widened the centred
            frame by 7px when it came, moving the frame 3.5px left. */}
        <div className="era-not-2001 contents *:order-last">
          <RightRail />
        </div>

        {/* Inside the layout's <main>, which also holds the search page and the 404. */}
        <div className="forg-shell-main flex w-full flex-col bg-(--era-content-bg) frame:w-[680px] frame:shrink-0">
          <div className="era-2014-only">
            <FrameTop2014 />
          </div>
          <div className="era-2003-only">
            <FrameTop2003 />
          </div>
          <div className="era-2001-only">
            <FrameTop2001 />
          </div>

          {splitContent ? (
            <>
              <div className="era-2014-only grow">{content2014}</div>
              <div className="era-2003-only grow">{content2003}</div>
              <div className="era-2001-only grow">{content2001}</div>
            </>
          ) : (
            <div className="grow">{children}</div>
          )}

          <div className="era-2014-only">
            <FrameBottom2014 />
          </div>
          <div className="era-2003-only">
            <FrameBottom2003 />
          </div>
        </div>
      </div>
    </div>
  );
}
