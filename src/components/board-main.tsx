import type { ReactNode } from "react";

/** The content cell of a board, list page or post inside `<EraShell>`. */
export function BoardMain({ children }: { children: ReactNode }) {
  return <div className="w-full flex-1 px-3 py-4">{children}</div>;
}
