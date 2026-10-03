/**
 * Build-time helper for the recovered site chrome.
 *
 * `scripts/etl/recover-chrome.py` saves what Wayback has archived for
 * `forg.co.kr/images/...` under `public/img/chrome/`, which is in git.
 * `chromeUrl` stops the build when a name is not there — a misspelt name,
 * or art that has to be recovered first — so a page never quietly loses a
 * picture. The few pieces Wayback never kept are asked for with
 * `optionalChrome`, and their callers draw without them.
 *
 * ## Why an asset has an era
 *
 * forg reused filenames as the site was redesigned, so the same path holds
 * different artwork at different dates. `t_b_kal.gif` read "Kal Ort Por" in
 * 2003 and "Hot Link" by 2007; `r_screen.gif` read "BestScreenShot" in 2003
 * and "Last Expansion Pack" later. An unbounded recovery takes the newest
 * capture, which put 2007 and 2014 artwork into the 2003 exhibit.
 *
 * `recover-chrome.py --era <era>` writes era-bounded captures into
 * `public/img/chrome/<era>/`, and `chromeUrl(file, era)` prefers those. When
 * an era has no capture of its own we fall back to the flat pool rather than
 * dropping the asset: a period-adjacent image beats an empty box.
 *
 * Resolution happens at module load (Server Component build phase), so the
 * lookup is O(1) at render time and a build picks up newly-recovered assets.
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { CSSProperties } from "react";

import { ERAS, type Era } from "@/lib/era";

const CHROME_ROOT = join(process.cwd(), "public", "img", "chrome");

function readPool(dir: string): ReadonlySet<string> {
  try {
    return new Set(
      readdirSync(dir)
        .filter((name) => !name.startsWith("."))
        .filter((name) => {
          try {
            const stat = statSync(join(dir, name));
            return stat.isFile() && stat.size > 0;
          } catch {
            return false;
          }
        }),
    );
  } catch {
    return new Set<string>();
  }
}

/** Newest-capture pool. Also the fallback for any era. */
const RECOVERED = readPool(CHROME_ROOT);

/** One pool per era directory under `public/img/chrome/`. */
const ERA_POOLS: Readonly<Record<Era, ReadonlySet<string>>> = Object.fromEntries(
  ERAS.map((era) => [era, readPool(join(CHROME_ROOT, era))]),
) as Record<Era, ReadonlySet<string>>;

/**
 * URL for a recovered chrome asset; the build stops when it was never
 * recovered.
 *
 * Pass the era the surface belongs to so the exhibit wears its own decade's
 * artwork; omit it for anything era-neutral.
 */
export function chromeUrl(filename: string, era?: Era): string {
  const url = optionalChrome(filename, era);
  if (!url) {
    throw new Error(
      `chrome: ${filename}${era ? ` (${era})` : ""} is not in public/img/chrome/ — recover it or use optionalChrome`,
    );
  }
  return url;
}

/**
 * For art Wayback never kept — the 2014 menu's hover images, the 2003
 * English BGM button: its URL, or null and the caller draws without it.
 */
export function optionalChrome(filename: string, era?: Era): string | null {
  if (era && ERA_POOLS[era].has(filename)) {
    return `/img/chrome/${era}/${filename}`;
  }
  return RECOVERED.has(filename) ? `/img/chrome/${filename}` : null;
}

type Repeat = "repeat" | "repeat-x" | "repeat-y" | "no-repeat";

/**
 * `style` for recovered art used as a CSS background (the originals'
 * `background=` cells and tiled strips), or none for no picture, and the
 * element keeps its colour. An absent repeat or position
 * is left out, not set to `undefined`: the RSC payload writes `$undefined`
 * for every such key (1.4 KB more on a post page).
 */
export function tileStyle(
  url: string | null,
  repeat?: Repeat,
  position?: string,
): CSSProperties | undefined {
  if (!url) return undefined;
  return {
    backgroundImage: `url(${url})`,
    ...(repeat && { backgroundRepeat: repeat }),
    ...(position && { backgroundPosition: position }),
  };
}
