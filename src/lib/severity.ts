// severityNumber -> bucket, and bucket -> dash0-style legend group.
// OTel ranges: 1-4 TRACE, 5-8 DEBUG, 9-12 INFO, 13-16 WARN, 17-20 ERROR,
// 21-24 FATAL; 0 (and anything out of range) is UNSPECIFIED -> UNKNOWN.

export type SeverityBucket =
  | "TRACE"
  | "DEBUG"
  | "INFO"
  | "WARN"
  | "ERROR"
  | "FATAL"
  | "UNKNOWN";

export function severityBucket(severityNumber: number): SeverityBucket {
  if (severityNumber >= 1 && severityNumber <= 4) return "TRACE";
  if (severityNumber >= 5 && severityNumber <= 8) return "DEBUG";
  if (severityNumber >= 9 && severityNumber <= 12) return "INFO";
  if (severityNumber >= 13 && severityNumber <= 16) return "WARN";
  if (severityNumber >= 17 && severityNumber <= 20) return "ERROR";
  if (severityNumber >= 21 && severityNumber <= 24) return "FATAL";
  return "UNKNOWN";
}

export type LegendGroup = "error" | "warn" | "info" | "trace" | "unknown";

const BUCKET_TO_GROUP: Record<SeverityBucket, LegendGroup> = {
  FATAL: "error",
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  DEBUG: "trace",
  TRACE: "trace",
  UNKNOWN: "unknown",
};

export function legendGroupOf(severityNumber: number): LegendGroup {
  return BUCKET_TO_GROUP[severityBucket(severityNumber)];
}

export interface LegendGroupDef {
  id: LegendGroup;
  label: string;
  severityNumbers: number[];
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

// Single source of truth for histogram stacking order and legend chips,
// most severe first. UNKNOWN lists 0 as its canonical number; membership
// checks go through legendGroupOf so out-of-range values land there too.
export const LEGEND_GROUPS: LegendGroupDef[] = [
  { id: "error", label: "Error & Fatal", severityNumbers: range(17, 24) },
  { id: "warn", label: "Warn", severityNumbers: range(13, 16) },
  { id: "info", label: "Info", severityNumbers: range(9, 12) },
  { id: "trace", label: "Trace & Debug", severityNumbers: range(1, 8) },
  { id: "unknown", label: "Unknown", severityNumbers: [0] },
];
