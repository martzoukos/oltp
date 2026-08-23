import { describe, expect, it } from "vitest";
import type { FlatLog } from "./flatten";
import {
  bucketize,
  chooseBucketSize,
  countTicks,
  NICE_BUCKETS_MS,
  pixelRangeToWindow,
} from "./histogram";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const T0 = 1_787_320_000_000;

function logAt(timeMs: number, severityNumber: number): FlatLog {
  return {
    id: String(timeMs),
    timeMs,
    severityNumber,
    body: "",
    attributes: {},
    serviceKey: "svc",
    serviceName: "svc",
    scopeAttributes: {},
    resourceAttributes: {},
  };
}

describe("chooseBucketSize", () => {
  it("picks nice units yielding <=60 bars per preset window", () => {
    expect(chooseBucketSize(30 * MINUTE)).toBe(30 * SECOND); // 60 bars
    expect(chooseBucketSize(HOUR)).toBe(MINUTE); // 60 bars
    expect(chooseBucketSize(6 * HOUR)).toBe(10 * MINUTE); // 36 bars
    expect(chooseBucketSize(DAY)).toBe(30 * MINUTE); // 48 bars
    expect(chooseBucketSize(7 * DAY)).toBe(3 * HOUR); // 56 bars
  });

  it("keeps odd custom windows within 25-60 bars using nice units", () => {
    for (const windowMs of [100 * MINUTE, 45 * MINUTE, 3 * HOUR, 5 * DAY, 90 * MINUTE]) {
      const bucket = chooseBucketSize(windowMs);
      expect(NICE_BUCKETS_MS).toContain(bucket);
      const bars = windowMs / bucket;
      expect(bars).toBeGreaterThanOrEqual(25);
      expect(bars).toBeLessThanOrEqual(60);
    }
  });
});

describe("bucketize", () => {
  // 10m window -> 10s buckets (60 bars).
  const window = { fromMs: T0, toMs: T0 + 10 * MINUTE };

  it("counts logs per bucket per legend group", () => {
    const logs = [
      logAt(T0 + 5 * SECOND, 18), // error group, bucket 0
      logAt(T0 + 7 * SECOND, 22), // fatal -> error group, bucket 0
      logAt(T0 + 13 * SECOND, 13), // warn, bucket 1
      logAt(T0 + 25 * SECOND, 9), // info, bucket 2
      logAt(T0 + 25 * SECOND, 2), // trace group, bucket 2
      logAt(T0 + 25 * SECOND, 0), // unknown, bucket 2
    ];
    const { bucketMs, buckets } = bucketize(logs, window);
    expect(bucketMs).toBe(10 * SECOND);
    expect(buckets[0].counts.error).toBe(2);
    expect(buckets[0].total).toBe(2);
    expect(buckets[1].counts.warn).toBe(1);
    expect(buckets[2].counts).toEqual({ error: 0, warn: 0, info: 1, trace: 1, unknown: 1 });
    expect(buckets[2].total).toBe(3);
  });

  it("excludes logs outside the half-open [from, to) window", () => {
    const logs = [
      logAt(window.fromMs - 1, 18),
      logAt(window.toMs + 1, 18),
      logAt(window.fromMs, 18), // exactly at from: included
      logAt(window.toMs, 18), // exactly at to: excluded
    ];
    const { buckets } = bucketize(logs, window);
    const total = buckets.reduce((n, b) => n + b.total, 0);
    expect(total).toBe(1);
    expect(buckets[0].counts.error).toBe(1);
  });

  it("emits empty buckets so the time axis is continuous", () => {
    const logs = [logAt(T0 + 30 * SECOND, 9)];
    const { buckets } = bucketize(logs, window);
    expect(buckets).toHaveLength(60);
    expect(buckets.filter((b) => b.total === 0)).toHaveLength(59);
    expect(buckets[59].startMs).toBe(window.toMs - 10 * SECOND);
  });
});

describe("countTicks", () => {
  it("returns clean integer steps covering up to the max count", () => {
    expect(countTicks(1)).toEqual([1]);
    expect(countTicks(3)).toEqual([1, 2, 3]);
    expect(countTicks(7)).toEqual([5]);
    expect(countTicks(30)).toEqual([10, 20, 30]);
    expect(countTicks(100)).toEqual([50, 100]);
    expect(countTicks(1234)).toEqual([500, 1000]);
  });

  it("never emits fractional or zero ticks", () => {
    for (const max of [1, 2, 4, 9, 17, 55, 999, 12345]) {
      const ticks = countTicks(max);
      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks.length).toBeLessThanOrEqual(4);
      for (const tick of ticks) {
        expect(Number.isInteger(tick)).toBe(true);
        expect(tick).toBeGreaterThan(0);
        expect(tick).toBeLessThanOrEqual(max);
      }
    }
  });

  it("returns no ticks when there is no data", () => {
    expect(countTicks(0)).toEqual([]);
  });
});

describe("pixelRangeToWindow", () => {
  // 600px chart over a 1h window -> 60 x 1m buckets, 10px per bucket.
  const window = { fromMs: T0, toMs: T0 + HOUR };

  it("maps a drag in pixels to a time range snapped to bucket boundaries", () => {
    const range = pixelRangeToWindow(123, 247, 600, window);
    expect(range).toEqual({ fromMs: T0 + 12 * MINUTE, toMs: T0 + 25 * MINUTE });
  });

  it("normalizes a reversed drag", () => {
    expect(pixelRangeToWindow(247, 123, 600, window)).toEqual(
      pixelRangeToWindow(123, 247, 600, window),
    );
  });

  it("returns one full bucket for a sub-bucket drag, same as a click", () => {
    const range = pixelRangeToWindow(123, 125, 600, window);
    expect(range).toEqual({ fromMs: T0 + 12 * MINUTE, toMs: T0 + 13 * MINUTE });
  });

  it("clamps out-of-bounds coordinates to the chart", () => {
    expect(pixelRangeToWindow(-20, 700, 600, window)).toEqual(window);
  });
});
