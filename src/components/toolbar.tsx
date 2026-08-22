"use client";

// Toolbar: time range picker (presets + custom absolute range + prev/next
// arrows that shift by the window's own length), density toggle, refresh.

import { ChevronDown, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

export function Toolbar({
  windowState,
  nowMs,
  onWindowStateChange,
  density,
  onDensityChange,
  onRefresh,
  children,
}: {
  windowState: WindowState;
  nowMs: number;
  onWindowStateChange: (state: WindowState) => void;
  density: "1" | "3";
  onDensityChange: (density: "1" | "3") => void;
  onRefresh: () => void;
  children?: React.ReactNode; // extra controls (view toggle, theme) slot in here
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TimeRangePicker
        windowState={windowState}
        nowMs={nowMs}
        onChange={onWindowStateChange}
      />
      <div className="ml-auto flex items-center gap-2">
        {children}
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={density}
          onValueChange={(value) => {
            if (value === "1" || value === "3") onDensityChange(value);
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
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw aria-hidden />
          Refresh
        </Button>
      </div>
    </div>
  );
}
