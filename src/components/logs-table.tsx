"use client";

// Virtualized log table over TanStack Table's sorted row model. Sort state is
// URL state (nuqs) — headers write it directly; the table consumes it read-only.

import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useRef } from "react";
import { SeverityBadge } from "@/components/severity-badge";
import { TimeCell } from "@/components/time-cell";
import type { FlatLog } from "@/lib/flatten";
import type { SortState } from "@/lib/url-state";
import { cn } from "@/lib/utils";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

const helper = createColumnHelper<typeof features, FlatLog>();

const columns = helper.columns([
  helper.accessor("severityNumber", { id: "severity" }),
  helper.accessor("timeMs", { id: "time" }),
  helper.accessor("body", { id: "body", enableSorting: false }),
]);

const ROW_GRID = "grid grid-cols-[7rem_6.5rem_1fr] gap-x-3 px-3";
const ROW_HEIGHT: Record<"1" | "3", number> = { "1": 36, "3": 68 };

type SortColumn = "time" | "severity";

function nextSort(column: SortColumn, current: SortState): SortState {
  const [currentColumn, direction] = current.split(".") as [SortColumn, "asc" | "desc"];
  if (currentColumn !== column) return `${column}.asc`;
  return `${column}.${direction === "asc" ? "desc" : "asc"}`;
}

function ariaSort(column: SortColumn, sort: SortState): "ascending" | "descending" | undefined {
  const [sortColumn, direction] = sort.split(".") as [SortColumn, "asc" | "desc"];
  if (sortColumn !== column) return undefined;
  return direction === "asc" ? "ascending" : "descending";
}

function SortHeader({
  column,
  label,
  sort,
  onSortChange,
}: {
  column: SortColumn;
  label: string;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
}) {
  const [sortColumn, direction] = sort.split(".") as [SortColumn, "asc" | "desc"];
  const active = sortColumn === column;
  return (
    <button
      type="button"
      onClick={() => onSortChange(nextSort(column, sort))}
      className={cn(
        "inline-flex items-center gap-1 text-left text-xs font-medium",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {active ? (
        direction === "asc" ? (
          <ArrowUp className="size-3" aria-hidden />
        ) : (
          <ArrowDown className="size-3" aria-hidden />
        )
      ) : (
        <ChevronsUpDown className="size-3 opacity-50" aria-hidden />
      )}
    </button>
  );
}

export function LogsTable({
  logs,
  nowMs,
  density,
  sort,
  onSortChange,
  selectedId,
  onSelect,
}: {
  logs: FlatLog[];
  nowMs: number;
  density: "1" | "3";
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  selectedId: string | null;
  onSelect: (log: FlatLog) => void;
}) {
  const sorting = useMemo(() => {
    const [column, direction] = sort.split(".");
    return [{ id: column, desc: direction === "desc" }];
  }, [sort]);

  const table = useTable({
    features,
    columns,
    data: logs,
    state: { sorting },
    getRowId: (log: FlatLog) => log.id,
  });

  const rows = table.getSortedRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowHeight = ROW_HEIGHT[density];
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    getItemKey: (index) => rows[index].id,
    overscan: 10,
  });

  return (
    <div role="table" aria-label="Log records" className="flex min-h-0 flex-1 flex-col">
      <div
        role="row"
        className={cn(ROW_GRID, "items-center border-b bg-muted/40 py-1.5")}
      >
        <div role="columnheader" aria-sort={ariaSort("severity", sort)}>
          <SortHeader column="severity" label="Severity" sort={sort} onSortChange={onSortChange} />
        </div>
        <div role="columnheader" aria-sort={ariaSort("time", sort)}>
          <SortHeader column="time" label="Time" sort={sort} onSortChange={onSortChange} />
        </div>
        <div role="columnheader" className="text-xs font-medium text-muted-foreground">
          Body
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="grid flex-1 place-items-center p-8 text-sm text-muted-foreground">
          No logs in this range — widen the time window or refresh.
        </div>
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div
            role="rowgroup"
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const log = rows[item.index].original;
              return (
                <div
                  key={log.id}
                  role="row"
                  data-log-row
                  aria-selected={selectedId === log.id}
                  onClick={() => onSelect(log)}
                  className={cn(
                    ROW_GRID,
                    "absolute inset-x-0 top-0 cursor-pointer items-start border-b py-2 hover:bg-accent/60",
                    selectedId === log.id && "bg-accent",
                  )}
                  style={{ transform: `translateY(${item.start}px)`, height: item.size }}
                >
                  <div role="cell">
                    <SeverityBadge
                      severityNumber={log.severityNumber}
                      severityText={log.severityText}
                    />
                  </div>
                  <div role="cell">
                    <TimeCell timeMs={log.timeMs} nowMs={nowMs} />
                  </div>
                  <div
                    role="cell"
                    data-log-body
                    className={cn(
                      "min-w-0 font-mono text-xs leading-5 whitespace-pre-wrap break-all",
                      density === "1" ? "line-clamp-1" : "line-clamp-3",
                    )}
                  >
                    {log.body}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
