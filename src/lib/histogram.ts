// Histogram bucketing: nice bucket sizes, per-severity-group counts, and
// pixel-drag -> time-range snapping. Buckets are aligned to window.fromMs and
// the window is half-open [fromMs, toMs).

import type { FlatLog } from "./flatten";
import { legendGroupOf, LEGEND_GROUPS, type LegendGroup } from "./severity";
import type { TimeWindow } from "./time";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export const NICE_BUCKETS_MS = [
  SECOND,
  2 * SECOND,
  5 * SECOND,
  10 * SECOND,
  30 * SECOND,
  MINUTE,
  2 * MINUTE,
  5 * MINUTE,
  10 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  2 * HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  24 * HOUR,
];

// Smallest nice bucket that keeps the bar count at or under 60.
export function chooseBucketSize(windowMs: number): number {
  for (const bucket of NICE_BUCKETS_MS) {
    if (windowMs / bucket <= 60) return bucket;
  }
  return NICE_BUCKETS_MS[NICE_BUCKETS_MS.length - 1];
}

export interface HistogramBucket {
  startMs: number;
  counts: Record<LegendGroup, number>;
  total: number;
}

export interface Histogram {
  bucketMs: number;
  buckets: HistogramBucket[];
}

function emptyCounts(): Record<LegendGroup, number> {
  return Object.fromEntries(LEGEND_GROUPS.map((g) => [g.id, 0])) as Record<
    LegendGroup,
    number
  >;
}

export function bucketize(logs: FlatLog[], window: TimeWindow): Histogram {
  const windowMs = window.toMs - window.fromMs;
  const bucketMs = chooseBucketSize(windowMs);
  const bucketCount = Math.ceil(windowMs / bucketMs);
  const buckets: HistogramBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    startMs: window.fromMs + i * bucketMs,
    counts: emptyCounts(),
    total: 0,
  }));
  for (const log of logs) {
    if (log.timeMs < window.fromMs || log.timeMs >= window.toMs) continue;
    const bucket = buckets[Math.floor((log.timeMs - window.fromMs) / bucketMs)];
    bucket.counts[legendGroupOf(log.severityNumber)]++;
    bucket.total++;
  }
  return { bucketMs, buckets };
}

// Clean y-axis tick values (1/2/5 × 10^n steps, ~3 ticks) for a histogram
// whose tallest bar is maxCount. Excludes 0 — the baseline carries it.
export function countTicks(maxCount: number): number[] {
  if (maxCount <= 0) return [];
  const raw = maxCount / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(
    1,
    [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!,
  );
  const ticks: number[] = [];
  for (let value = step; value <= maxCount; value += step) ticks.push(value);
  return ticks;
}

// Maps a horizontal drag over the chart to a time range snapped outward to
// bucket boundaries. A sub-bucket drag selects the single bucket under it,
// so a click and a tiny drag behave identically.
export function pixelRangeToWindow(
  x0: number,
  x1: number,
  chartWidth: number,
  window: TimeWindow,
): TimeWindow {
  const windowMs = window.toMs - window.fromMs;
  const bucketMs = chooseBucketSize(windowMs);
  const bucketCount = Math.ceil(windowMs / bucketMs);
  const clamp = (x: number) => Math.min(Math.max(x, 0), chartWidth);
  const [lo, hi] = [clamp(Math.min(x0, x1)), clamp(Math.max(x0, x1))];
  const toIndex = (x: number) =>
    Math.min(Math.floor((x / chartWidth) * bucketCount), bucketCount - 1);
  const firstBucket = toIndex(lo);
  const lastBucket = toIndex(hi);
  return {
    fromMs: window.fromMs + firstBucket * bucketMs,
    toMs: Math.min(window.fromMs + (lastBucket + 1) * bucketMs, window.toMs),
  };
}
