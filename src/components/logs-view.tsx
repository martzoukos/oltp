"use client";

// Page shell: dataset + URL state wiring for toolbar, histogram, legend
// filter, table, and detail sheet.

import { ListTree, Rows2, Rows4, Undo2 } from "lucide-react";
import Link from "next/link";
import { useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Histogram } from "@/components/histogram";
import { LogDetailsSheet } from "@/components/log-details-sheet";
import { LogsTable } from "@/components/logs-table";
import { SeverityLegend } from "@/components/severity-legend";
import { MobileSortMenu, Toolbar } from "@/components/toolbar";
import { useLogs } from "@/components/logs-provider";
import { formatDuration, resolveWindow, type WindowState } from "@/lib/time";
import {
  densityParser,
  severitiesParser,
  sortParser,
  viewParser,
  windowParser,
} from "@/lib/url-state";
import { legendGroupOf } from "@/lib/severity";

export function LogsView() {
  const { status, logs, error, fetchedAtMs, datasetId, refresh } = useLogs();
  const [windowState, setWindowState] = useQueryState("window", windowParser);
  const [view, setView] = useQueryState("view", viewParser);
  const [sort, setSort] = useQueryState("sort", sortParser);
  const [density, setDensity] = useQueryState("density", densityParser);
  const [severities, setSeverities] = useQueryState("severities", severitiesParser);

  // Selection references the dataset by FlatLog id; refresh invalidates ids,
  // so selection is cleared alongside refresh().
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Expanded group keys are ephemeral too — serviceKeys reference the dataset.
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set());
  // History of window states replaced by histogram zooms (bucket click or
  // drag-select), so a misclick is one "undo" away. Toolbar changes are
  // deliberate, so they clear the history instead of joining it.
  const [zoomStack, setZoomStack] = useState<WindowState[]>([]);

  // Preset windows anchor to fetch time — the dataset spans the 24h ending there.
  const nowMs = fetchedAtMs ?? 0;
  const window = resolveWindow(windowState, nowMs);

  // Window-filtered (legend counts stay stable while filtering) …
  const windowLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter((log) => log.timeMs >= window.fromMs && log.timeMs < window.toMs);
  }, [logs, window.fromMs, window.toMs]);

  // … then severity-filtered (drives histogram bars and table rows alike).
  const visibleLogs = useMemo(() => {
    if (severities.length === 0) return windowLogs;
    return windowLogs.filter((log) => severities.includes(legendGroupOf(log.severityNumber)));
  }, [windowLogs, severities]);

  if (status === "loading") {
    return (
      <main className="grid flex-1 place-items-center text-muted-foreground">
        Loading logs…
      </main>
    );
  }
  if (status === "error") {
    return (
      <main className="grid flex-1 place-items-center text-center">
        <div className="space-y-2">
          <p className="text-destructive">Failed to load logs: {error}</p>
          <Button variant="outline" size="sm" onClick={refresh}>
            Retry
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-6xl flex-col xl:border-x">
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <h1 className="text-sm font-semibold">
          {/* Home link: clears every URL param; ephemeral selection/expansion
              reference the dataset and must be cleared explicitly. */}
          <Link
            href="/"
            onClick={() => {
              setSelectedId(null);
              setExpandedKeys(new Set());
              setZoomStack([]);
            }}
          >
            Logs
          </Link>
        </h1>
        <span className="sr-only">view {view}</span>
        <div className="ml-auto">
          <Toolbar
            windowState={windowState}
            nowMs={nowMs}
            onWindowStateChange={(state) => {
              setZoomStack([]);
              void setWindowState(state);
            }}
            onRefresh={() => {
              setSelectedId(null);
              setExpandedKeys(new Set());
              // Preset entries would resolve against the new fetch time.
              setZoomStack([]);
              refresh();
            }}
          />
        </div>
      </header>

      <div className="border-b">
        {/* Span indicator: the histogram rescales silently on zoom, so its
            current extent must be legible without decoding the date range. */}
        <div className="flex h-6 items-center gap-1 px-3 pt-1.5">
          <span
            className="text-xs tabular-nums text-muted-foreground"
            data-window-span
            title="Histogram window length"
          >
            {formatDuration(window.toMs - window.fromMs)}
          </span>
          {zoomStack.length > 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-5 text-muted-foreground"
              aria-label="Undo zoom"
              onClick={() => {
                const previous = zoomStack[zoomStack.length - 1];
                setZoomStack((stack) => stack.slice(0, -1));
                void setWindowState(previous);
              }}
            >
              <Undo2 aria-hidden />
            </Button>
          )}
        </div>
        <Histogram
          logs={visibleLogs}
          window={window}
          onWindowChange={(next) => {
            // Full-width drags re-select the current window; no-op, don't
            // record an undo step for it.
            if (next.fromMs === window.fromMs && next.toMs === window.toMs) return;
            setZoomStack((stack) => [...stack, windowState]);
            void setWindowState({ kind: "fixed", fromMs: next.fromMs, toMs: next.toMs });
          }}
        />
        <SeverityLegend
          logs={windowLogs}
          severities={severities}
          onChange={(next) => void setSeverities(next)}
        />
      </div>

      {/* Table meta row: result count left, table-scoped controls right. */}
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <span className="text-xs text-muted-foreground" data-dataset-id={datasetId}>
          {visibleLogs.length} of {logs!.length} logs
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Toggle
            variant="outline"
            size="sm"
            pressed={view === "grouped"}
            onPressedChange={(pressed) => void setView(pressed ? "grouped" : "flat")}
            aria-label="Group by service"
          >
            <ListTree aria-hidden />
            <span className="max-sm:sr-only">Group by service</span>
          </Toggle>
          <Separator orientation="vertical" className="h-5" />
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={density}
            onValueChange={(value) => {
              if (value === "1" || value === "3") void setDensity(value);
            }}
            aria-label="Row density"
          >
            <ToggleGroupItem value="1" aria-label="Compact rows">
              <Rows4 aria-hidden />
              <span className="max-sm:sr-only">Compact</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="3" aria-label="Expanded rows">
              <Rows2 aria-hidden />
              <span className="max-sm:sr-only">Expanded</span>
            </ToggleGroupItem>
          </ToggleGroup>
          <MobileSortMenu sort={sort} onSortChange={(next) => void setSort(next)} />
        </div>
      </div>

      <LogsTable
        logs={visibleLogs}
        nowMs={nowMs}
        view={view}
        density={density}
        sort={sort}
        onSortChange={(next) => void setSort(next)}
        selectedId={selectedId}
        onSelect={(log) => setSelectedId(log.id)}
        expandedKeys={expandedKeys}
        onToggleGroup={(serviceKey) =>
          setExpandedKeys((keys) => {
            const next = new Set(keys);
            if (next.has(serviceKey)) next.delete(serviceKey);
            else next.add(serviceKey);
            return next;
          })
        }
      />
      {/* Selection references the dataset, not the filtered view: the sheet
          stays open even if its log is filtered out of the table. */}
      <LogDetailsSheet
        log={logs?.find((log) => log.id === selectedId) ?? null}
        onClose={() => setSelectedId(null)}
      />
    </main>
  );
}
