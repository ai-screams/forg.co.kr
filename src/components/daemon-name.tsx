"use client";

import { useId, useSyncExternalStore } from "react";

import { DAEMON_NAMES } from "@/lib/daemon-names";

// One draw per name on a page, kept for the page's life: getSnapshot must
// return the same value on every call, or React re-renders forever.
const draws = new Map<string, string>();

function subscribeToNothing() {
  return () => {};
}

/**
 * A non-member's name on a board that showed a random daemon name on every
 * view (`BoardMeta.daemonGuestNames`). The static HTML keeps the name the
 * capture shows; the browser swaps in a fresh draw, the way the board did.
 */
export function DaemonName({ name }: { name: string }) {
  const id = useId();
  return useSyncExternalStore(
    subscribeToNothing,
    () => {
      const key = `${window.location.pathname}#${id}`;
      let drawn = draws.get(key);
      if (drawn === undefined) {
        drawn = DAEMON_NAMES[Math.floor(Math.random() * DAEMON_NAMES.length)] ?? name;
        draws.set(key, drawn);
      }
      return drawn;
    },
    () => name,
  );
}
