/**
 * The pages `sitemap.xml` lists (`src/app/sitemap.ts`): every page worth
 * finding, by its canonical path. Left out, as they are out of search
 * engines: the search page, a board Wayback kept nothing of, the older
 * captures of a `/site/` page (canonical to the latest), and the `/site/`
 * framesets, redirects and member-only notices. A `/site/` page's latest
 * capture is listed whatever it holds (some are pictures alone).
 */

import { listBoards } from "@/lib/boards";
import { getAllPostParams, getBoardIndex } from "@/lib/posts";
import { getAllSitePages } from "@/lib/site-pages";

export async function sitemapPaths(): Promise<string[]> {
  const boards = await Promise.all(
    listBoards().map(async (b) => {
      const first = await getBoardIndex(b.id, 1);
      if (!first) return [];
      return [
        `/${b.id}/`,
        ...Array.from(
          { length: first.totalPages - 1 },
          (_, i) => `/${b.id}/page/${String(i + 2)}/`,
        ),
      ];
    }),
  );
  const posts = (await getAllPostParams()).map((p) => `/${p.board}/${p.postId}/`);
  const sitePages = (await getAllSitePages())
    .filter((p) => p.kind === "page" && !p.memberOnly)
    .map((p) => `/site/${p.stem}/`);
  return ["/", "/policy/", "/site/", "/boards/", ...boards.flat(), ...posts, ...sitePages];
}
