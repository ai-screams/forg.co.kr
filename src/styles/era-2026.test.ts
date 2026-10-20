import { describe, expect, it } from "vitest";

import { cssRules } from "@/styles/css-rules";

// The 2026 frame's colours as era-2026.css sets them, light and dark.

const DARK = "@media (prefers-color-scheme: dark)";
const ERA_2026 = ':root[data-era="2026"]';

const RULES = cssRules("era-2026.css");
/** The style rules in the dark theme's media query (not the query itself). */
const DARK_RULES = RULES.filter((r) => r.at.includes(DARK) && r.selectors.length > 0);

/** `--name: value` pairs of these rules, later ones winning. */
function declarations(rules: typeof RULES): Map<string, string> {
  return new Map(
    rules.flatMap((r) =>
      [...r.body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m): [string, string] => [
        m[1] ?? "",
        (m[2] ?? "").trim(),
      ]),
    ),
  );
}

const THEME = declarations(cssRules("tokens.css").filter((r) => r.at.includes("@theme")));
const LIGHT = declarations(
  RULES.filter((r) => r.selectors.includes(ERA_2026) && !r.at.includes(DARK)),
);
const THEMES = {
  light: new Map([...THEME, ...LIGHT]),
  dark: new Map([...THEME, ...LIGHT, ...declarations(DARK_RULES)]),
};

/** WCAG relative luminance of an `oklch(L C h)` colour, through linear sRGB. */
function luminance(colour: string): number {
  const m = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(colour);
  if (!m) throw new Error(`not an opaque oklch(): ${colour}`);
  const [L, C, h] = [m[1], m[2], m[3]].map(Number) as [number, number, number];
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(Math.max(x, 0), 1);
  const red = clamp(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s);
  const green = clamp(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s);
  const blue = clamp(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(theme: Map<string, string>, fg: string, bg: string): number {
  const value = (name: string) => {
    const v = theme.get(name);
    if (v === undefined) throw new Error(`${name} is not set`);
    return luminance(v);
  };
  const [x, y] = [value(fg), value(bg)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

// Text 4.5:1, a rail or a field's border 3:1 (WCAG 1.4.3, 1.4.11).
const PAIRS: [fg: string, bg: string, min: number][] = [
  ["--w26-ink", "--w26-surface", 4.5],
  ["--w26-muted", "--w26-surface", 4.5],
  ["--w26-muted", "--w26-bg", 4.5],
  ["--w26-bar-ink", "--w26-bar", 4.5],
  ["--color-forg-gold", "--w26-bar", 4.5],
  ["--w26-on-gold", "--color-forg-gold", 4.5],
  ["--w26-soft-ink", "--w26-soft", 4.5],
  ["--w26-rec", "--w26-surface", 4.5],
  ["--w26-rec-rail", "--w26-surface", 3],
  ["--w26-input-line", "--w26-surface", 3],
];

describe("2026 colours", () => {
  // Fails if: a pair drops below its ratio in either theme (the dark
  // `--w26-muted` set to the light one's #5E6B7B, 2.7:1 on the dark card).
  it.each(["light", "dark"] as const)("read in the %s theme", (theme) => {
    const low = PAIRS.map(([fg, bg, min]) => ({
      fg,
      bg,
      min,
      ratio: contrast(THEMES[theme], fg, bg),
    }))
      .filter((p) => p.ratio < p.min)
      .map((p) => `${p.fg} on ${p.bg}: ${p.ratio.toFixed(2)} < ${p.min}`);
    expect(low).toEqual([]);
  });

  // Fails if: the dark values reach beyond 2026 (the block on `:root`), or
  // the dark theme darkens a museum token such as `--era-content-bg`, whose
  // bar keeps text colours that are the same in every era.
  it("turns dark only the 2026 frame's own tokens", () => {
    expect(DARK_RULES).toHaveLength(1);
    for (const rule of DARK_RULES) {
      expect(rule.selectors).toEqual([ERA_2026]);
      const names = [...rule.body.matchAll(/([\w-]+):/g)].map((m) => m[1]);
      expect(names.filter((n) => !n?.startsWith("--w26-") && n !== "color-scheme")).toEqual([]);
    }
  });
});
