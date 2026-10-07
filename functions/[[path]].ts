/**
 * Cloudflare Pages Function: old forg.co.kr board addresses, sent on to the
 * museum's pages with a permanent redirect (ADR-0022). `public/_routes.json`
 * hands it only the old board scripts' folders; every other request is a
 * static file and never runs this.
 *
 * The post if the museum has it, else its board (`src/lib/old-urls.ts`), each
 * checked as a static file; with neither, the museum's 404 page.
 */

import { oldPostCandidates } from "../src/lib/old-urls";

interface Context {
  request: Request;
  env: { ASSETS: { fetch: (input: URL) => Promise<Response> } };
}

/** A path no page has: the static handler answers it with 404.html and 404. */
const MISSING = "/_old-address-not-found/";

export async function onRequest({ request, env }: Context): Promise<Response> {
  const url = new URL(request.url);
  for (const path of oldPostCandidates(url)) {
    const target = new URL(path, url.origin);
    if ((await env.ASSETS.fetch(target)).ok) return Response.redirect(target.href, 301);
  }
  return env.ASSETS.fetch(new URL(MISSING, url.origin));
}
