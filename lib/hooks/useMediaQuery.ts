"use client";

import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string, serverFallback = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverFallback,
  );
}

/** iPad / desktop (tailwind's `md`): sheets become centred dialogs, the tab bar becomes a sidebar. */
export const DESKTOP_QUERY = "(min-width: 768px) and (min-height: 540px)";

export function useIsDesktop() {
  return useMediaQuery(DESKTOP_QUERY);
}
