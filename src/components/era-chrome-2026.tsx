/**
 * The 2026 frame's bar (ADR-0023): the museum's own design, not a capture.
 * From 640px it is a dark bar under a 4px gold rule with the "forg"
 * wordmark and the menu, below the museum bar. On a phone it is the one bar
 * at the top: the wordmark, where you are, and the eras and the menu folded
 * into `<details>`, so they work without a script (as `MobileMenu`); the
 * museum bar hides there (`src/styles/era-2026.css`). The era buttons work
 * like `<EraToggle>`'s: the era script presses and switches every
 * `button[data-era-option]`.
 *
 * Every page carries it, hidden in the other eras, so its looks are in
 * era-2026.css and the markup stays small; `data-era-frame="2026"` marks it
 * for the page-weight check.
 */

import Link from "@/components/link";

import { DEFAULT_ERA, ERA_LABELS, ERAS } from "@/lib/era";
import { MENU_2026 } from "@/lib/era-menus";

export function FrameTop2026() {
  const links = MENU_2026.map((item) => (
    <Link key={item.href} href={item.href}>
      {item.label}
    </Link>
  ));
  return (
    <div data-era-frame="2026" className="w26-top">
      <Link href="/" aria-label="forg — 처음으로" className="w26-word">
        forg
      </Link>
      <nav aria-label="2026 메뉴" className="w26-nav">
        {links}
      </nav>
      <span className="w26-place">디지털 박물관</span>
      <details name="w26" className="w26-pop">
        <summary>
          ERA <b>2026</b>
        </summary>
        <div role="group" aria-label="디자인 시기 전환">
          {ERAS.map((era) => (
            <button
              key={era}
              type="button"
              aria-pressed={era === DEFAULT_ERA}
              data-era-option={era}
              suppressHydrationWarning
            >
              {ERA_LABELS[era]}
            </button>
          ))}
        </div>
      </details>
      <details name="w26" className="w26-pop">
        <summary>메뉴</summary>
        <nav aria-label="2026 메뉴">{links}</nav>
      </details>
    </div>
  );
}
