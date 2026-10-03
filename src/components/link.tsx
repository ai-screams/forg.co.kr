/**
 * Internal link — a plain `<a>`. The museum is a frozen static archive whose
 * RSC payload `.txt` files are stripped at postbuild (see `package.json`
 * postbuild + ADR-0015) to fit Cloudflare Pages' 20,000-file cap, so
 * next/link's client navigation could only fail: every click fetched
 * `index.txt?_rsc`, got a 404 and fell back to a full page load. Each
 * next/link was also a client reference in the page's inline RSC payload.
 * A full page load is what a click ends in either way.
 *
 * `trailingSlash: true` (next.config.ts) serves `/Q_A/` and 308-redirects
 * `/Q_A`; next/link added the slash to internal paths itself, so this does.
 */

import type { ComponentProps } from "react";

type Props = ComponentProps<"a"> & { href: string };

function Link({ href, ...rest }: Props) {
  return <a href={href.startsWith("/") && !href.endsWith("/") ? `${href}/` : href} {...rest} />;
}

export default Link;
