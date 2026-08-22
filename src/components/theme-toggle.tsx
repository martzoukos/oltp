"use client";

// Hand-rolled theme toggle: system preference is the default; an explicit
// choice is stored in localStorage and applied pre-hydration by the inline
// script in layout.tsx. Not URL state — a shared link shouldn't force a theme.
// The html class is the source of truth, observed via useSyncExternalStore.

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  // Follow live OS theme changes while no explicit choice is stored.
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      try {
        if (localStorage.getItem("theme")) return;
      } catch {
        // storage unavailable — treat as no explicit choice
      }
      document.documentElement.classList.toggle("dark", mq.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false, // SSR snapshot; corrected on hydration
  );

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // storage unavailable (private mode) — the toggle still works for the session
    }
  };

  return (
    <Button variant="outline" size="icon-sm" aria-label="Toggle theme" onClick={toggle}>
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}
