"use client";

import { useSyncExternalStore } from "react";

import { DAEMON_NAMES } from "@/lib/daemon-names";

// One draw per seed, kept for the page's life: getSnapshot must return the
// same value on every call, or React re-renders forever. The seed names the
// post or comment, so its copies (the phone list, the 2014/2003 table, the
// 2001 skin) keep one name when the era or the width changes.
const draws = new Map<string, string>();

function subscribeToNothing() {
  return () => {};
}

/**
 * A non-member's name on a board that showed a random daemon name on every
 * view (`BoardMeta.daemonGuestNames`). The static HTML keeps the name the
 * capture shows; the browser swaps in a fresh draw, the way the board did.
 */
export function DaemonName({ name, seed }: { name: string; seed: string }) {
  return useSyncExternalStore(
    subscribeToNothing,
    () => {
      let drawn = draws.get(seed);
      if (drawn === undefined) {
        drawn = DAEMON_NAMES[Math.floor(Math.random() * DAEMON_NAMES.length)] ?? name;
        draws.set(seed, drawn);
      }
      return drawn;
    },
    () => name,
  );
}
