import { legendGroupOf, severityBucket, type LegendGroup } from "@/lib/severity";
import { cn } from "@/lib/utils";

// Full literal class strings so Tailwind's scanner picks them up.
export const GROUP_CLASSES: Record<LegendGroup, string> = {
  error: "text-severity-error-ink bg-severity-error/12",
  warn: "text-severity-warn-ink bg-severity-warn/12",
  info: "text-severity-info-ink bg-severity-info/12",
  trace: "text-severity-trace-ink bg-severity-trace/12",
  unknown: "text-severity-unknown-ink bg-severity-unknown/12",
};

export const GROUP_DOT_CLASSES: Record<LegendGroup, string> = {
  error: "bg-severity-error",
  warn: "bg-severity-warn",
  info: "bg-severity-info",
  trace: "bg-severity-trace",
  unknown: "bg-severity-unknown",
};

export function SeverityBadge({
  severityNumber,
  severityText,
  className,
}: {
  severityNumber: number;
  severityText?: string;
  className?: string;
}) {
  const group = legendGroupOf(severityNumber);
  const label = severityText || severityBucket(severityNumber);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-px font-mono text-[11px] font-medium uppercase tracking-wide",
        GROUP_CLASSES[group],
        className,
      )}
    >
      {label}
    </span>
  );
}
