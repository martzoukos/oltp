"use client";

// Virtualized log table. Flat view sorts through TanStack Table's sorted row
// model; grouped view hand-rolls service groups (TanStack's grouped model
// cannot order groups by aggregate count desc) and virtualizes a mixed list
// of header and log rows. Sort state is URL state (nuqs) — headers write it
// directly; the table consumes it read-only.

import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GroupHeaderRow } from "@/components/group-header-row";
import { SeverityBadge } from "@/components/severity-badge";
import { TimeCell } from "@/components/time-cell";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { groupByService } from "@/lib/filter";
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
// Stacked two-line mobile rows: badge + time on line one, body below.
const MOBILE_ROW_HEIGHT: Record<"1" | "3", number> = { "1": 56, "3": 92 };
const GROUP_HEADER_HEIGHT = 40;

type SortColumn = "time" | "severity";

type TableItem =
  | { type: "log"; log: FlatLog }
  | { type: "header"; group: ReturnType<typeof groupByService>[number] };

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

// Same semantics as the flat view's TanStack sort, applied within each group.
function comparator(sort: SortState): (a: FlatLog, b: FlatLog) => number {
  const [column, direction] = sort.split(".") as [SortColumn, "asc" | "desc"];
  const key = column === "time" ? "timeMs" : "severityNumber";
  const sign = direction === "asc" ? 1 : -1;
  return (a, b) => sign * (a[key] - b[key]);
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
  view,
  density,
  sort,
  onSortChange,
  selectedId,
  onSelect,
  expandedKeys,
  onToggleGroup,
}: {
  logs: FlatLog[];
  nowMs: number;
  view: "flat" | "grouped";
  density: "1" | "3";
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  selectedId: string | null;
  onSelect: (log: FlatLog) => void;
  expandedKeys: ReadonlySet<string>;
  onToggleGroup: (serviceKey: string) => void;
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

  const sortedRows = table.getSortedRowModel().rows;

  const items = useMemo<TableItem[]>(() => {
    if (view === "flat") {
      return sortedRows.map((row) => ({ type: "log", log: row.original }));
    }
    const compare = comparator(sort);
    return groupByService(logs).flatMap((group): TableItem[] => [
      { type: "header", group },
      ...(expandedKeys.has(group.serviceKey)
        ? [...group.logs].sort(compare).map((log): TableItem => ({ type: "log", log }))
        : []),
    ]);
  }, [view, sortedRows, logs, sort, expandedKeys]);

  const scrollRef = useRef<HTMLDivElement>(null);
  // Keyboard cursor: the outlined row that Up/Down move and Enter/Space open.
  // Hover and click park the cursor too, so movement continues from the last
  // row the user touched after the detail sheet closes.
  const [activeId, setActiveId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const rowHeight = isMobile ? MOBILE_ROW_HEIGHT[density] : ROW_HEIGHT[density];
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) =>
      items[index].type === "header" ? GROUP_HEADER_HEIGHT : rowHeight,
    getItemKey: (index) => {
      const item = items[index];
      return item.type === "header" ? `g:${item.group.serviceKey}` : item.log.id;
    },
    overscan: 10,
  });

  const activeItem = activeId
    ? items.find((item) => item.type === "log" && item.log.id === activeId)
    : undefined;

  const moveActive = (dir: 1 | -1) => {
    const currentIndex = activeId
      ? items.findIndex((item) => item.type === "log" && item.log.id === activeId)
      : -1;
    let next = currentIndex === -1 ? (dir === 1 ? 0 : items.length - 1) : currentIndex + dir;
    while (next >= 0 && next < items.length && items[next].type !== "log") next += dir;
    if (next < 0 || next >= items.length) return;
    const item = items[next];
    if (item.type !== "log") return;
    setActiveId(item.log.id);
    virtualizer.scrollToIndex(next, { align: "auto" });
  };

  const handleNavKey = (e: { key: string; preventDefault: () => void }, allowOpen: boolean) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(e.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && allowOpen && activeItem?.type === "log") {
      e.preventDefault();
      onSelect(activeItem.log);
    }
  };

  const onContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Enter/Space on a focused group-header button must only toggle the group.
    handleNavKey(e, e.target === e.currentTarget);
  };

  // Arrows work from first load, before anything has focus: keydowns whose
  // target is the page body (nothing focused) fall through to row navigation.
  // Focused controls and the open sheet are never the body, so their key
  // behavior is untouched. Ref keeps the listener stable across renders.
  const navRef = useRef(handleNavKey);
  navRef.current = handleNavKey;
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.target !== document.body || e.defaultPrevented) return;
      navRef.current(e, true);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <div role="table" aria-label="Log records" className="flex min-h-0 flex-1 flex-col">
      {/* On mobile the sort control moves to the toolbar dropdown. */}
      <div
        role="row"
        className={cn(ROW_GRID, "items-center border-b bg-muted/40 py-1.5 max-sm:hidden")}
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

      {items.length === 0 ? (
        <div className="grid flex-1 place-items-center p-8 text-sm text-muted-foreground">
          No logs in this range — widen the time window or refresh.
        </div>
      ) : (
        <div
          ref={scrollRef}
          data-logs-scroll
          tabIndex={0}
          aria-activedescendant={activeId ? `log-row-${activeId}` : undefined}
          onKeyDown={onContainerKeyDown}
          onFocus={(e) => {
            // Tab lands here with no cursor yet — park it on the first row.
            if (e.target === e.currentTarget && !activeItem) moveActive(1);
          }}
          className="min-h-0 flex-1 overflow-y-auto outline-none"
        >
          <div
            role="rowgroup"
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const item = items[virtualItem.index];
              const style = {
                transform: `translateY(${virtualItem.start}px)`,
                height: virtualItem.size,
              };
              if (item.type === "header") {
                return (
                  <div
                    key={`g:${item.group.serviceKey}`}
                    role="row"
                    className="absolute inset-x-0 top-0"
                    style={style}
                  >
                    <GroupHeaderRow
                      group={item.group}
                      expanded={expandedKeys.has(item.group.serviceKey)}
                      onToggle={() => onToggleGroup(item.group.serviceKey)}
                    />
                  </div>
                );
              }
              const log = item.log;
              const bodyClamp = density === "1" ? "line-clamp-1" : "line-clamp-3";
              return (
                <div
                  key={log.id}
                  id={`log-row-${log.id}`}
                  role="row"
                  data-log-row
                  data-severity={log.severityNumber}
                  aria-selected={selectedId === log.id}
                  onClick={() => {
                    setActiveId(log.id);
                    onSelect(log);
                  }}
                  onMouseEnter={() => setActiveId(log.id)}
                  data-active={activeId === log.id ? "true" : undefined}
                  className={cn(
                    isMobile
                      ? "flex flex-col gap-1 px-3 py-2"
                      : cn(
                          ROW_GRID,
                          // 1-line rows center their single line; 3-line rows
                          // top-align so the clamp reads from the top.
                          density === "1" ? "items-center" : "items-start py-2",
                        ),
                    "absolute inset-x-0 top-0 cursor-pointer border-b hover:bg-accent/60",
                    selectedId === log.id && "bg-accent",
                    activeId === log.id && "bg-accent/40 ring-1 ring-inset ring-ring/40",
                  )}
                  style={style}
                >
                  {isMobile ? (
                    <>
                      <div role="cell" data-mobile-row-meta className="flex items-center gap-2">
                        <SeverityBadge
                          severityNumber={log.severityNumber}
                          severityText={log.severityText}
                        />
                        <TimeCell timeMs={log.timeMs} nowMs={nowMs} />
                      </div>
                      <div
                        role="cell"
                        data-log-body
                        className={cn(
                          "min-w-0 font-mono text-xs leading-5 whitespace-pre-wrap break-all",
                          bodyClamp,
                        )}
                      >
                        {log.body}
                      </div>
                    </>
                  ) : (
                    <>
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
                          bodyClamp,
                        )}
                      >
                        {log.body}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
