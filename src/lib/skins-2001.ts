/**
 * The Zeroboard 4.0 skins forg's boards wore in 2001 (ADR-0019).
 *
 * Nine of them share one template, credited "skin by N+gine", and differ only
 * in their palette and image files (`.docs` research: skins-2001). `n_board`
 * (Notice, Events) is a separate template with a date column first and no
 * comments. Each board takes the skin of its last 2001 capture; a board that
 * did not exist in 2001 takes `board`, the plain grey one most boards wore.
 *
 * The images were fetched into `public/img/chrome/2001/zb/{skin}/` from the
 * captures' own URLs. What Wayback never kept — every skin's `title_bg.gif`
 * and `dot_line.gif`, used only as table backgrounds — is drawn in CSS.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { BoardId } from "@/lib/boards";

export type Skin2001 = "skyblue" | "board" | "pink" | "yellow" | "y" | "htred" | "n_board";

const BOARD_SKIN: Partial<Record<BoardId, Skin2001>> = {
  Q_A: "skyblue",
  Diablo_QA: "skyblue",
  UoBoard: "board",
  UOForum: "board",
  DiabloBoard: "board",
  ScreenShot: "pink",
  screen: "pink",
  Role: "yellow",
  FunBoard: "y",
  Sell: "htred",
  Notice: "n_board",
  Events: "n_board",
  Diablo_Notice: "n_board",
};

export function skin2001Of(board: BoardId): Skin2001 {
  return BOARD_SKIN[board] ?? "board";
}

/** Label-cell background and the accent (numbers, rules, form border). */
export const PALETTE_2001: Readonly<Record<Skin2001, { label: string; accent: string }>> = {
  skyblue: { label: "#e5eef9", accent: "#0063ce" },
  board: { label: "#f2f2f2", accent: "#404040" },
  yellow: { label: "#f2f2f2", accent: "#404040" },
  y: { label: "#f2f2f2", accent: "#404040" },
  pink: { label: "#fae8f0", accent: "#f20273" },
  htred: { label: "#ffefef", accent: "#f75200" },
  n_board: { label: "#f2f2f2", accent: "#9f9f9f" },
};

const ROOT = join(process.cwd(), "public", "img", "chrome", "2001", "zb");

function listFiles(dir: string, prefix = ""): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? listFiles(join(dir, e.name), `${prefix}${e.name}/`)
        : e.name.startsWith(".")
          ? []
          : [`${prefix}${e.name}`],
    );
  } catch {
    return [];
  }
}

const POOLS: ReadonlyMap<Skin2001, ReadonlySet<string>> = new Map(
  (Object.keys(PALETTE_2001) as Skin2001[]).map((skin) => [
    skin,
    new Set(listFiles(join(ROOT, skin))),
  ]),
);

/** URL of a recovered skin image, or null when Wayback never kept it. */
export function skinAsset2001(skin: Skin2001, file: string): string | null {
  return POOLS.get(skin)?.has(file) ? `/img/chrome/2001/zb/${skin}/${file}` : null;
}
