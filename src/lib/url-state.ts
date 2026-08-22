// nuqs parsers for every shareable piece of UI state. URL and React state are
// the same thing — components read/write these hooks directly, never a synced copy.

import { createParser, parseAsArrayOf, parseAsStringLiteral } from "nuqs";
import type { LegendGroup } from "./severity";
import { DEFAULT_PRESET, WINDOW_PRESETS, type WindowState } from "./time";

const PRESET_IDS = WINDOW_PRESETS.map((p) => p.id);

// "24h" (live preset) or "1787326212929-1787326216529" (fixed absolute range).
export const parseAsWindowState = createParser<WindowState>({
  parse(value) {
    const preset = PRESET_IDS.find((id) => id === value);
    if (preset) return { kind: "preset", preset };
    const match = /^(\d+)-(\d+)$/.exec(value);
    if (match) {
      const fromMs = Number(match[1]);
      const toMs = Number(match[2]);
      if (fromMs < toMs) return { kind: "fixed", fromMs, toMs };
    }
    return null;
  },
  serialize(state) {
    return state.kind === "preset" ? state.preset : `${state.fromMs}-${state.toMs}`;
  },
  eq(a, b) {
    return a.kind === "preset"
      ? b.kind === "preset" && a.preset === b.preset
      : b.kind === "fixed" && a.fromMs === b.fromMs && a.toMs === b.toMs;
  },
});

export const windowParser = parseAsWindowState.withDefault({
  kind: "preset",
  preset: DEFAULT_PRESET,
});

export const viewParser = parseAsStringLiteral(["flat", "grouped"]).withDefault("flat");

export type SortState = "time.desc" | "time.asc" | "severity.desc" | "severity.asc";

export const sortParser = parseAsStringLiteral<SortState>([
  "time.desc",
  "time.asc",
  "severity.desc",
  "severity.asc",
]).withDefault("time.desc");

export const densityParser = parseAsStringLiteral(["1", "3"]).withDefault("1");

const LEGEND_IDS = ["error", "warn", "info", "trace", "unknown"] as const;

// Empty array = no filter = all severities shown.
export const severitiesParser = parseAsArrayOf(
  parseAsStringLiteral<LegendGroup>(LEGEND_IDS),
).withDefault([]);
