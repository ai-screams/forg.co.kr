/**
 * The rules of a stylesheet in `src/styles/`, for the tests that check what
 * the stylesheets say (`eras.test.ts`, `era-2026.test.ts`): each rule's selectors, the at-rules
 * around it and its own declarations. A rule nested in another
 * (`@variant frame { … }` inside `.forg-shell { … }`) is read under the
 * outer rule's selectors, as the browser applies it.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

interface CssRule {
  /** The selector list; a comma inside `:not(…)` or `:is(…)` does not split it. */
  selectors: string[];
  /** The at-rules it sits in, outermost first (`@layer museum`, `@media (…)`). */
  at: string[];
  /** Its own declarations, not those of the rules nested in it. */
  body: string;
}

export function cssRules(file: string): CssRule[] {
  const css = readFileSync(path.join(process.cwd(), "src", "styles", file), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const rules: CssRule[] = [];
  const open: CssRule[] = [];
  let text = "";
  for (const ch of css) {
    if (ch === "{") {
      // Declarations before a nested block are the outer rule's.
      const cut = text.lastIndexOf(";") + 1;
      const outer = open.at(-1);
      if (outer) outer.body += text.slice(0, cut);
      const prelude = text.slice(cut).trim();
      const selectors = outer?.selectors ?? [];
      const at = outer?.at ?? [];
      open.push(
        prelude.startsWith("@")
          ? { selectors, at: [...at, prelude], body: "" }
          : { selectors: nest(selectors, split(prelude)), at, body: "" },
      );
      text = "";
    } else if (ch === "}") {
      const rule = open.pop();
      if (rule) {
        rule.body += text;
        rules.push(rule);
      }
      text = "";
    } else {
      text += ch;
    }
  }
  return rules;
}

function split(list: string): string[] {
  return list.split(/,(?![^(]*\))/).map((s) => s.trim());
}

/**
 * A selector nested in a rule, as a descendant of it. `&` is not read: no
 * stylesheet here uses it (`grep -n "&" src/styles/*.css`, 2026-10-20).
 */
function nest(outer: string[], inner: string[]): string[] {
  if (outer.length === 0) return inner;
  return outer.flatMap((o) => inner.map((i) => `${o} ${i}`));
}
