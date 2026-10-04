/**
 * A non-member's name on a board that showed a random daemon name on every
 * view (`BoardMeta.daemonGuestNames`). The static HTML keeps the name the
 * capture shows; `public/scripts/daemon-names.js` swaps in a fresh draw, the
 * way the board did, one per `seed` — the seed names the post or comment, so
 * its copies (the phone list, the 2014/2003 table, the 2001 skin) keep one
 * name when the era or the width changes. Content pages ship no React
 * runtime (`scripts/postbuild/strip-react-runtime.mjs`); React 19 hoists the
 * `async` script into `<head>` once however many names a page shows. The
 * text is the script's to change, so hydration (`pnpm dev`) leaves it.
 */
export function DaemonName({ name, seed }: { name: string; seed: string }) {
  return (
    <>
      <script async src="/scripts/daemon-names.js" />
      <span data-daemon={seed} suppressHydrationWarning>
        {name}
      </span>
    </>
  );
}
