import { readFileSync } from "node:fs";
import path from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FrameTop2026 } from "@/components/era-chrome-2026";
import { EraFold, EraHint } from "@/components/era-toggle";
import { ERA_HINT_KEY, ERA_STORAGE_KEY, ERAS } from "@/lib/era";

// The era script as the layout inlines it, run against a stand-in page: only
// what it touches — the root's attributes and classes, the click and storage
// listeners, and localStorage.

const SOURCE = readFileSync(path.join(process.cwd(), "src", "app", "_scripts", "era.js"), "utf8");

class FakeElement {
  focused = false;
  constructor(
    private readonly selectorPart: string,
    private readonly attrs: Record<string, string> = {},
    /** Whether it renders; `fold`: the `<details>` it sits in. */
    readonly shown: { visible?: boolean; fold?: FakeFold } = {},
  ) {}
  closest(selector: string): FakeElement | null {
    const fold = this.shown.fold;
    if (selector === "details") return fold ?? null;
    if (selector.includes("[open]")) return fold?.open && fold.matches(selector) ? fold : null;
    return selector.includes(this.selectorPart) ? this : null;
  }
  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }
  setAttribute(name: string, value: string) {
    this.attrs[name] = value;
  }
  checkVisibility(): boolean {
    const fold = this.shown.fold;
    const inside = fold !== undefined && this !== fold.summary;
    return (this.shown.visible ?? true) && (!inside || (fold.open && fold.checkVisibility()));
  }
  focus() {
    this.focused = true;
  }
}

/** A `<details>`: a fold of era buttons, or with `fold: false` any other. */
class FakeFold extends FakeElement {
  open: boolean;
  readonly summary: FakeElement;
  readonly items: FakeElement[] = [];
  private readonly isFold: boolean;
  constructor({ open = false, visible = true, fold = true } = {}) {
    super("details", {}, { visible });
    this.open = open;
    this.isFold = fold;
    this.summary = new FakeElement("summary", {}, { visible, fold: this });
  }
  matches(selector: string) {
    return this.isFold && this.open && selector.includes("[open]");
  }
  querySelector(selector: string) {
    return selector === "summary" ? this.summary : null;
  }
  contains(element: unknown) {
    return (
      element === this || element === this.summary || this.items.includes(element as FakeElement)
    );
  }
}

/** An era button on the stand-in page. */
function eraButton(era: string, shown: { visible?: boolean; fold?: FakeFold } = {}) {
  const button = new FakeElement("button[data-era-option]", { "data-era-option": era }, shown);
  shown.fold?.items.push(button);
  return button;
}

/** The page starts as the server renders it, in the default era. */
function run(
  stored: Record<string, string> | "blocked",
  { buttons = [] as FakeElement[], folds = [] as FakeFold[] } = {},
) {
  const links: Map<string, string>[] = [];
  const classes = new Set<string>();
  const attrs = new Map<string, string>([["data-era", "2014"]]);
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
    head: { appendChild: (link: Map<string, string>) => links.push(link) },
    createElement: () => {
      const link = new Map<string, string>();
      return Object.assign(link, { setAttribute: (k: string, v: string) => link.set(k, v) });
    },
    activeElement: null as unknown,
    querySelectorAll: (selector: string): FakeElement[] =>
      selector.includes("[open]")
        ? folds.filter((f) => f.matches(selector))
        : buttons.filter(
            (b) =>
              !selector.includes('[aria-pressed="true"]') ||
              b.getAttribute("aria-pressed") === "true",
          ),
    querySelector: (selector: string) =>
      selector === "link[data-fonts-2026]"
        ? (links.find((l) => l.has("data-fonts-2026")) ?? null)
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
    "FONTS_2026",
    SOURCE,
  )(document, window, localStorage, FakeElement, ERA_STORAGE_KEY, ERAS, ERA_HINT_KEY, FONTS);
  return {
    era: () => attrs.get("data-era") ?? null,
    links,
    hinted: () => classes.has("forg-era-hint-on"),
    store,
    click: (target: FakeElement) => listeners["click"]?.({ target }),
    /** The fold opens (a tap on its summary), and its `toggle` follows. */
    open: (fold: FakeFold) => {
      fold.open = true;
      listeners["toggle"]?.({ target: fold });
    },
    key: (key: string, on: FakeElement | null) => {
      document.activeElement = on;
      listeners["keydown"]?.({ key });
    },
    otherTab: (key: string, newValue: string) => listeners["window:storage"]?.({ key, newValue }),
  };
}

// Fails if: the script does not know 2026 (left out of ERAS), or applies a
// saved value that is no era.
it("applies a saved 2026 and ignores a value that is no era", () => {
  expect(run({ [ERA_STORAGE_KEY]: "2026" }).era()).toBe("2026");
  expect(run({ [ERA_STORAGE_KEY]: "1999" }).era()).toBe("2014");
});

const FONTS = "/fonts/2026/2026.css?v=0123456789";
const ERA_2014 = eraButton("2014");
const ERA_2026 = eraButton("2026");

describe("the 2026 fonts", () => {
  const hrefs = (page: ReturnType<typeof run>) => page.links.map((l) => l.get("href"));

  // Fails if: a page in another era links the 2026 fonts (the era check
  // dropped), so every visit would fetch them.
  it("are not linked in another era", () => {
    expect(hrefs(run({ [ERA_STORAGE_KEY]: "2014" }))).toEqual([]);
    expect(hrefs(run({}))).toEqual([]);
  });

  // Fails if: a saved 2026 does not link them as the page starts, with
  // their versioned URL.
  it("are linked once 2026 is the saved era", () => {
    const page = run({ [ERA_STORAGE_KEY]: "2026" });
    expect(hrefs(page)).toEqual([FONTS]);
    expect(page.links[0]?.get("rel")).toBe("stylesheet");
  });

  // Fails if: choosing 2026 does not link them, or choosing it again links
  // them twice (the check for the existing link dropped).
  it("are linked by choosing 2026, and only once", () => {
    const page = run({ [ERA_STORAGE_KEY]: "2014" });
    page.click(ERA_2026);
    page.click(ERA_2014);
    page.click(ERA_2026);
    expect(hrefs(page)).toEqual([FONTS]);
    expect(page.era()).toBe("2026");
  });

  // Fails if: another tab's choice of 2026 sets the era without them (the
  // storage handler setting the attribute itself instead of going through
  // show()).
  it("are linked when another tab chooses 2026", () => {
    const page = run({ [ERA_STORAGE_KEY]: "2014" });
    page.otherTab(ERA_STORAGE_KEY, "2026");
    expect(hrefs(page)).toEqual([FONTS]);
  });
});

describe("keyboard focus after an era change", () => {
  // Fails if: focus stays on a pressed button the new era hid (a 2026
  // note's "2003 모습으로"), where it falls to the page, instead of moving
  // to the museum bar's pressed button.
  // A pressed button in a fold hidden itself (the 2026 bar on a desktop)
  // comes first in the page and is passed over.
  it("moves to a pressed button that shows", () => {
    const hiddenFold = new FakeFold({ visible: false });
    const bar = eraButton("2003", { fold: hiddenFold });
    const toolbar = eraButton("2003");
    const note = eraButton("2003", { visible: false });
    run({ [ERA_STORAGE_KEY]: "2026" }, { buttons: [bar, toolbar, note] }).click(note);
    expect([hiddenFold.summary.focused, toolbar.focused, note.focused]).toEqual([
      false,
      true,
      false,
    ]);
  });

  // Fails if: with every pressed button in a closed fold (the museum bar
  // hidden on a 2026 phone), focus does not move to that fold's summary.
  it("moves to the summary of a closed fold holding the pressed button", () => {
    const fold = new FakeFold();
    const header = eraButton("2026", { visible: false });
    const bar = eraButton("2026", { fold });
    run({}, { buttons: [header, bar] }).click(header);
    expect([header.focused, bar.focused, fold.summary.focused]).toEqual([false, false, true]);
  });

  // Fails if: focus moves though the button clicked still shows.
  it("stays on the button clicked when it still shows", () => {
    const toolbar = eraButton("2003");
    const other = eraButton("2003");
    run({}, { buttons: [other, toolbar] }).click(toolbar);
    expect([other.focused, toolbar.focused]).toEqual([false, false]);
  });

  // Fails if: a browser without checkVisibility throws on an era click.
  it("leaves focus alone where the browser cannot tell what shows", () => {
    const old = eraButton("2003");
    Object.defineProperty(old, "checkVisibility", { value: undefined });
    const page = run({}, { buttons: [old] });
    expect(() => page.click(old)).not.toThrow();
    expect(page.era()).toBe("2003");
  });
});

const CLOSE = new FakeElement("[data-era-hint-close]");
const ERA_2003 = eraButton("2003");

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
    const pressed = eraButton("2014");
    const page = run({}, { buttons: [eraButton("2026"), pressed] });
    page.click(CLOSE);
    expect(page.hinted()).toBe(false);
    expect(pressed.focused).toBe(true);
    // Before the buttons exist (a click while the page still loads).
    const early = run({});
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

describe("a fold of era buttons", () => {
  /** The museum bar's fold open below 360px, the four buttons beside it hidden. */
  function phone() {
    const fold = new FakeFold({ open: true });
    const header = eraButton("2003", { visible: false });
    const inFold = eraButton("2003", { fold });
    return { fold, header, inFold, page: run({}, { buttons: [header, inFold], folds: [fold] }) };
  }

  // Fails if: opening a fold leaves the first-visit hint over it (the hint
  // and the fold's panel share the header's corner below 360px), or any other
  // <details> opening takes the hint down.
  it("takes the first-visit hint down when it opens", () => {
    const page = run({});
    page.open(new FakeFold({ fold: false }));
    expect(page.hinted()).toBe(true);
    page.open(new FakeFold());
    expect(page.hinted()).toBe(false);
  });

  // Fails if: the fold stays open after an era is chosen from it, or focus
  // stays on the button it hid instead of moving to its summary.
  it("closes once an era is chosen from it, focus on its summary", () => {
    const { fold, header, inFold, page } = phone();
    page.click(inFold);
    expect(page.era()).toBe("2003");
    expect(fold.open).toBe(false);
    expect([header.focused, inFold.focused, fold.summary.focused]).toEqual([false, false, true]);
  });

  // Fails if: Escape leaves it open, another key closes it, or focus is
  // pulled back to the summary from outside the fold.
  it("closes on Escape, focus back on its summary when it was inside", () => {
    const { fold, inFold, page } = phone();
    page.key("Enter", inFold);
    expect(fold.open).toBe(true);
    page.key("Escape", inFold);
    expect([fold.open, fold.summary.focused]).toEqual([false, true]);
    const outside = phone();
    outside.page.key("Escape", null);
    expect([outside.fold.open, outside.fold.summary.focused]).toEqual([false, false]);
  });

  // Fails if: a tap outside leaves it open, or a tap on its own summary
  // closes it first (the summary's own toggle would then open it again).
  it("closes on a tap outside it, not on its summary", () => {
    const { fold, page } = phone();
    page.click(fold.summary);
    expect(fold.open).toBe(true);
    page.click(CLOSE);
    expect(fold.open).toBe(false);
  });
});

// Fails if: the script's folds stop naming the classes the museum bar's fold
// and the 2026 bar's folds carry.
it("joins the folds' markup and the script by class", () => {
  expect(renderToStaticMarkup(createElement(EraFold))).toMatch(/^<details class="forg-era-fold">/);
  expect(renderToStaticMarkup(createElement(FrameTop2026))).toContain(
    '<details name="w26" class="w26-pop">',
  );
  expect(SOURCE).toContain('".forg-era-fold[open], .w26-pop[open]"');
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
