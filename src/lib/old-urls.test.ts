import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { oldPostCandidates } from "@/lib/old-urls";
import { onRequest } from "../../functions/[[path]]";
import { redirectLines, sourcesOf } from "../../scripts/postbuild/old-page-redirects.mjs";

const at = (p: string) =>
  oldPostCandidates(new URL(p, "https://forg.co.kr")).map((c) => [c.path, c.permanent]);

describe("oldPostCandidates", () => {
  // Fails if: one of the board scripts forg ran is not read, its id and
  // number are not the museum's board and post, or the board standing in for
  // a missing post is marked permanent.
  it("reads every old board script", () => {
    expect(at("/_zb/zboard.php?id=UoBoard&no=26397")).toEqual([
      ["/UoBoard/26397/", true],
      ["/UoBoard/", false],
    ]);
    expect(at("/zboard/view.php?id=DiabloBoard&page=1&no=9")[0]).toEqual(["/DiabloBoard/9/", true]);
    expect(at("/zb/zboard.php?id=ScreenShot&no=70")[0]).toEqual(["/ScreenShot/70/", true]);
    expect(at("/~forg/zboard/zboard.php?id=Events&no=33")[0]).toEqual(["/Events/33/", true]);
    expect(at("/bbs/board.php?bo_table=Reveal&wr_id=2593")[0]).toEqual(["/Reveal/2593/", true]);
    // A board's list address is the board itself.
    expect(at("/_zb/zboard.php?id=UoBoard&page=3")).toEqual([["/UoBoard/", true]]);
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
  const ask = async (p: string) => {
    const res = await onRequest({ request: new Request(`https://forg.co.kr${p}`), env });
    return [res.status, res.headers.get("location")];
  };

  // Fails if: an old address does not reach the post for good, the board
  // standing in for a missing post is permanent, or a dead one is not a 404.
  it("redirects to the post, else for now to the board, else answers 404", async () => {
    expect(await ask("/_zb/zboard.php?id=UoBoard&no=26397")).toEqual([
      301,
      "https://forg.co.kr/UoBoard/26397/",
    ]);
    expect(await ask("/bbs/board.php?bo_table=Reveal&wr_id=1")).toEqual([
      302,
      "https://forg.co.kr/Reveal/",
    ]);
    expect(await ask("/_zb/zboard.php?id=Reveal")).toEqual([301, "https://forg.co.kr/Reveal/"]);
    expect((await ask("/_zb/zboard.php?id=Nowhere&no=1"))[0]).toBe(404);
  });
});

describe("the guide pages' redirects", () => {
  // Fails if: a mirror page is not found at forg's own paths, a folder only
  // with its slash, or a file that is not a page, or an address with a query,
  // gets a line.
  it("reads the addresses a page answered at", () => {
    expect(sourcesOf("/skill/attack.htm")).toEqual(["/skill/attack.htm"]);
    expect(sourcesOf("hosting27.interpia98.net/~forg/Diablo2/diablo.htm")).toEqual([
      "/~forg/Diablo2/diablo.htm",
      "/Diablo2/diablo.htm",
    ]);
    expect(sourcesOf("/guest/")).toEqual(["/guest/", "/guest"]);
    expect(sourcesOf("/sounds/fly.wma")).toEqual([]);
    expect(sourcesOf("/index.php?page=2")).toEqual([]);
    // `_redirects` cannot match a query, even one that ends like a page.
    expect(sourcesOf("/print.php?file=guide.html")).toEqual([]);
  });

  const page = (stem: string, originalPath: string) => ({ stem, originalPath });

  // Fails if: an old guide page does not lead to its museum copy, a line is
  // written for one the museum serves or twice, or one lands on a path the
  // Function serves, where Pages would never apply it.
  it("sends each old guide page to its /site/ copy", () => {
    const lines = redirectLines(
      [
        page("skill/attack", "/skill/attack.htm"),
        page("index", "/"),
        page("skill/attack", "/skill/attack.htm"),
      ],
      (p: string) => p === "/",
    );
    expect(lines).toEqual(["/skill/attack.htm /site/skill/attack/ 301"]);
    expect(() =>
      redirectLines([page("zb/notice", "/zb/notice.htm")], () => false, ["/zb/notice.htm"]),
    ).toThrow(/Function/);
  });
});

// Fails if: an old board script does not reach the Function, or any other
// path (a museum page, an old guide page under the same folders) would run it.
it("routes only the old board scripts to the Function", () => {
  const routes = JSON.parse(
    readFileSync(path.join(process.cwd(), "public", "_routes.json"), "utf8"),
  ) as { include: string[]; exclude: string[] };
  const runs = (p: string) =>
    routes.include.some((r) => (r.endsWith("/*") ? p.startsWith(r.slice(0, -1)) : p === r)) &&
    !routes.exclude.some((r) => (r.endsWith("/*") ? p.startsWith(r.slice(0, -1)) : p === r));
  for (const p of [
    "/_zb/zboard.php",
    "/_zb/view.php",
    "/zboard/zboard.php",
    "/zb/view.php",
    "/~forg/zboard/zboard.php",
    "/bbs/board.php",
  ]) {
    expect(runs(p)).toBe(true);
  }
  for (const p of [
    "/",
    "/UoBoard/26397/",
    "/_zb/guild/index.html",
    "/~forg/Diablo2/diablo.htm",
    "/bbs/login.php",
  ]) {
    expect(runs(p)).toBe(false);
  }
});
