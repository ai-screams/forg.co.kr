/**
 * Build-time helper for the recovered site chrome.
 *
 * `scripts/etl/recover-chrome.py` saves what Wayback has archived for
 * `forg.co.kr/images/...` under `public/img/chrome/`. Some assets are missing
 * from Wayback's index — when one of those is missing the React UI degrades
 * to a museum-toned CSS / typography fallback so the layout never shows a
 * broken-image icon.
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
 * dropping the asset: a period-adjacent image beats an empty box, and the
 * fallback is visible in `chromeEraOf()` for anyone auditing it.
 *
 * Resolution happens at module load (Server Component build phase), so the
 * lookup is O(1) at render time and a build picks up newly-recovered assets.
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CHROME_ROOT = join(process.cwd(), "public", "img", "chrome");

/** Era directories under `public/img/chrome/`. Order is irrelevant; lookup
 *  is always by the era the caller asks for. */
const ERA_DIRS = ["2003", "2014"] as const;
export type ChromeEra = (typeof ERA_DIRS)[number];

function readPool(dir: string): ReadonlySet<string> {
  try {
    return new Set(
      readdirSync(dir)
        .filter((name) => !name.startsWith("."))
        .filter((name) => {
          try {
            return statSync(join(dir, name)).isFile() && statSync(join(dir, name)).size > 0;
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

const ERA_POOLS: Readonly<Record<ChromeEra, ReadonlySet<string>>> = Object.fromEntries(
  ERA_DIRS.map((era) => [era, readPool(join(CHROME_ROOT, era))]),
) as Record<ChromeEra, ReadonlySet<string>>;

/** True when the asset exists in the flat (newest-capture) pool. */
export function chromeExists(filename: string): boolean {
  return RECOVERED.has(filename);
}

/**
 * URL for a recovered chrome asset, or null when nothing was recovered.
 *
 * Pass the era the surface belongs to so the exhibit wears its own decade's
 * artwork; omit it for anything era-neutral.
 */
export function chromeUrl(filename: string, era?: ChromeEra): string | null {
  if (era && ERA_POOLS[era].has(filename)) {
    return `/img/chrome/${era}/${filename}`;
  }
  return RECOVERED.has(filename) ? `/img/chrome/${filename}` : null;
}

/**
 * Which pool `chromeUrl(filename, era)` would resolve from: the era itself,
 * `"fallback"` when the era has no capture and the flat pool answers, or
 * `null` when nothing was recovered. For audits, not for rendering.
 */
export function chromeEraOf(filename: string, era?: ChromeEra): ChromeEra | "fallback" | null {
  if (era && ERA_POOLS[era].has(filename)) return era;
  return RECOVERED.has(filename) ? "fallback" : null;
}

/** All recovered chrome filenames — useful for diagnostic / debug routes. */
export function listRecoveredChrome(): string[] {
  return [...RECOVERED].sort();
}
