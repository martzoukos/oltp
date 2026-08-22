"use client";

// Fetch-once dataset context. The API returns random data per request, so the
// dataset is held in memory for the whole session; Refresh explicitly pulls a
// new one. datasetId increments on every successful load so ephemeral state
// that references log ids (selection, expanded groups) can reset — ids don't
// survive a new random dataset.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flatten, type FlatLog } from "@/lib/flatten";
import type { LogsPayload } from "@/lib/otlp-types";

export const LOGS_API_URL =
  "https://take-home-assignment-otlp-logs-api.vercel.app/api/v2/logs";

type LogsState =
  | { status: "loading"; logs: null; error: null; fetchedAtMs: null }
  | { status: "error"; logs: null; error: string; fetchedAtMs: null }
  | { status: "ready"; logs: FlatLog[]; error: null; fetchedAtMs: number };

const LOADING: LogsState = { status: "loading", logs: null, error: null, fetchedAtMs: null };

interface LogsContextValue {
  status: LogsState["status"];
  logs: FlatLog[] | null;
  error: string | null;
  // The "now" anchor for preset windows: the dataset spans the 24h ending at
  // fetch time, so windows resolve against this rather than a live clock.
  fetchedAtMs: number | null;
  datasetId: number;
  refresh: () => void;
}

const LogsContext = createContext<LogsContextValue | null>(null);

export function LogsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LogsState>(LOADING);
  const [datasetId, setDatasetId] = useState(0);
  // Bumped by refresh() to re-run the fetch effect; the generation guard
  // discards responses that lose to a newer refresh.
  const [reloadToken, setReloadToken] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    const requestId = ++generation.current;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(LOGS_API_URL, { signal: controller.signal });
        if (!response.ok) throw new Error(`API responded ${response.status}`);
        const payload = (await response.json()) as LogsPayload;
        const logs = flatten(payload);
        if (generation.current !== requestId) return;
        setState({ status: "ready", logs, error: null, fetchedAtMs: Date.now() });
        setDatasetId((id) => id + 1);
      } catch (err) {
        if (controller.signal.aborted || generation.current !== requestId) return;
        setState({
          status: "error",
          logs: null,
          error: err instanceof Error ? err.message : "Failed to load logs",
          fetchedAtMs: null,
        });
      }
    })();
    return () => controller.abort();
  }, [reloadToken]);

  const refresh = useCallback(() => {
    setState(LOADING);
    setReloadToken((t) => t + 1);
  }, []);

  return (
    <LogsContext.Provider value={{ ...state, datasetId, refresh }}>
      {children}
    </LogsContext.Provider>
  );
}

export function useLogs(): LogsContextValue {
  const ctx = useContext(LogsContext);
  if (!ctx) throw new Error("useLogs must be used inside <LogsProvider>");
  return ctx;
}
