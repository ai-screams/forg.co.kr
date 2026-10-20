import { readFileSync } from "node:fs";
import path from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EraHint } from "@/components/era-toggle";
import { ERA_HINT_KEY, ERA_STORAGE_KEY, ERAS } from "@/lib/era";

// The era script as the layout inlines it, run against a stand-in page: only
// what it touches — the root's attributes and classes, the click and storage
// listeners, and localStorage.

const SOURCE = readFileSync(path.join(process.cwd(), "src", "app", "_scripts", "era.js"), "utf8");

class FakeElement {
  constructor(
    private readonly selectorPart: string,
    private readonly attrs: Record<string, string> = {},
  ) {}
  closest(selector: string): FakeElement | null {
    return selector.includes(this.selectorPart) ? this : null;
  }
  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }
}

function run(stored: Record<string, string> | "blocked", { pressed = true } = {}) {
  const focused: string[] = [];
  const classes = new Set<string>();
  const attrs = new Map<string, string>();
  const listeners: Record<string, (event: unknown) => void> = {};
  const store = new Map(Object.entries(stored === "blocked" ? {} : stored));
  const localStorage = {
    getItem(key: string) {
      if (stored === "blocked") throw new Error("blocked");
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (stored === "blocked") throw new Error("blocked");
      store.set(key, value);
    },
  };
  const root = {
    classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) },
    setAttribute: (k: string, v: string) => attrs.set(k, v),
    getAttribute: (k: string) => attrs.get(k) ?? null,
  };
  const document = {
    documentElement: root,
    readyState: "complete",
    querySelectorAll: () => [],
    querySelector: (selector: string) =>
      pressed && selector.includes('[aria-pressed="true"]')
        ? { focus: () => focused.push(selector) }
        : null,
    addEventListener: (type: string, fn: (event: unknown) => void) => (listeners[type] = fn),
  };
  const window = {
    addEventListener: (type: string, fn: (event: unknown) => void) =>
      (listeners[`window:${type}`] = fn),
  };
  new Function(
    "document",
    "window",
    "localStorage",
    "Element",
    "ERA_STORAGE_KEY",
    "ERAS",
    "ERA_HINT_KEY",
    SOURCE,
  )(document, window, localStorage, FakeElement, ERA_STORAGE_KEY, ERAS, ERA_HINT_KEY);
  return {
    era: () => attrs.get("data-era") ?? null,
    hinted: () => classes.has("forg-era-hint-on"),
    focused,
    store,
    click: (target: FakeElement) => listeners["click"]?.({ target }),
    otherTab: (key: string, newValue: string) => listeners["window:storage"]?.({ key, newValue }),
  };
}

// Fails if: the script does not know 2026 (left out of ERAS), or applies a
// saved value that is no era.
it("applies a saved 2026 and ignores a value that is no era", () => {
  expect(run({ [ERA_STORAGE_KEY]: "2026" }).era()).toBe("2026");
  expect(run({ [ERA_STORAGE_KEY]: "1999" }).era()).toBeNull();
});

const CLOSE = new FakeElement("[data-era-hint-close]");
const ERA_2003 = new FakeElement("button[data-era-option]", { "data-era-option": "2003" });

describe("the first-visit hint", () => {
  // Fails if: the hint shows to a visitor who already chose an era, shows
  // again on a later page, or never shows.
  it("shows on a visitor's first page only", () => {
    const first = run({});
    expect(first.hinted()).toBe(true);
    expect(first.store.get(ERA_HINT_KEY)).toBe("shown");
    expect(run(Object.fromEntries(first.store)).hinted()).toBe(false);
    expect(run({ [ERA_STORAGE_KEY]: "2014" }).hinted()).toBe(false);
  });

  // Fails if: without storage the hint shows, though it could not remember
  // being shown.
  it("stays hidden where storage is blocked", () => {
    expect(run("blocked").hinted()).toBe(false);
  });

  // Fails if: closing does not hide it, or leaves keyboard focus nowhere.
  it("closes from its button and hands focus back to the era buttons", () => {
    const page = run({});
    page.click(CLOSE);
    expect(page.hinted()).toBe(false);
    expect(page.focused).toEqual(['button[data-era-option][aria-pressed="true"]']);
    // Before the buttons are pressed (a click while the page still loads).
    const early = run({}, { pressed: false });
    expect(() => early.click(CLOSE)).not.toThrow();
    expect(early.hinted()).toBe(false);
  });

  // Fails if: choosing an era leaves the hint up.
  it("goes when an era is chosen", () => {
    const page = run({});
    page.click(ERA_2003);
    expect(page.hinted()).toBe(false);
    expect(page.store.get(ERA_STORAGE_KEY)).toBe("2003");
  });

  // Fails if: another tab's choice leaves this tab's hint up, or any other
  // key's change takes it down.
  it("goes when another tab chooses an era", () => {
    const chosen = run({});
    chosen.otherTab(ERA_STORAGE_KEY, "2001");
    expect(chosen.hinted()).toBe(false);
    const other = run({});
    other.otherTab("something-else", "1");
    expect(other.hinted()).toBe(true);
  });
});

// Fails if: the hint's markup, the script and the stylesheet stop naming the
// same class and close button.
it("joins the hint's markup, the script and the stylesheet by name", () => {
  const html = renderToStaticMarkup(createElement(EraHint));
  expect(html).toMatch(/class="forg-era-hint /);
  expect(html).toContain("data-era-hint-close");
  expect(SOURCE).toContain('"forg-era-hint-on"');
  const css = readFileSync(path.join(process.cwd(), "src", "styles", "base.css"), "utf8");
  expect(css).toMatch(/\.forg-era-hint \{\s*display: none;/);
  expect(css).toMatch(/html\.forg-era-hint-on \.forg-era-hint \{\s*display: flex;/);
});
