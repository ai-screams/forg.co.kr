import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { listBoards } from "@/lib/boards";
import { forgPath, oldCandidates, stemOf } from "@/lib/old-urls";
import { onRequest } from "../../functions/[[path]]";
import {
  folderOf,
  pictureSource,
  planOldAddresses,
  sourcesOf,
} from "../../scripts/postbuild/old-addresses.mjs";

const PAGES_ROOT = path.join(process.cwd(), "src", "content", "pages");
const pages = readdirSync(PAGES_ROOT, { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith(".json"))
  .map(
    (f) =>
      JSON.parse(readFileSync(path.join(PAGES_ROOT, f), "utf8")) as {
        stem: string;
        originalPath: string;
      },
  );

const at = (p: string) =>
  oldCandidates(new URL(p, "https://forg.co.kr")).map((c) => [c.path, c.permanent]);

describe("stemOf", () => {
  // Fails if: the Function names a guide page differently from the ETL
  // (`stem_of` in 02g), so an old address misses the page the museum has.
  it("names every guide page as the ETL did", () => {
    let checked = 0;
    for (const { stem, originalPath } of pages) {
      const u = new URL(
        originalPath.replace(/^[a-z0-9.-]+(?=\/~forg\/)/i, ""),
        "https://forg.co.kr",
      );
      expect(stemOf(forgPath(u.pathname), u.searchParams)).toBe(stem);
      checked += 1;
    }
    expect(checked).toBe(pages.length);
    expect(pages.some((p) => p.originalPath.includes("?"))).toBe(true);
  });

  // Fails if: the session id or an empty parameter splits one view into two
  // stems (the ETL drops both).
  it("drops the session id and empty parameters", () => {
    expect(stemOf("/a.php", new URLSearchParams("PHPSESSID=x&b=&id=1"))).toBe("a--id-1");
  });
});

describe("oldCandidates", () => {
  // Fails if: a board script's id and number are not the museum's board and
  // post, the board standing in for a missing post is permanent, or a list
  // address is not its board for good.
  it("reads every old board script", () => {
    expect(at("/_zb/zboard.php?id=UoBoard&no=26397").slice(0, 2)).toEqual([
      ["/UoBoard/26397/", true],
      ["/site/_zb/zboard--id-UoBoard--no-26397/", true],
    ]);
    expect(at("/_zb/zboard.php?id=UoBoard&no=26397")).toContainEqual(["/UoBoard/", false]);
    expect(at("/zboard/view.php?id=DiabloBoard&no=9")[0]).toEqual(["/DiabloBoard/9/", true]);
    expect(at("/~forg/zboard/zboard.php?id=Events&no=33")[0]).toEqual(["/Events/33/", true]);
    expect(at("/bbs/board.php?bo_table=Reveal&wr_id=2593")[0]).toEqual(["/Reveal/2593/", true]);
    expect(at("/_zb/zboard.php?id=UoBoard&page=3")).toContainEqual(["/UoBoard/", true]);
  });

  // Fails if: an old guide page, its query view, its mirror address or its
  // folder without the slash misses its /site/ copy, or a page standing in
  // for a query view is permanent.
  it("reads every old guide page", () => {
    expect(at("/skill/attack.htm")[0]).toEqual(["/site/skill/attack/", true]);
    expect(at("/~forg/Diablo2/diablo.htm")[0]).toEqual(["/site/Diablo2/diablo/", true]);
    expect(at("/holy")).toContainEqual(["/site/holy/index/", true]);
    expect(at("/_zb/guild/index.html?id=104&mode=detail&page=1&page_num=13&shard=")).toEqual([
      ["/site/_zb/guild/index--id-104--mode-detail--page-1--page_num-13/", true],
      ["/site/_zb/guild/index/", false],
    ]);
  });

  // Fails if: an id, a query or an encoded path could make a target that
  // climbs out of where it points (a `.` or `..` segment the URL would resolve).
  it("keeps every target where it points", () => {
    for (const p of [
      "/_zb/zboard.php?id=../site&no=1",
      "/skill/..%2F..%2Fpolicy/x.htm",
      "/_zb/guild/index.html?id=..&mode=.",
    ]) {
      for (const c of oldCandidates(new URL(p, "https://forg.co.kr"))) {
        expect(new URL(c.path, "https://forg.co.kr").pathname).toBe(c.path);
      }
    }
  });
});

describe("the old-address Function", () => {
  const files = new Map<string, string>([
    ["/UoBoard/26397/", "page"],
    ["/UoBoard/", "page"],
    ["/Reveal/", "page"],
    ["/site/skill/attack/", "page"],
    [
      "/_old-images.json",
      JSON.stringify({ "/_zb/data/a.jpg": "https://img.example/posts/UoBoard/1/a.jpg" }),
    ],
  ]);
  const env = {
    ASSETS: {
      fetch: (input: Request | URL) => {
        const p = new URL(input instanceof Request ? input.url : input).pathname;
        const body = files.get(p);
        return Promise.resolve(new Response(body ?? "missing", { status: body ? 200 : 404 }));
      },
    },
  };
  const ask = async (p: string) => {
    const res = await onRequest({ request: new Request(`https://forg.co.kr${p}`), env });
    return [res.status, res.headers.get("location")];
  };

  // Fails if: an old picture, post or guide page does not reach its copy, the
  // board standing in for a missing post is permanent, or an unknown address
  // is not answered as a static file (the 404 page).
  it("redirects pictures, posts and pages, and leaves the rest to the files", async () => {
    expect(await ask("/_zb/data/a.jpg")).toEqual([
      301,
      "https://img.example/posts/UoBoard/1/a.jpg",
    ]);
    expect(await ask("/_zb/zboard.php?id=UoBoard&no=26397")).toEqual([
      301,
      "https://forg.co.kr/UoBoard/26397/",
    ]);
    expect(await ask("/bbs/board.php?bo_table=Reveal&wr_id=1")).toEqual([
      302,
      "https://forg.co.kr/Reveal/",
    ]);
    expect(await ask("/skill/attack.htm")).toEqual([301, "https://forg.co.kr/site/skill/attack/"]);
    expect(await ask("/skill/nothing.htm")).toEqual([404, null]);
  });
});

describe("the build's plan", () => {
  const museum = new Set([
    ...listBoards().map((b) => b.id),
    "site",
    "img",
    "scripts",
    "search",
    "policy",
    "_next",
  ]);
  const pictures = [
    { source: "/_zb/data/a.jpg", target: "https://img.example/posts/UoBoard/1/a.jpg" },
    {
      source: "/Diablo/images/gem.gif",
      target: "https://img.example/posts/site/Diablo/images/gem.gif",
    },
    { source: "/best_19.gif", target: "https://img.example/posts/site/best_19.gif" },
    { source: "/_zb/data/a.jpg", target: "https://img.example/posts/UoBoard/2/a.jpg" },
  ];
  const plan = planOldAddresses({ pages, pictures, museum, isServed: (p: string) => p === "/" });

  // Fails if: a folder a museum board uses (or a museum page) would run the
  // Function, an old folder or a board script's would not, or Pages' limits
  // are passed.
  it("routes the old folders no museum path uses", () => {
    for (const r of ["/_zb/*", "/zboard/*", "/zb/*", "/bbs/*", "/skill/*", "/~forg/*"]) {
      expect(plan.routes).toContain(r);
    }
    for (const name of museum) expect(plan.routes).not.toContain(`/${name}/*`);
    expect(plan.routes.length).toBeLessThanOrEqual(100);
    expect(plan.redirects.length).toBeLessThanOrEqual(2000);
  });

  // Fails if: what lies outside the routed folders gets no static line, a
  // line lands under one (Pages would never apply it), or a routed picture is
  // missing from the Function's table or listed twice.
  it("leaves only what the Function cannot reach to static redirects", () => {
    expect(plan.redirects).toContain("/Diablo/diablo.htm /site/Diablo/diablo/ 301");
    expect(plan.redirects).toContain(
      "/Diablo/images/gem.gif https://img.example/posts/site/Diablo/images/gem.gif 301",
    );
    expect(plan.redirects).toContain("/best_19.gif https://img.example/posts/site/best_19.gif 301");
    const routed = new Set(plan.routes.map((r: string) => r.slice(1, -2)));
    expect(
      (plan.redirects as string[]).every((l) => !routed.has(folderOf(l.split(" ")[0] ?? ""))),
    ).toBe(true);
    expect(plan.imageMap).toEqual({
      "/_zb/data/a.jpg": "https://img.example/posts/UoBoard/1/a.jpg",
    });
  });
});

describe("reading old addresses", () => {
  // Fails if: a mirror page is not on forg's own paths, a folder answers only
  // with its slash, or a file that is not a page, or an address with a query,
  // gets a static line.
  it("reads a guide page's addresses", () => {
    expect(sourcesOf("/skill/attack.htm")).toEqual(["/skill/attack.htm"]);
    expect(sourcesOf("hosting27.interpia98.net/~forg/Diablo2/diablo.htm")).toEqual([
      "/Diablo2/diablo.htm",
    ]);
    expect(sourcesOf("/guest/")).toEqual(["/guest/", "/guest"]);
    expect(sourcesOf("/sounds/fly.wma")).toEqual([]);
    expect(sourcesOf("/print.php?file=guide.html")).toEqual([]);
  });

  // Fails if: another site's picture is taken for forg's, the mirror's
  // prefix stays, or a table key differs from the key the Function looks up.
  it("reads a picture's address as the Function will look it up", () => {
    expect(pictureSource("http://forg.co.kr/_zb/data/a.jpg")).toBe("/_zb/data/a.jpg");
    expect(pictureSource("http://hosting27.interpia98.net/~forg/images/b.gif")).toBe(
      "/images/b.gif",
    );
    expect(pictureSource("http://cgi.chollian.net/x.jpg")).toBeNull();
    expect(pictureSource("http://forg.co.kr/a.gif?x=1")).toBeNull();
    for (const raw of ["/_zb/data/%ba%b9%b1%c7.jpg", "/_zb/data/%EB%B3%B5%EA%B6%8C.jpg"]) {
      expect(forgPath(raw)).toBe(pictureSource(`http://forg.co.kr${raw}`));
    }
  });
});

// Fails if: one failed read of the picture table leaves every later old
// picture without its copy until the instance restarts.
it("reads the picture table again after a failed read", async () => {
  vi.resetModules();
  const { onRequest: fresh } = await import("../../functions/[[path]]");
  let reads = 0;
  const env = {
    ASSETS: {
      fetch: (input: Request | URL) => {
        const p = new URL(input instanceof Request ? input.url : input).pathname;
        if (p !== "/_old-images.json")
          return Promise.resolve(new Response("missing", { status: 404 }));
        reads += 1;
        return Promise.resolve(
          reads === 1
            ? new Response("busy", { status: 503 })
            : new Response(JSON.stringify({ "/images/a.gif": "/img/chrome/a.gif" }), {
                status: 200,
              }),
        );
      },
    },
  };
  const ask = (p: string) => fresh({ request: new Request(`https://forg.co.kr${p}`), env });
  expect((await ask("/images/a.gif")).status).toBe(404);
  const again = await ask("/images/a.gif");
  expect([again.status, again.headers.get("location")]).toEqual([
    301,
    "https://forg.co.kr/img/chrome/a.gif",
  ]);
});
