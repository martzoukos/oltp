// Group aggregation for the grouped view. Groups are ordered by log count
// descending; per-group severity breakdowns feed the header's dot summary.
// (Behavior is covered by the Playwright grouped-view test, per the dedup rule.)

import type { FlatLog } from "./flatten";
import { LEGEND_GROUPS, legendGroupOf, type LegendGroup } from "./severity";

export interface ServiceGroup {
  serviceKey: string;
  serviceName: string;
  serviceNamespace?: string;
  count: number;
  severityCounts: Record<LegendGroup, number>;
  logs: FlatLog[];
}

export function groupByService(logs: FlatLog[]): ServiceGroup[] {
  const groups = new Map<string, ServiceGroup>();
  for (const log of logs) {
    let group = groups.get(log.serviceKey);
    if (!group) {
      group = {
        serviceKey: log.serviceKey,
        serviceName: log.serviceName,
        serviceNamespace: log.serviceNamespace,
        count: 0,
        severityCounts: Object.fromEntries(
          LEGEND_GROUPS.map((g) => [g.id, 0]),
        ) as Record<LegendGroup, number>,
        logs: [],
      };
      groups.set(log.serviceKey, group);
    }
    group.count++;
    group.severityCounts[legendGroupOf(log.severityNumber)]++;
    group.logs.push(log);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}
