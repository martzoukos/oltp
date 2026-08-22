"use client";

// Toolbar: time range picker (presets + custom absolute range + prev/next
// arrows that shift by the window's own length), refresh, theme toggle.
// Table-scoped controls (view, density, mobile sort) live in the meta row
// above the table — see LogsView.

import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { SortState } from "@/lib/url-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  resolveWindow,
  shiftWindow,
  WINDOW_PRESETS,
  type WindowState,
} from "@/lib/time";

function formatRange(fromMs: number, toMs: number): string {
  const format = (ms: number) =>
    new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  return `${format(fromMs)} – ${format(toMs)}`;
}

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function TimeRangePicker({
  windowState,
  nowMs,
  onChange,
}: {
  windowState: WindowState;
  nowMs: number;
  onChange: (state: WindowState) => void;
}) {
  const window = resolveWindow(windowState, nowMs);
  const [customFrom, setCustomFrom] = useState(() => toLocalInput(window.fromMs));
  const [customTo, setCustomTo] = useState(() => toLocalInput(window.toMs));

  const label =
    windowState.kind === "preset"
      ? WINDOW_PRESETS.find((p) => p.id === windowState.preset)!.label
      : formatRange(windowState.fromMs, windowState.toMs);

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Previous time window"
        onClick={() => onChange(shiftWindow(windowState, "prev", nowMs))}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" data-time-range-trigger>
            {label}
            <ChevronDown className="text-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {WINDOW_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onSelect={() => onChange({ kind: "preset", preset: preset.id })}
            >
              {preset.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <div
            className="flex flex-col gap-2 p-2"
            // keep the menu open while interacting with the inputs
            onKeyDown={(e) => e.stopPropagation()}
          >
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              From
              <input
                type="datetime-local"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-md border bg-transparent px-2 py-1 text-xs text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              To
              <input
                type="datetime-local"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-md border bg-transparent px-2 py-1 text-xs text-foreground"
              />
            </label>
            <DropdownMenuItem
              disabled={
                !customFrom ||
                !customTo ||
                new Date(customFrom).getTime() >= new Date(customTo).getTime()
              }
              onSelect={() =>
                onChange({
                  kind: "fixed",
                  fromMs: new Date(customFrom).getTime(),
                  toMs: new Date(customTo).getTime(),
                })
              }
              className="justify-center border font-medium"
            >
              Apply custom range
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Next time window"
        onClick={() => onChange(shiftWindow(windowState, "next", nowMs))}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}

const SORT_OPTIONS: { value: SortState; label: string }[] = [
  { value: "time.desc", label: "Newest first" },
  { value: "time.asc", label: "Oldest first" },
  { value: "severity.desc", label: "Most severe first" },
  { value: "severity.asc", label: "Least severe first" },
];

// Mobile-only: column headers are hidden below sm, so sorting moves here.
export function MobileSortMenu({
  sort,
  onSortChange,
}: {
  sort: SortState;
  onSortChange: (sort: SortState) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="sm:hidden">
        <Button variant="outline" size="icon-sm" aria-label="Sort logs">
          <ArrowUpDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onSortChange(option.value)}
            className={option.value === sort ? "font-medium" : undefined}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Toolbar({
  windowState,
  nowMs,
  onWindowStateChange,
  onRefresh,
}: {
  windowState: WindowState;
  nowMs: number;
  onWindowStateChange: (state: WindowState) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <TimeRangePicker
        windowState={windowState}
        nowMs={nowMs}
        onChange={onWindowStateChange}
      />
      <Button variant="outline" size="sm" onClick={onRefresh}>
        <RefreshCw aria-hidden />
        <span className="max-sm:sr-only">Refresh</span>
      </Button>
      <ThemeToggle />
    </div>
  );
}
