"use client";

// Page shell: dataset + URL state wiring for toolbar, histogram, legend
// filter, table, and detail sheet.

import { List, ListTree, Rows2, Rows4 } from "lucide-react";
import Link from "next/link";
import { useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Histogram } from "@/components/histogram";
import { LogDetailsSheet } from "@/components/log-details-sheet";
import { LogsTable } from "@/components/logs-table";
import { SeverityLegend } from "@/components/severity-legend";
import { MobileSortMenu, Toolbar } from "@/components/toolbar";
import { useLogs } from "@/components/logs-provider";
import { resolveWindow } from "@/lib/time";
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
            onWindowStateChange={(state) => void setWindowState(state)}
            onRefresh={() => {
              setSelectedId(null);
              setExpandedKeys(new Set());
              refresh();
            }}
          />
        </div>
      </header>

      <div className="border-b">
        <Histogram
          logs={visibleLogs}
          window={window}
          onWindowChange={(next) =>
            void setWindowState({ kind: "fixed", fromMs: next.fromMs, toMs: next.toMs })
          }
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
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(value) => {
              if (value === "flat" || value === "grouped") void setView(value);
            }}
            aria-label="View mode"
          >
            <ToggleGroupItem value="flat" aria-label="Flat view">
              <List aria-hidden />
              <span className="max-sm:sr-only">Flat</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="grouped" aria-label="Group by service">
              <ListTree aria-hidden />
              <span className="max-sm:sr-only">Grouped</span>
            </ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={density}
            onValueChange={(value) => {
              if (value === "1" || value === "3") void setDensity(value);
            }}
            aria-label="Body density"
          >
            <ToggleGroupItem value="1" aria-label="1 line per row">
              <Rows4 aria-hidden />
              <span className="max-sm:sr-only">1 line</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="3" aria-label="3 lines per row">
              <Rows2 aria-hidden />
              <span className="max-sm:sr-only">3 lines</span>
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
