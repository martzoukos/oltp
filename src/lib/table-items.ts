// Ordered table items (group headers + log rows), shared by the table
// renderer and by keyboard/sheet navigation so "next log" means the same
// thing everywhere: flat = rows sorted by the active sort; grouped =
// count-desc service groups, open by default, where collapsed groups
// contribute no rows.

import { groupByService, type ServiceGroup } from "@/lib/filter";
import type { FlatLog } from "@/lib/flatten";
import type { SortState } from "@/lib/url-state";

export type TableItem =
  | { type: "log"; log: FlatLog }
  | { type: "header"; group: ServiceGroup };

export function comparator(sort: SortState): (a: FlatLog, b: FlatLog) => number {
  const [column, direction] = sort.split(".") as ["time" | "severity", "asc" | "desc"];
  const key = column === "time" ? "timeMs" : "severityNumber";
  const sign = direction === "asc" ? 1 : -1;
  return (a, b) => sign * (a[key] - b[key]);
}

export function buildTableItems(
  logs: FlatLog[],
  view: "flat" | "grouped",
  sort: SortState,
  collapsedKeys: ReadonlySet<string>,
): TableItem[] {
  const compare = comparator(sort);
  if (view === "flat") {
    return [...logs].sort(compare).map((log): TableItem => ({ type: "log", log }));
  }
  return groupByService(logs).flatMap((group): TableItem[] => [
    { type: "header", group },
    ...(collapsedKeys.has(group.serviceKey)
      ? []
      : [...group.logs].sort(compare).map((log): TableItem => ({ type: "log", log }))),
  ]);
}
