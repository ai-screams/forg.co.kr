/**
 * Where an old forg.co.kr board address leads in the museum (ADR-0022).
 *
 * Zeroboard served a post at `/_zb/zboard.php?id=UoBoard&no=26397` (also
 * under `/zboard/`, `/zb/` and `/~forg/zboard/`, and through `view.php`), and
 * Gnuboard4 at `/bbs/board.php?bo_table=Reveal&wr_id=2593`. Every forg.co.kr
 * post kept its board id and number in the museum, so the post is
 * `/{id}/{no}/`; failing that the board `/{id}/`. The Function
 * (`functions/[[path]].ts`) tries them in this order as static files. The
 * post, or the board for a list address, is where the old address now
 * lives (permanent); the board standing in for a post the museum lacks is
 * not (temporary: the post may be collected later).
 *
 * Imported by the Function, which Cloudflare bundles on its own: no `@/`
 * imports here.
 */

const SCRIPT = /^\/(?:_zb|zboard|zb|~forg\/zboard)\/(?:zboard|view)\.php$|^\/bbs\/board\.php$/;
const ID = /^[A-Za-z0-9_]{1,40}$/;
const NO = /^\d{1,9}$/;

interface Candidate {
  path: string;
  permanent: boolean;
}

export function oldPostCandidates(url: URL): Candidate[] {
  if (!SCRIPT.test(url.pathname)) return [];
  const q = url.searchParams;
  const id = q.get("id") ?? q.get("bo_table") ?? "";
  const no = q.get("no") ?? q.get("wr_id") ?? "";
  if (!ID.test(id)) return [];
  const board = `/${id}/`;
  return NO.test(no)
    ? [
        { path: `/${id}/${no}/`, permanent: true },
        { path: board, permanent: false },
      ]
    : [{ path: board, permanent: true }];
}
