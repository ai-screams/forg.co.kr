import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ERAS } from "@/lib/era";
import { cssRules } from "@/styles/css-rules";

// The era rules as the stylesheets write them: each era sets every token,
// has its own visibility and pressed-button rules, and a part of the frame is
// shown in the eras listed for it, so an era added later inherits nothing.

const SRC = path.join(process.cwd(), "src");

const ALL = readdirSync(path.join(SRC, "styles"))
  .filter((f) => f.endsWith(".css"))
  .flatMap(cssRules);

/** Selectors of the rules that hide what they select. */
const HIDING = ALL.filter((r) => /display:\s*none/.test(r.body)).flatMap((r) => r.selectors);

/** The `--era-*` tokens that rules with exactly this selector set in eras.css. */
function tokens(selector: string): string[] {
  const names = cssRules("eras.css")
    .filter((r) => r.selectors.includes(selector))
    .flatMap((r) => [...r.body.matchAll(/(--era-[\w-]+):/g)].map((m) => m[1] ?? ""));
  return [...new Set(names)].sort();
}

/** The eras listed in the one rule that hides `.part` outside them. */
function shownIn(part: string): string[] {
  const lists = HIDING.filter((s) => new RegExp(`\\.${part}(?![\\w-])`).test(s)).map((s) =>
    [...(/^:root:not\(([^)]*)\)/.exec(s)?.[1] ?? "").matchAll(/data-era="(\d+)"/g)]
      .map((m) => m[1] ?? "")
      .sort(),
  );
  expect(lists).toHaveLength(1);
  return lists[0] ?? [];
}

/** Code under `src/`, the generated content left out. */
function codeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return file === path.join(SRC, "content") ? [] : codeFiles(file);
    return /\.(tsx?|m?js|css|md)$/.test(entry.name) ? [file] : [];
  });
}

describe("era rules", () => {
  // Fails if: era-shell.tsx gets back its class named for the era that hides
  // the rails (spelled in two parts here so this file does not match itself).
  it("names no era to hide in by a class", () => {
    const negative = "era-" + "not-";
    const files = codeFiles(SRC).filter((f) => readFileSync(f, "utf8").includes(negative));
    expect(files.map((f) => path.relative(process.cwd(), f))).toEqual([]);
  });

  // Fails if: a part is hidden by naming the era it hides in,
  // `:root[data-era="2001"] .forg-rail { display: none }`, also from a
  // `@variant frame { display: none }` nested in such a rule.
  it("hides a part by listing the eras that show it", () => {
    const eraHiding = HIDING.filter((s) => s.includes("data-era"));
    expect(eraHiding.length).toBeGreaterThan(0);
    expect(eraHiding.filter((s) => !s.startsWith(":root:not("))).toEqual([]);
  });

  // Fails if: an era's block leaves out a token (2001 without `--era-meta-fg`),
  // which it would then take from 2014 on `:root`.
  it.each(ERAS)("sets every --era-* token in %s", (era) => {
    const base = tokens(":root");
    expect(base.length).toBeGreaterThan(0);
    expect(tokens(`:root[data-era="${era}"]`)).toEqual(base);
  });

  // Fails if: an era has no pressed colour for its button (2001's rule
  // dropped), or no rule hiding its `.era-…-only` markup elsewhere.
  it.each(ERAS)("shows %s's own markup and lights its button", (era) => {
    expect(HIDING).toContain(`:root:not([data-era="${era}"]) .era-${era}-only`);
    const pressed = ALL.filter((r) =>
      r.selectors.includes(`:root[data-era="${era}"] [data-era-option="${era}"]`),
    );
    expect(pressed.map((r) => /background-color:/.test(r.body))).toEqual([true]);
  });

  // Fails if: the rails or the skin's list table show in an era beyond 2014
  // and 2003 (2001 added to their list), the post head or the skin's
  // comments lose one (2026 dropped from theirs), or the museum bar's (i)
  // shows in 2026, whose frame holds the board's notes.
  it("shows each part of the frame in the eras listed for it", () => {
    expect(shownIn("forg-rail")).toEqual(["2003", "2014"]);
    expect(shownIn("forg-skin-table")).toEqual(["2003", "2014"]);
    expect(shownIn("forg-post-head")).toEqual(["2003", "2014", "2026"]);
    expect(shownIn("forg-post-comments")).toEqual(["2003", "2014", "2026"]);
    expect(shownIn("forg-crumb-info")).toEqual(["2001", "2003", "2014"]);
    expect(
      HIDING.filter((s) => s.includes("#forg-board-info") && s.startsWith(":root:not(")),
    ).toEqual([
      ':root:not([data-era="2014"], [data-era="2003"], [data-era="2001"]) :is(.forg-crumb-info, #forg-board-info)',
    ]);
  });

  // Fails if: the board's name over its list or the count over a post's
  // comments shows in an era but 2026, or is hidden from screen readers
  // there (the rule turned to display: none).
  it("keeps the 2026-only headings for screen readers in the other eras", () => {
    const rule = ALL.filter((r) =>
      r.selectors.includes(':root:not([data-era="2026"]) .forg-sr-except-2026'),
    );
    expect(rule).toHaveLength(1);
    expect(rule[0]?.body).toMatch(/position:\s*absolute;/);
    expect(rule[0]?.body).toMatch(/clip-path:\s*inset\(50%\);/);
    expect(rule[0]?.body).not.toMatch(/display:\s*none/);
  });
});
