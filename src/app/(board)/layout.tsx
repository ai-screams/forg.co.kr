/**
 * Every board and post page wears the same era frame the home page does.
 *
 * Board pages were never standalone documents: the original loaded them
 * into the `detail` frame of `frameset cols="10, 100, 680, 7, 1*"`, so a
 * visitor always saw the sidebar and the menu around them. Rendering them
 * as a bare card on the page background lost the one thing that makes the
 * site recognisable.
 *
 * `<EraShell>` renders `children` once and swaps only the chrome per era,
 * which keeps 13,290 post pages from carrying their body twice.
 */

import type { ReactNode } from "react";

import { EraShell } from "@/components/era-shell";

export default function BoardLayout({ children }: { children: ReactNode }) {
  return <EraShell>{children}</EraShell>;
}
