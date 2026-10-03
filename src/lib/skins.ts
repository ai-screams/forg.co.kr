/**
 * Which skin a board list or a comment strip is drawn in, from the engine
 * that rendered the original (707 captured list pages):
 *
 * - `kritz` — Zeroboard: five `kritz_*` skins whose header labels are the
 *   same bytes, so the `kritz_normal2` set stands for all of them.
 * - `webbus` — Gnuboard4's 2014 `webbus2009_basic` (13 of its 14 boards).
 * - `plain` — Gnuboard5 (forg.kr, 2019): no captured list wears a skin the
 *   museum holds.
 *
 * A list follows its board (`boardSkin`). A post's comments follow the
 * capture they came from (`captureSkin`): for 919 posts the two differ —
 * Zeroboard-era captures on boards whose index is Gnuboard4 (FunBoard,
 * porato, Trash, Reveal, Shop) — and those comments keep the strip they
 * were captured in. The 2001 skins are `skins-2001.ts`.
 */

import { getBoard, type BoardId, type BoardMeta } from "@/lib/boards";
import type { SourceEngine } from "@/types/post";

export type ListSkin = "kritz" | "webbus" | "plain";

function skinOf(engine: SourceEngine): ListSkin {
  if (engine === "zeroboard") return "kritz";
  if (engine === "gnuboard4") return "webbus";
  return "plain";
}

/** The skin a board's list is drawn in. */
export function boardSkin(board: Pick<BoardMeta, "engine">): ListSkin {
  return skinOf(board.engine);
}

/** The skin a post's comments are drawn in: its capture's own. */
export function captureSkin(post: { sourceEngine: SourceEngine }): ListSkin {
  return skinOf(post.sourceEngine);
}

/**
 * Gnuboard4 `bo_hot`: a `webbus` row got `icon_hot.gif` once its hits reached
 * the board's threshold (`BoardMeta.hotHits`, else 500). Recovered from the
 * 13 captured `webbus2009_basic` lists — 500, with UoBoard2 at 100, matches
 * all 262 rows that print a hit count; 500 everywhere matches 244, 100
 * everywhere 173, and "10 or more comments" 107. A row whose hit count did
 * not survive is never hot.
 */
export function isHot(board: BoardId, hits: number | null): boolean {
  return hits !== null && hits >= (getBoard(board).hotHits ?? 500);
}
