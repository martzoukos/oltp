"use client";

// Page shell: wires the dataset, URL state, and (as later steps land) the
// toolbar, histogram, table, and detail sheet.

import { useQueryState } from "nuqs";
import { useMemo, useState } from "react";
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
  const [sort] = useQueryState("sort", sortParser);
  const [density] = useQueryState("density", densityParser);
  const [severities] = useQueryState("severities", severitiesParser);

  // Selection references the dataset by FlatLog id; a refresh invalidates ids,
  // so keying this state by datasetId resets it with the new data.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Preset windows anchor to fetch time — the dataset spans the 24h ending there.
  const window = resolveWindow(windowState, fetchedAtMs ?? 0);

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
    return <main className="grid flex-1 place-items-center text-muted-foreground">Loading logs…</main>;
  }
  if (status === "error") {
    return (
      <main className="grid flex-1 place-items-center gap-2 text-center">
        <div>
          <p className="text-destructive">Failed to load logs: {error}</p>
          <button className="underline" onClick={refresh}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col p-4 text-sm">
      <p className="text-muted-foreground">
        dataset #{datasetId}: {logs!.length} logs, {visibleLogs.length} in window · view={view} ·
        sort={sort} · density={density} · selected={selectedId ?? "none"}
      </p>
      <button className="w-fit underline" onClick={() => { setSelectedId(null); refresh(); }}>
        Refresh
      </button>
    </main>
  );
}
