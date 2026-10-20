import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  deployFiles,
  era2026Bytes,
  FRAME_LIMIT,
  outerElement,
  over,
  pageKind,
  pages,
} from "../../scripts/postbuild/check-page-weight.mjs";

const bytes = (s: string) => Buffer.byteLength(s);

describe("the page-weight check", () => {
  // Fails if: the depth of the element's own tag is miscounted (an end tag
  // not taken off, or another tag's taken), so the element ends early or late.
  it("measures an element to the end tag that closes it", () => {
    const inner = '<div><div></div><span><div>é</div></span><br><img src="x"></div>';
    const html = `<p>a</p>${inner}<div>after</div>`;
    expect(outerElement(html, html.indexOf(inner))).toEqual({
      end: html.indexOf("<div>after"),
      bytes: bytes(inner),
    });
    const img = '<img src="x">';
    expect(outerElement(img, 0).bytes).toBe(bytes(img));
    const b = "<b>1<br>2</b>";
    expect(outerElement(`${b}<b>3</b>`, 0).bytes).toBe(bytes(b));
  });

  // Fails if: the bar's wrapper counts as more 2026 markup, or a note
  // nested in another is counted twice.
  it("keeps the bar apart from the page's other 2026 markup", () => {
    const bar = '<div data-era-frame="2026" class="w26-top"><nav>menu</nav></div>';
    const note = '<p class="era-2026-only a"><span class="era-2026-only">x</span></p>';
    const html = `<div class="era-2026-only">${bar}</div><main>${note}</main>`;
    expect(era2026Bytes(html)).toEqual({ frame: bytes(bar), extras: bytes(note) });
    expect(era2026Bytes("<main></main>")).toEqual({ frame: 0, extras: 0 });
  });

  // Fails if: a limit is broken at its own value (`>` turned to `>=`), or
  // one byte past it passes.
  it("passes a value at its limit and fails one byte past it", () => {
    expect(over(FRAME_LIMIT, FRAME_LIMIT)).toBe(false);
    expect(over(FRAME_LIMIT + 1, FRAME_LIMIT)).toBe(true);
  });

  // Fails if: a page takes another kind's limit.
  it("tells the front page, a post, a list and the rest apart", () => {
    expect(pageKind("/", '<article class="forg-post x">')).toBe("home");
    expect(pageKind("/Q_A/1/", '<article class="forg-post border">')).toBe("post");
    expect(pageKind("/Q_A/", '<ul class="forg-narrow-list border">')).toBe("list");
    expect(pageKind("/boards/", "<article>")).toBe("other");
  });

  // Fails if: the post pictures R2 serves count toward the deploy, or a
  // page is missed or given the wrong address.
  it("counts the deploy without img/posts and finds every page", () => {
    const out = mkdtempSync(path.join(tmpdir(), "page-weight-"));
    try {
      for (const f of [
        "index.html",
        "404.html",
        "Q_A/index.html",
        "Q_A/page/2/index.html",
        "img/posts/Q_A/1.jpg",
        "img/chrome/a.gif",
      ]) {
        mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
        writeFileSync(path.join(out, f), "x");
      }
      expect(deployFiles(out)).toBe(5);
      expect(
        pages(out)
          .map((p) => p.path)
          .sort(),
      ).toEqual(["/", "/404", "/Q_A/", "/Q_A/page/2/"]);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
