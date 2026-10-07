import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { oldPostCandidates } from "@/lib/old-urls";
import { onRequest } from "../../functions/[[path]]";
import { redirectLines } from "../../scripts/postbuild/old-page-redirects.mjs";

const at = (path: string) => oldPostCandidates(new URL(path, "https://forg.co.kr"));

describe("oldPostCandidates", () => {
  // Fails if: one of the board scripts forg ran is not read, or its id and
  // number are not the museum's board and post.
  it("reads every old board script", () => {
    expect(at("/_zb/zboard.php?id=UoBoard&no=26397")).toEqual(["/UoBoard/26397/", "/UoBoard/"]);
    expect(at("/zboard/view.php?id=DiabloBoard&page=1&no=9")).toEqual([
      "/DiabloBoard/9/",
      "/DiabloBoard/",
    ]);
    expect(at("/zb/zboard.php?id=ScreenShot&no=70")).toEqual(["/ScreenShot/70/", "/ScreenShot/"]);
    expect(at("/~forg/zboard/zboard.php?id=Events&no=33")).toEqual(["/Events/33/", "/Events/"]);
    expect(at("/bbs/board.php?bo_table=Reveal&wr_id=2593")).toEqual(["/Reveal/2593/", "/Reveal/"]);
    expect(at("/_zb/zboard.php?id=UoBoard&page=3")).toEqual(["/UoBoard/"]);
  });

  // Fails if: another file under those folders, or an id that could climb
  // out of the site, becomes a target.
  it("leads nowhere from anything else", () => {
    expect(at("/_zb/data/a.gif")).toEqual([]);
    expect(at("/zb/apply_vote.php?id=UO_Vote&no=113")).toEqual([]);
    expect(at("/_zb/zboard.php?id=../site&no=1")).toEqual([]);
    expect(at("/_zb/zboard.php?no=1")).toEqual([]);
  });
});

describe("the old-address Function", () => {
  const pages = new Set(["/UoBoard/26397/", "/UoBoard/", "/Reveal/"]);
  const env = {
    ASSETS: {
      fetch: (u: URL) =>
        Promise.resolve(
          pages.has(u.pathname)
            ? new Response("page", { status: 200 })
            : new Response("missing", { status: 404 }),
        ),
    },
  };
  const ask = (path: string) =>
    onRequest({ request: new Request(`https://forg.co.kr${path}`), env });

  // Fails if: an old address does not reach the post, or its board when the
  // museum lacks the post, with a permanent redirect, or a dead one is not a 404.
  it("redirects to the post, else the board, else answers 404", async () => {
    const post = await ask("/_zb/zboard.php?id=UoBoard&no=26397");
    expect([post.status, post.headers.get("location")]).toEqual([
      301,
      "https://forg.co.kr/UoBoard/26397/",
    ]);
    const board = await ask("/bbs/board.php?bo_table=Reveal&wr_id=1");
    expect([board.status, board.headers.get("location")]).toEqual([
      301,
      "https://forg.co.kr/Reveal/",
    ]);
    expect((await ask("/_zb/zboard.php?id=Nowhere&no=1")).status).toBe(404);
  });
});

describe("redirectLines", () => {
  const page = (stem: string, originalPath: string) => ({ stem, originalPath });

  // Fails if: an old guide page does not lead to its museum copy, or a line
  // is written for an address with a query, one the museum serves, or twice.
  it("sends each old guide page to its /site/ copy", () => {
    const lines = redirectLines(
      [
        page("skill/attack", "/skill/attack.htm"),
        page("index", "/"),
        page("index--page-2", "/index.php?page=2"),
        page("skill/attack", "/skill/attack.htm"),
      ],
      (p: string) => p === "/",
    );
    expect(lines).toEqual(["/skill/attack.htm /site/skill/attack/ 301"]);
  });
});

// Fails if: an old board script's folder does not reach the Function, or a
// museum page would run it instead of being served as a file.
it("routes only the old board folders to the Function", () => {
  const routes = JSON.parse(
    readFileSync(path.join(process.cwd(), "public", "_routes.json"), "utf8"),
  ) as { include: string[]; exclude: string[] };
  const runs = (p: string) =>
    routes.include.some((r) => (r.endsWith("/*") ? p.startsWith(r.slice(0, -1)) : p === r)) &&
    !routes.exclude.some((r) => (r.endsWith("/*") ? p.startsWith(r.slice(0, -1)) : p === r));
  for (const p of [
    "/_zb/zboard.php",
    "/zboard/view.php",
    "/zb/zboard.php",
    "/~forg/zboard/zboard.php",
    "/bbs/board.php",
  ]) {
    expect(runs(p)).toBe(true);
  }
  for (const p of ["/", "/UoBoard/26397/", "/site/skill/attack/", "/search/", "/sitemap.xml"]) {
    expect(runs(p)).toBe(false);
  }
});
