"use client";

// Full-width expandable group header: chevron, service identity, log-count
// badge, and a mini severity-dot breakdown.

import { ChevronRight } from "lucide-react";
import { GROUP_DOT_CLASSES } from "@/components/severity-badge";
import { Badge } from "@/components/ui/badge";
import type { ServiceGroup } from "@/lib/filter";
import { LEGEND_GROUPS } from "@/lib/severity";
import { cn } from "@/lib/utils";

export function GroupHeaderRow({
  group,
  expanded,
  onToggle,
}: {
  group: ServiceGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      data-group-header={group.serviceKey}
      className="flex h-full w-full items-center gap-2 border-b bg-muted/30 px-3 text-left text-sm hover:bg-muted/60"
    >
      <ChevronRight
        className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")}
        aria-hidden
      />
      <span className="truncate font-medium">
        {group.serviceName}
        {group.serviceNamespace && (
          <span className="ml-1.5 font-normal text-muted-foreground">
            {group.serviceNamespace}
          </span>
        )}
      </span>
      <Badge variant="secondary" className="tabular-nums">
        {group.count}
      </Badge>
      <span className="ml-auto flex items-center gap-2">
        {LEGEND_GROUPS.filter((g) => group.severityCounts[g.id] > 0).map((g) => (
          <span
            key={g.id}
            className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums"
            title={g.label}
          >
            <span className={cn("size-2 rounded-[2px]", GROUP_DOT_CLASSES[g.id])} aria-hidden />
            {group.severityCounts[g.id]}
          </span>
        ))}
      </span>
    </button>
  );
}
