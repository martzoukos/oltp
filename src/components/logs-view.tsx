"use client";

// Page shell: wires the dataset, URL state, and (as later steps land) the
// toolbar, histogram, table, and detail sheet.

import { RefreshCw } from "lucide-react";
import { useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LogDetailsSheet } from "@/components/log-details-sheet";
import { LogsTable } from "@/components/logs-table";
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
  const [windowState] = useQueryState("window", windowParser);
  const [view] = useQueryState("view", viewParser);
  const [sort, setSort] = useQueryState("sort", sortParser);
  const [density, setDensity] = useQueryState("density", densityParser);
  const [severities] = useQueryState("severities", severitiesParser);

  // Selection references the dataset by FlatLog id; a refresh invalidates ids,
  // so selection is cleared alongside refresh() and keyed checks use datasetId.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Preset windows anchor to fetch time — the dataset spans the 24h ending there.
  const nowMs = fetchedAtMs ?? 0;
  const window = resolveWindow(windowState, nowMs);

  const visibleLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter(
      (log) =>
        log.timeMs >= window.fromMs &&
        log.timeMs < window.toMs &&
        (severities.length === 0 || severities.includes(legendGroupOf(log.severityNumber))),
    );
  }, [logs, window.fromMs, window.toMs, severities]);

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
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <h1 className="text-sm font-semibold">Logs</h1>
        <span className="text-xs text-muted-foreground" data-dataset-id={datasetId}>
          {visibleLogs.length} of {logs!.length} logs
        </span>
        <span className="sr-only">view {view}</span>
        <div className="ml-auto flex items-center gap-2">
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
              1L
            </ToggleGroupItem>
            <ToggleGroupItem value="3" aria-label="3 lines per row">
              3L
            </ToggleGroupItem>
          </ToggleGroup>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedId(null);
              refresh();
            }}
          >
            <RefreshCw aria-hidden />
            Refresh
          </Button>
        </div>
      </header>
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
