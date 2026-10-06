/**
 * The pages `sitemap.xml` lists (`src/app/sitemap.ts`): every page worth
 * finding, by its canonical path. Left out: the search page (kept out of
 * search engines), a board Wayback kept nothing of, the older captures of a
 * `/site/` page (canonical to the latest), and `/site/` documents that hold
 * no text of their own — framesets, redirects and member-only notices.
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
  return ["/", "/policy/", "/site/", ...boards.flat(), ...posts, ...sitePages];
}
