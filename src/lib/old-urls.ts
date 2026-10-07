/**
 * Where an old forg.co.kr address leads in the museum (ADR-0022). The
 * Function (`functions/[[path]].ts`) tries the candidates in order, each as
 * a static file, and redirects to the first the museum has.
 *
 * - A board post: Zeroboard `/_zb/zboard.php?id=UoBoard&no=26397` (also under
 *   `/zboard/`, `/zb/`, `/~forg/zboard/`, and through `view.php`) and
 *   Gnuboard4 `/bbs/board.php?bo_table=Reveal&wr_id=2593`. Every forg.co.kr
 *   post kept its board id and number, so the post is `/{id}/{no}/`, failing
 *   that its board `/{id}/`.
 * - A guide page: `/site/{stem}/`, the stem made as the ETL made it
 *   (`stem_of` in `scripts/etl/02g-parse-site.py`) — with its query first,
 *   then without, then as a folder.
 *
 * Permanent (301) where the old address now lives; temporary (302) where a
 * page stands in for one the museum lacks (it may be collected later).
 * `/~forg/X` was the same page as `/X` (the hosting27 mirror).
 *
 * Imported by the Function, which Cloudflare bundles on its own: no `@/`
 * imports here.
 */

const SCRIPT = /^\/(?:_zb|zboard|zb|~forg\/zboard)\/(?:zboard|view)\.php$|^\/bbs\/board\.php$/;
const ID = /^[A-Za-z0-9_]{1,40}$/;
const NO = /^\d{1,9}$/;
const PAGE_EXT = /\.(?:html?|php)$/i;
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const MIRROR = /^\/~forg(?=\/)/;

interface Candidate {
  path: string;
  permanent: boolean;
}

/**
 * A path decoded, or — when it is not UTF-8 (old Korean names were EUC-KR,
 * `%ba%b9…`) — with its escapes in one case, as the build's table writes them
 * (`scripts/postbuild/old-addresses.mjs`).
 */
function decoded(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path.replace(/%[0-9a-f]{2}/gi, (e) => e.toUpperCase());
  }
}

/** A path on forg's own paths: the `/~forg/` mirror prefix dropped, decoded. */
export function forgPath(pathname: string): string {
  return decoded(pathname.replace(MIRROR, ""));
}

function byKeyThenValue(a: [string, string], b: [string, string]): number {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
  return 0;
}

/** The query's parameters that pick what a page shows, as the ETL kept them. */
function viewParams(query: URLSearchParams): [string, string][] {
  return [...query].filter(([k, v]) => v !== "" && k !== "PHPSESSID").sort(byKeyThenValue);
}

/** `/Diablo/uarmor.htm` → `Diablo/uarmor`; `/` → `index`; `/holy/` → `holy/index`; a query joins it. */
export function stemOf(path: string, query = new URLSearchParams()): string {
  let p = path.replace(/^\/+/, "");
  if (!p || p.endsWith("/")) p += "index";
  const stem = p.replace(PAGE_EXT, "");
  return (
    stem +
    viewParams(query)
      .map(([k, v]) => `--${k}-${v}`)
      .join("")
  );
}

function safe(stem: string): boolean {
  return stem.split("/").every((s) => SAFE_SEGMENT.test(s) && s !== "." && s !== "..");
}

function postCandidates(url: URL): { post: Candidate[]; board: Candidate[] } {
  if (!SCRIPT.test(url.pathname)) return { post: [], board: [] };
  const q = url.searchParams;
  const id = q.get("id") ?? q.get("bo_table") ?? "";
  const no = q.get("no") ?? q.get("wr_id") ?? "";
  if (!ID.test(id)) return { post: [], board: [] };
  const board = `/${id}/`;
  return NO.test(no)
    ? {
        post: [{ path: `/${id}/${no}/`, permanent: true }],
        board: [{ path: board, permanent: false }],
      }
    : { post: [], board: [{ path: board, permanent: true }] };
}

function pageCandidates(url: URL): { exact: Candidate[]; stand: Candidate[] } {
  const path = forgPath(url.pathname);
  const withQuery = viewParams(url.searchParams).length > 0;
  const site = (stem: string, permanent: boolean) =>
    safe(stem) ? [{ path: `/site/${stem}/`, permanent }] : [];
  const base = stemOf(path);
  // A folder asked for without its slash: the old server added it.
  const folder =
    !path.endsWith("/") && !/\.[A-Za-z0-9]+$/.test(path) ? site(`${base}/index`, !withQuery) : [];
  return withQuery
    ? {
        exact: site(stemOf(path, url.searchParams), true),
        stand: [...site(base, false), ...folder],
      }
    : { exact: [...site(base, true), ...folder], stand: [] };
}

/**
 * Every place an old address may lead, best first: the post, the exact
 * guide page, the post's board, the guide page without its query.
 */
export function oldCandidates(url: URL): Candidate[] {
  const { post, board } = postCandidates(url);
  const { exact, stand } = pageCandidates(url);
  return [...post, ...exact, ...board, ...stand];
}
