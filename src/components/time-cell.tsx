import { timeAgo } from "@/lib/time";

function fullTimestamp(timeMs: number): string {
  return new Date(timeMs).toISOString();
}

// Relative time with the precise timestamp one hover away (title attribute).
export function TimeCell({ timeMs, nowMs }: { timeMs: number; nowMs: number }) {
  return (
    <span
      title={fullTimestamp(timeMs)}
      className="font-mono text-xs text-muted-foreground tabular-nums"
    >
      {timeAgo(timeMs, nowMs)}
    </span>
  );
}
