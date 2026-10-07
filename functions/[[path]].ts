/**
 * Cloudflare Pages Function: old forg.co.kr addresses, sent on to the
 * museum's pages (ADR-0022). The build's `_routes.json`
 * (`scripts/postbuild/old-addresses.mjs`) hands it only the old site's
 * folders that no museum path uses; the museum's own pages never run this.
 *
 * - An old picture: the build's table `/_old-images.json` names its copy
 *   (on img.forg.co.kr, or the museum's own chrome and emoticons), 301.
 * - Anything else: the first of `oldCandidates` (`src/lib/old-urls.ts`)
 *   the museum has as a static file — 301 where the address now lives, 302
 *   where a page stands in.
 * - Nothing: the request as a static file (the museum's 404 page).
 */

import { forgPath, oldCandidates } from "../src/lib/old-urls";

interface Context {
  request: Request;
  env: { ASSETS: { fetch: (input: Request | URL) => Promise<Response> } };
}

const IMAGES = "/_old-images.json";

/** The picture table, read once per instance; a failed read is tried again next time. */
let images: Promise<Record<string, string>> | null = null;

function imageTable(env: Context["env"], origin: string): Promise<Record<string, string>> {
  images ??= env.ASSETS.fetch(new URL(IMAGES, origin)).then(async (r) =>
    r.ok
      ? ((await r.json()) as Record<string, string>)
      : Promise.reject(new Error(String(r.status))),
  );
  return images.catch(() => {
    images = null;
    return {};
  });
}

export async function onRequest({ request, env }: Context): Promise<Response> {
  const url = new URL(request.url);
  const picture = (await imageTable(env, url.origin))[forgPath(url.pathname)];
  if (picture) return Response.redirect(new URL(picture, url.origin).href, 301);
  for (const { path, permanent } of oldCandidates(url)) {
    const target = new URL(path, url.origin);
    // Manual: Pages answers a missing `/x/index/` with a 308 to `/x/`, which a
    // followed fetch reports as 200, so a made-up folder would land on a page.
    const res = await env.ASSETS.fetch(new Request(target, { redirect: "manual" }));
    if (res.ok) {
      return Response.redirect(target.href, permanent ? 301 : 302);
    }
  }
  return env.ASSETS.fetch(request);
}
