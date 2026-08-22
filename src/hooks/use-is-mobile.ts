"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 639px)"; // below Tailwind's sm breakpoint

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false, // SSR: assume desktop; corrects on hydration
  );
}
