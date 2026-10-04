import type { ReactNode } from "react";

import type { BoardMeta } from "@/lib/boards";

/** A list page's header: the board's name and description, then its notes. */
export function BoardHeader({
  meta,
  children,
}: {
  meta: Pick<BoardMeta, "nameKr" | "description">;
  children: ReactNode;
}) {
  return (
    <header className="pb-2">
      <h1 className="text-[14px] font-bold text-forg-ink">{meta.nameKr}</h1>
      {meta.description && <BoardNote>{meta.description}</BoardNote>}
      {children}
    </header>
  );
}

/** One line of a list page's header. */
export function BoardNote({ children }: { children: ReactNode }) {
  return <p className="mt-[2px] text-[11px] text-forg-muted">{children}</p>;
}
