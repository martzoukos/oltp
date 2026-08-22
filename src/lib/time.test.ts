import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRESET,
  formatDuration,
  presetWindow,
  resolveWindow,
  shiftWindow,
  timeAgo,
  WINDOW_PRESETS,
} from "./time";

const NOW = 1_787_326_212_929;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("timeAgo", () => {
  it("formats past timestamps with the largest sensible unit", () => {
    expect(timeAgo(NOW - 5_000, NOW)).toBe("5s ago");
    expect(timeAgo(NOW - 45_000, NOW)).toBe("45s ago");
    expect(timeAgo(NOW - 90_000, NOW)).toBe("1m ago"); // floors to minutes
    expect(timeAgo(NOW - 5 * MINUTE, NOW)).toBe("5m ago");
    expect(timeAgo(NOW - 2 * HOUR, NOW)).toBe("2h ago");
    expect(timeAgo(NOW - 26 * HOUR, NOW)).toBe("1d ago");
  });

  it("handles just-now and slightly-future timestamps", () => {
    expect(timeAgo(NOW - 500, NOW)).toBe("now");
    // Client clock behind the server: never "in 3s".
    expect(timeAgo(NOW + 3_000, NOW)).toBe("now");
  });
});

describe("formatDuration", () => {
  it("uses the largest unit with a remainder, keeping hours up to 47h", () => {
    expect(formatDuration(30_000)).toBe("30s");
    expect(formatDuration(90_000)).toBe("1m 30s");
    expect(formatDuration(30 * MINUTE)).toBe("30m");
    expect(formatDuration(HOUR + 30 * MINUTE)).toBe("1h 30m");
    // Matches the "Last 24 hours" preset — never "1d".
    expect(formatDuration(DAY)).toBe("24h");
    expect(formatDuration(36 * HOUR)).toBe("36h");
    expect(formatDuration(2 * DAY)).toBe("2d");
    expect(formatDuration(7 * DAY + 6 * HOUR)).toBe("7d 6h");
  });
});

describe("window presets", () => {
  it("computes [now - duration, now] for each preset", () => {
    const expected = { "30m": 30 * MINUTE, "1h": HOUR, "6h": 6 * HOUR, "24h": DAY, "7d": 7 * DAY };
    expect(WINDOW_PRESETS.map((p) => p.id)).toEqual(Object.keys(expected));
    for (const preset of WINDOW_PRESETS) {
      const window = presetWindow(preset.id, NOW);
      expect(window.toMs).toBe(NOW);
      expect(window.fromMs).toBe(NOW - expected[preset.id]);
    }
    expect(DEFAULT_PRESET).toBe("24h");
  });
});

describe("shiftWindow", () => {
  it("prev shifts the window back by its own length", () => {
    const shifted = shiftWindow({ kind: "preset", preset: "1h" }, "prev", NOW);
    expect(resolveWindow(shifted, NOW)).toEqual({ fromMs: NOW - 2 * HOUR, toMs: NOW - HOUR });
  });

  it("next shifts forward by its own length without clamping to now", () => {
    // A future window renders the empty state; prev returns to data.
    const shifted = shiftWindow(
      { kind: "fixed", fromMs: NOW - HOUR, toMs: NOW },
      "next",
      NOW,
    );
    expect(resolveWindow(shifted, NOW)).toEqual({ fromMs: NOW, toMs: NOW + HOUR });
  });

  it("a shifted window becomes a fixed range, not a live preset", () => {
    const shifted = shiftWindow({ kind: "preset", preset: "1h" }, "prev", NOW);
    expect(shifted.kind).toBe("fixed");
    // Fixed ranges no longer follow the clock.
    const later = NOW + 10 * MINUTE;
    expect(resolveWindow(shifted, later)).toEqual(resolveWindow(shifted, NOW));
  });
});
