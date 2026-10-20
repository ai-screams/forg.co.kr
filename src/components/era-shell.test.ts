import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { EraShell } from "@/components/era-shell";

// Fails if: the 2026 bar leaves its `.era-2026-only` wrapper (shown in
// another era), or a home handed only its 2026 content draws `children`
// instead (the `content2026` test dropped from `splitContent`).
it("puts the 2026 bar and the 2026 home in the 2026 slots", () => {
  const html = renderToStaticMarkup(
    createElement(EraShell, { content2026: createElement("p", null, "home 2026") }),
  );
  expect(html).toMatch(/<div class="era-2026-only"><div data-era-frame="2026"/);
  expect(html).toContain('<div class="era-2026-only grow"><p>home 2026</p></div>');
});
