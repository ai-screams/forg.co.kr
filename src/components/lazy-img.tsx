import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<"img">, "loading"> & { src: string; alt: string };

/**
 * The museum's `<img>`: recovered chrome and skin art at its original size
 * (static export, so `next/image` and its optimiser do not apply).
 *
 * Always lazy. Every era's chrome is rendered side by side and the hidden
 * ones are `display: none`, so a lazy image there never loads, and React
 * emits no `<link rel="preload">` for it (`.claude/rules/era-and-ui.md`).
 */
export function LazyImg({ src, alt, ...rest }: Props) {
  // eslint-disable-next-line @next/next/no-img-element -- see above
  return <img loading="lazy" src={src} alt={alt} {...rest} />;
}
