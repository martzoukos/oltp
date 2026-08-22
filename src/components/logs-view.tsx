"use client";

// Page shell: dataset + URL state wiring for toolbar, histogram, legend
// filter, table, and detail sheet.

import { useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Histogram } from "@/components/histogram";
import { LogDetailsSheet } from "@/components/log-details-sheet";
import { LogsTable } from "@/components/logs-table";
import { SeverityLegend } from "@/components/severity-legend";
import { Toolbar } from "@/components/toolbar";
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
  const [view] = useQueryState("view", viewParser);
  const [sort, setSort] = useQueryState("sort", sortParser);
  const [density, setDensity] = useQueryState("density", densityParser);
  const [severities, setSeverities] = useQueryState("severities", severitiesParser);

  // Selection references the dataset by FlatLog id; refresh invalidates ids,
  // so selection is cleared alongside refresh().
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    <main className="flex h-dvh flex-col">
      <header className="flex flex-col gap-2 border-b px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-sm font-semibold">Logs</h1>
          <span className="text-xs text-muted-foreground" data-dataset-id={datasetId}>
            {visibleLogs.length} of {logs!.length} logs
          </span>
          <span className="sr-only">view {view}</span>
        </div>
        <Toolbar
          windowState={windowState}
          nowMs={nowMs}
          onWindowStateChange={(state) => void setWindowState(state)}
          density={density}
          onDensityChange={(value) => void setDensity(value)}
          onRefresh={() => {
            setSelectedId(null);
            refresh();
          }}
        />
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

      <LogsTable
        logs={visibleLogs}
        nowMs={nowMs}
        density={density}
        sort={sort}
        onSortChange={(next) => void setSort(next)}
        selectedId={selectedId}
        onSelect={(log) => setSelectedId(log.id)}
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
