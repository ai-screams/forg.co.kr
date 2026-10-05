import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<"img">, "loading"> & { src: string; alt: string };

/**
 * The museum's `<img>`: recovered chrome and skin art at its original size
 * (static export, so `next/image` and its optimiser do not apply).
 *
 * Eager, the hidden eras' art included. Every era's chrome is rendered side
 * by side with the hidden ones `display: none`; it was lazy so that those
 * never loaded, but Safari makes a lazy picture wait for its viewport check
 * even when it is cached (WebKit PR 67352), so the chrome blinked on every
 * reload. Switching the shown era's pictures to eager from a script once
 * parsed did not help in Safari; only `eager` in the HTML did. The hidden
 * eras now cost one download each (their URLs carry a content hash and are
 * cached for a year, `src/lib/chrome.ts`), and React preloads the eager
 * pictures from the head.
 */
export function ChromeImg({ src, alt, ...rest }: Props) {
  // eslint-disable-next-line @next/next/no-img-element -- see above
  return <img src={src} alt={alt} {...rest} />;
}
