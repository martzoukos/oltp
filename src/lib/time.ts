// timeAgo formatting, window presets, and prev/next window shifting.

export interface TimeWindow {
  fromMs: number;
  toMs: number;
}

// Window state as it lives in the URL: a live preset follows the clock; a
// fixed range (produced by shifting, bucket clicks, or drag-select) does not.
export type WindowState =
  | { kind: "preset"; preset: WindowPresetId }
  | { kind: "fixed"; fromMs: number; toMs: number };

export type WindowPresetId = "30m" | "1h" | "6h" | "24h" | "7d";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const WINDOW_PRESETS: { id: WindowPresetId; label: string; ms: number }[] = [
  { id: "30m", label: "Last 30 minutes", ms: 30 * MINUTE },
  { id: "1h", label: "Last 1 hour", ms: HOUR },
  { id: "6h", label: "Last 6 hours", ms: 6 * HOUR },
  { id: "24h", label: "Last 24 hours", ms: DAY },
  { id: "7d", label: "Last 7 days", ms: 7 * DAY },
];

export const DEFAULT_PRESET: WindowPresetId = "24h";

export function presetWindow(preset: WindowPresetId, nowMs: number): TimeWindow {
  const def = WINDOW_PRESETS.find((p) => p.id === preset)!;
  return { fromMs: nowMs - def.ms, toMs: nowMs };
}

export function resolveWindow(state: WindowState, nowMs: number): TimeWindow {
  return state.kind === "preset"
    ? presetWindow(state.preset, nowMs)
    : { fromMs: state.fromMs, toMs: state.toMs };
}

// Shifting always yields a fixed range: once you navigate away from "now",
// the window must stop following the clock. Next is deliberately not clamped
// to now — a future window just renders the empty state, and prev undoes it.
export function shiftWindow(
  state: WindowState,
  direction: "prev" | "next",
  nowMs: number,
): WindowState {
  const { fromMs, toMs } = resolveWindow(state, nowMs);
  const length = toMs - fromMs;
  const delta = direction === "prev" ? -length : length;
  return { kind: "fixed", fromMs: fromMs + delta, toMs: toMs + delta };
}

export function timeAgo(timeMs: number, nowMs: number): string {
  const deltaMs = nowMs - timeMs;
  // Sub-second deltas and small future skew (client clock behind the server)
  // both read as "now" — never "in 3s".
  if (deltaMs < 1000) return "now";
  const rtf = new Intl.RelativeTimeFormat("en", { style: "narrow" });
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 60) return rtf.format(-seconds, "second");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.floor(hours / 24), "day");
}
