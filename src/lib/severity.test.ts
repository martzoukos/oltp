import { describe, expect, it } from "vitest";
import { LEGEND_GROUPS, legendGroupOf, severityBucket } from "./severity";

describe("severityBucket", () => {
  it("maps each OTel range to its bucket, exact at both edges", () => {
    expect(severityBucket(1)).toBe("TRACE");
    expect(severityBucket(4)).toBe("TRACE");
    expect(severityBucket(5)).toBe("DEBUG");
    expect(severityBucket(8)).toBe("DEBUG");
    expect(severityBucket(9)).toBe("INFO");
    expect(severityBucket(12)).toBe("INFO");
    expect(severityBucket(13)).toBe("WARN");
    expect(severityBucket(16)).toBe("WARN");
    expect(severityBucket(17)).toBe("ERROR");
    expect(severityBucket(20)).toBe("ERROR");
    expect(severityBucket(21)).toBe("FATAL");
    expect(severityBucket(24)).toBe("FATAL");
  });

  it("maps 0 and out-of-range numbers to UNKNOWN", () => {
    expect(severityBucket(0)).toBe("UNKNOWN");
    expect(severityBucket(-1)).toBe("UNKNOWN");
    expect(severityBucket(25)).toBe("UNKNOWN");
    expect(severityBucket(999)).toBe("UNKNOWN");
  });
});

describe("legend groups", () => {
  it("groups buckets into the five dash0-style legend chips", () => {
    expect(legendGroupOf(17)).toBe("error");
    expect(legendGroupOf(24)).toBe("error");
    expect(legendGroupOf(13)).toBe("warn");
    expect(legendGroupOf(9)).toBe("info");
    expect(legendGroupOf(1)).toBe("trace");
    expect(legendGroupOf(8)).toBe("trace");
    expect(legendGroupOf(0)).toBe("unknown");
    expect(legendGroupOf(99)).toBe("unknown");
  });

  it("exposes the group list in severity order for stacking and legend rendering", () => {
    expect(LEGEND_GROUPS.map((g) => g.id)).toEqual([
      "error",
      "warn",
      "info",
      "trace",
      "unknown",
    ]);
    expect(LEGEND_GROUPS.map((g) => g.label)).toEqual([
      "Error & Fatal",
      "Warn",
      "Info",
      "Trace & Debug",
      "Unknown",
    ]);
    // The severityNumbers each chip covers — the single source of truth that
    // histogram stacking and chip filtering both consume.
    const byId = Object.fromEntries(LEGEND_GROUPS.map((g) => [g.id, g.severityNumbers]));
    expect(byId.error).toEqual([17, 18, 19, 20, 21, 22, 23, 24]);
    expect(byId.warn).toEqual([13, 14, 15, 16]);
    expect(byId.info).toEqual([9, 10, 11, 12]);
    expect(byId.trace).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(byId.unknown).toEqual([0]);
    // Consistency: every listed number resolves back to its own group.
    for (const group of LEGEND_GROUPS) {
      for (const n of group.severityNumbers) {
        expect(legendGroupOf(n)).toBe(group.id);
      }
    }
  });
});
