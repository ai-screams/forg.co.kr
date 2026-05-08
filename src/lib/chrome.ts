/**
 * Build-time helper for the 2014 main page chrome assets.
 *
 * `scripts/etl/recover-chrome.py` recovers what Wayback has archived for
 * `forg.co.kr/images/...` and saves it under `public/img/chrome/`. Many
 * assets are missing from Wayback's index — when one of those is missing
 * the React UI degrades to a museum-toned CSS / typography fallback so
 * the layout never shows a broken-image icon.
 *
 * Resolution happens at module load (Server Component build phase). The
 * `chromeExists` lookup is therefore O(1) at render time and the build
 * picks up newly-recovered assets on the next `pnpm build`.
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CHROME_ROOT = join(process.cwd(), "public", "img", "chrome");

const RECOVERED: ReadonlySet<string> = (() => {
  try {
    return new Set(
      readdirSync(CHROME_ROOT)
        .filter((name) => !name.startsWith("."))
        .filter((name) => {
          try {
            return statSync(join(CHROME_ROOT, name)).size > 0;
          } catch {
            return false;
          }
        }),
    );
  } catch {
    return new Set<string>();
  }
})();

/** True when `public/img/chrome/{filename}` exists and is non-empty. */
export function chromeExists(filename: string): boolean {
  return RECOVERED.has(filename);
}

/** Return the chrome URL if recovered, otherwise null. Use the null path
 *  to render a CSS / SVG fallback. */
export function chromeUrl(filename: string): string | null {
  return RECOVERED.has(filename) ? `/img/chrome/${filename}` : null;
}

/** All recovered chrome filenames — useful for diagnostic / debug routes. */
export function listRecoveredChrome(): string[] {
  return [...RECOVERED].sort();
}
