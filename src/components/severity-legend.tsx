"use client";

// Legend chips under the histogram double as the severity filter (dash0
// pattern): empty selection = no filter (all groups shown); toggling chips
// builds a union; × clears. Counts reflect the current time window.

import { X } from "lucide-react";
import { GROUP_DOT_CLASSES } from "@/components/severity-badge";
import type { FlatLog } from "@/lib/flatten";
import { LEGEND_GROUPS, legendGroupOf, type LegendGroup } from "@/lib/severity";
import { cn } from "@/lib/utils";

export function SeverityLegend({
  logs,
  severities,
  onChange,
}: {
  logs: FlatLog[]; // window-filtered, NOT severity-filtered — counts stay stable
  severities: LegendGroup[];
  onChange: (severities: LegendGroup[]) => void;
}) {
  const counts = new Map<LegendGroup, number>();
  for (const log of logs) {
    const group = legendGroupOf(log.severityNumber);
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }

  const toggle = (group: LegendGroup) => {
    onChange(
      severities.includes(group)
        ? severities.filter((g) => g !== group)
        : [...severities, group],
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2" data-severity-legend>
      {LEGEND_GROUPS.map((group) => {
        const active = severities.length === 0 || severities.includes(group.id);
        return (
          <button
            key={group.id}
            type="button"
            onClick={() => toggle(group.id)}
            aria-pressed={severities.includes(group.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs tabular-nums transition-colors hover:bg-accent",
              active ? "text-foreground" : "text-muted-foreground opacity-55",
            )}
          >
            <span
              className={cn("size-2 rounded-[2px]", GROUP_DOT_CLASSES[group.id])}
              aria-hidden
            />
            {group.label}
            <span className="text-muted-foreground">{counts.get(group.id) ?? 0}</span>
          </button>
        );
      })}
      {severities.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          aria-label="Clear severity filter"
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3" aria-hidden />
          Clear
        </button>
      )}
    </div>
  );
}
