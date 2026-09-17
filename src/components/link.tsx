/**
 * Internal Link wrapper — defaults `prefetch={false}` to suppress Next.js's
 * automatic RSC prefetch hint requests. The museum is a frozen static
 * archive with thousands of paginated routes; the RSC payload `.txt` files
 * are stripped at postbuild (see `package.json` postbuild + ADR-0015) to
 * fit Cloudflare Pages' 20,000-file cap, so any in-flight prefetch attempt
 * would 404 noisily. Full page reloads on navigation are perfectly fine
 * for a read-only archive.
 *
 * Callers can override per instance: `<Link href="/x" prefetch={true} />`.
 */

import NextLink from "next/link";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof NextLink>;

function Link({ prefetch = false, ...rest }: Props) {
  return <NextLink prefetch={prefetch} {...rest} />;
}

export default Link;
