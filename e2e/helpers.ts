import type { Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { flatten, type FlatLog } from "../src/lib/flatten";
import type { LogsPayload } from "../src/lib/otlp-types";

export const API_URL =
  "https://take-home-assignment-otlp-logs-api.vercel.app/api/v2/logs";

function loadFixture(name: string): LogsPayload {
  const file = path.join(__dirname, "fixtures", name);
  return JSON.parse(fs.readFileSync(file, "utf8")) as LogsPayload;
}

// The captured fixtures carry absolute timestamps that age out of the app's
// default "Last 24h" window. Shift every record by (now - newest) so the
// newest record is "just now" and the dataset spans the trailing 24h; relative
// ordering and gaps are preserved.
function rebase(payload: LogsPayload, nowMs: number): LogsPayload {
  const clone = JSON.parse(JSON.stringify(payload)) as LogsPayload;
  let maxNanos = 0n;
  const eachRecord = (fn: (r: { timeUnixNano?: string; observedTimeUnixNano?: string }) => void) => {
    for (const rl of clone.resourceLogs ?? [])
      for (const sl of rl.scopeLogs ?? [])
        for (const record of sl.logRecords ?? []) fn(record);
  };
  eachRecord((record) => {
    if (record.timeUnixNano && BigInt(record.timeUnixNano) > maxNanos) {
      maxNanos = BigInt(record.timeUnixNano);
    }
  });
  const delta = BigInt(nowMs) * 1_000_000n - maxNanos;
  eachRecord((record) => {
    if (record.timeUnixNano) {
      record.timeUnixNano = (BigInt(record.timeUnixNano) + delta).toString();
    }
    if (record.observedTimeUnixNano) {
      record.observedTimeUnixNano = (BigInt(record.observedTimeUnixNano) + delta).toString();
    }
  });
  return clone;
}

export interface FixtureServer {
  // Rebased payloads in the order they were served; served[0] is the initial load.
  served: LogsPayload[];
  flat: (index?: number) => FlatLog[];
}

// Intercepts the logs API and serves the named fixtures in order (the last
// one repeats). Register before page.goto().
export async function serveFixtures(page: Page, names: string[]): Promise<FixtureServer> {
  const payloads = names.map(loadFixture);
  const served: LogsPayload[] = [];
  await page.route(API_URL, async (route) => {
    const payload = rebase(payloads[Math.min(served.length, payloads.length - 1)], Date.now());
    served.push(payload);
    await route.fulfill({ json: payload });
  });
  return {
    served,
    flat: (index = 0) => flatten(served[index]),
  };
}

// A record whose body appears exactly once in the dataset, so a row can be
// located unambiguously by text. Optionally constrained by a predicate.
export function uniqueBodyLog(
  logs: FlatLog[],
  predicate: (log: FlatLog) => boolean = () => true,
): FlatLog {
  const bodyCounts = new Map<string, number>();
  for (const log of logs) bodyCounts.set(log.body, (bodyCounts.get(log.body) ?? 0) + 1);
  const found = logs.find(
    (log) => bodyCounts.get(log.body) === 1 && log.body.length > 0 && predicate(log),
  );
  if (!found) throw new Error("fixture has no unique-body record matching the predicate");
  return found;
}
