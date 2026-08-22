"use client";

// Hand-rolled SVG stacked histogram. Identical in flat and grouped modes:
// stacked by severity legend group, global across services. Click selects a
// bucket; drag selects a snapped range (URL written once on pointer-up, the
// in-progress drag is purely local state).

import { useLayoutEffect, useRef, useState } from "react";
import { bucketize, pixelRangeToWindow } from "@/lib/histogram";
import type { FlatLog } from "@/lib/flatten";
import { LEGEND_GROUPS, type LegendGroup } from "@/lib/severity";
import type { TimeWindow } from "@/lib/time";

const GROUP_FILL: Record<LegendGroup, string> = {
  error: "var(--severity-error)",
  warn: "var(--severity-warn)",
  info: "var(--severity-info)",
  trace: "var(--severity-trace)",
  unknown: "var(--severity-unknown)",
};

const CHART_HEIGHT = 96;
const AXIS_HEIGHT = 18;
const SEGMENT_GAP = 1;
const BAR_GAP = 2;

function useElementWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

function formatTick(ms: number, windowMs: number): string {
  const date = new Date(ms);
  if (windowMs <= 24 * 3_600_000) {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface DragState {
  x0: number;
  x1: number;
}

export function Histogram({
  logs,
  window,
  onWindowChange,
}: {
  logs: FlatLog[];
  window: TimeWindow;
  onWindowChange: (window: TimeWindow) => void;
}) {
  const { ref, width } = useElementWidth();
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const { bucketMs, buckets } = bucketize(logs, window);
  const windowMs = window.toMs - window.fromMs;
  const maxTotal = Math.max(1, ...buckets.map((b) => b.total));

  const slotWidth = width / buckets.length;
  const barWidth = Math.max(1, slotWidth - BAR_GAP);

  const pointerX = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
  };

  // ~5 axis ticks on bucket boundaries.
  const tickStep = Math.max(1, Math.round(buckets.length / 5));
  const ticks = buckets.filter((_, i) => i % tickStep === 0 && i > 0);

  const hoveredBucket = hovered !== null ? buckets[hovered] : null;

  return (
    <div ref={ref} className="relative w-full px-3" data-histogram>
      {width > 0 && (
        <>
          <svg
            width="100%"
            height={CHART_HEIGHT + AXIS_HEIGHT}
            className="block touch-none select-none"
            style={{ cursor: "crosshair" }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const x = pointerX(e);
              setDrag({ x0: x, x1: x });
            }}
            onPointerMove={(e) => {
              const x = pointerX(e);
              if (drag) {
                setDrag({ ...drag, x1: x });
              } else {
                const index = Math.floor((x / width) * buckets.length);
                setHovered(index >= 0 && index < buckets.length ? index : null);
              }
            }}
            onPointerUp={(e) => {
              if (!drag) return;
              setDrag(null);
              const next = pixelRangeToWindow(drag.x0, pointerX(e), width, window);
              onWindowChange(next);
            }}
            onPointerLeave={() => setHovered(null)}
          >
            {/* baseline */}
            <line
              x1={0}
              x2={width}
              y1={CHART_HEIGHT + 0.5}
              y2={CHART_HEIGHT + 0.5}
              stroke="var(--border)"
            />
            {buckets.map((bucket, i) => {
              if (bucket.total === 0) return null;
              const x = i * slotWidth + BAR_GAP / 2;
              let y = CHART_HEIGHT;
              // Stack most-severe at the bottom; LEGEND_GROUPS is ordered
              // error→unknown, so iterate as-is from the baseline up.
              return (
                <g key={bucket.startMs} data-histogram-bar>
                  {LEGEND_GROUPS.map((group) => {
                    const count = bucket.counts[group.id];
                    if (count === 0) return null;
                    const height = (count / maxTotal) * (CHART_HEIGHT - 4);
                    y -= height;
                    return (
                      <rect
                        key={group.id}
                        x={x}
                        y={y + SEGMENT_GAP / 2}
                        width={barWidth}
                        height={Math.max(1, height - SEGMENT_GAP)}
                        rx={1}
                        fill={GROUP_FILL[group.id]}
                        data-severity-group={group.id}
                      />
                    );
                  })}
                </g>
              );
            })}
            {/* axis ticks */}
            {ticks.map((bucket, i) => {
              const index = buckets.indexOf(bucket);
              const x = index * slotWidth;
              return (
                <g key={i}>
                  <line
                    x1={x}
                    x2={x}
                    y1={CHART_HEIGHT - 2}
                    y2={CHART_HEIGHT + 3}
                    stroke="var(--border)"
                  />
                  <text
                    x={x}
                    y={CHART_HEIGHT + AXIS_HEIGHT - 4}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[10px]"
                  >
                    {formatTick(bucket.startMs, windowMs)}
                  </text>
                </g>
              );
            })}
            {/* hover highlight */}
            {hovered !== null && !drag && (
              <rect
                x={hovered * slotWidth}
                y={0}
                width={slotWidth}
                height={CHART_HEIGHT}
                className="fill-foreground/5"
                pointerEvents="none"
              />
            )}
            {/* drag overlay */}
            {drag && (
              <rect
                x={Math.min(drag.x0, drag.x1)}
                y={0}
                width={Math.abs(drag.x1 - drag.x0)}
                height={CHART_HEIGHT}
                className="fill-severity-info/15 stroke-severity-info"
                strokeWidth={1}
                pointerEvents="none"
                data-drag-overlay
              />
            )}
          </svg>

          {/* tooltip */}
          {hoveredBucket && !drag && (
            <div
              className="pointer-events-none absolute top-0 z-10 rounded-md border bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-md"
              style={{
                left: Math.min(hovered! * slotWidth + slotWidth / 2 + 12, width - 150),
              }}
              data-histogram-tooltip
            >
              <p className="mb-1 font-medium tabular-nums">
                {formatTick(hoveredBucket.startMs, windowMs)} –{" "}
                {formatTick(hoveredBucket.startMs + bucketMs, windowMs)}
              </p>
              {hoveredBucket.total === 0 ? (
                <p className="text-muted-foreground">No logs</p>
              ) : (
                LEGEND_GROUPS.filter((g) => hoveredBucket.counts[g.id] > 0).map((g) => (
                  <p key={g.id} className="flex items-center gap-1.5 tabular-nums">
                    <span
                      className="size-2 rounded-[2px]"
                      style={{ background: GROUP_FILL[g.id] }}
                    />
                    {g.label}
                    <span className="ml-auto pl-3 font-medium">
                      {hoveredBucket.counts[g.id]}
                    </span>
                  </p>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
