"use client";

// Detail sidebar (decision 6): severity + timestamp + service, full body,
// first-class trace/span ids, log attributes, then resource & scope
// attributes collapsed. Copy buttons on ids, ID-ish values, the body, and
// the whole record as JSON.

import { ChevronDown, ChevronUp } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { SeverityBadge } from "@/components/severity-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AttrValue, FlatLog } from "@/lib/flatten";

function prettyBody(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null) {
      return JSON.stringify(parsed, null, 2);
    }
  } catch {
    // not JSON — render as-is (plain string or stack trace)
  }
  return body;
}

// Values worth a copy button: ids of any spelling (user_id, correlationId, trace.id).
function isIdish(key: string): boolean {
  return /id$/i.test(key);
}

// Section headings are uppercase label-style so they never read as data rows.
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

function IdRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{label}</span>
      <code className="min-w-0 truncate font-mono text-xs" title={value}>
        {value}
      </code>
      <CopyButton value={value} label={`Copy ${label}`} />
    </div>
  );
}

function AttributesTable({ attributes }: { attributes: Record<string, AttrValue> }) {
  const entries = Object.entries(attributes);
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No attributes.</p>;
  }
  return (
    <dl className="divide-y divide-border/60 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-start gap-2 py-1.5">
          <dt className="w-2/5 shrink-0 break-all font-mono text-muted-foreground">{key}</dt>
          <dd className="min-w-0 flex-1 break-all font-mono">{String(value)}</dd>
          {isIdish(key) && (
            <CopyButton value={String(value)} label={`Copy ${key}`} className="-my-1" />
          )}
        </div>
      ))}
    </dl>
  );
}

function CollapsedSection({
  title,
  count,
  attributes,
}: {
  title: string;
  count: number;
  attributes: Record<string, AttrValue>;
}) {
  return (
    <details className="group border-t pt-3">
      <summary className="list-none select-none text-muted-foreground hover:text-foreground">
        <span className="mr-1 inline-block text-xs transition-transform group-open:rotate-90">
          ▸
        </span>
        <span className="text-[11px] font-semibold tracking-wider uppercase">
          {title} <span className="font-normal">({count})</span>
        </span>
      </summary>
      <div className="mt-2">
        <AttributesTable attributes={attributes} />
      </div>
    </details>
  );
}

export function LogDetailsSheet({
  log,
  onClose,
  onNavigate,
  hasPrev,
  hasNext,
  position,
  total,
}: {
  log: FlatLog | null;
  onClose: () => void;
  onNavigate: (dir: 1 | -1) => void;
  hasPrev: boolean;
  hasNext: boolean;
  position: number | null; // 1-based index in the table order; null when the
  total: number; //            shown log is filtered out of the current view
}) {
  return (
    // Non-modal: no overlay dimming/blurring the table, and the page behind
    // stays scrollable and clickable — clicking another row switches the
    // sheet to it instead of closing.
    <Sheet modal={false} open={log !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        // the defaults are data-[side=right]-scoped, so overrides must be too
        className="flex flex-col gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
        // Non-modal dismisses on any outside interaction by default; the
        // sheet should only close via ×, Escape, or its own controls.
        onInteractOutside={(e) => e.preventDefault()}
        // Hand focus back to the table so arrow-key row navigation resumes
        // from the row this sheet was opened on.
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          document.querySelector<HTMLElement>("[data-logs-scroll]")?.focus();
        }}
      >
        {log && (
          <>
            {/* Prev/next: same order as the table's arrow-key navigation. */}
            <div className="absolute top-3 right-11 flex items-center">
              {position !== null && (
                <span
                  className="mr-1 text-xs tabular-nums whitespace-nowrap text-muted-foreground"
                  data-sheet-position
                >
                  {position} of {total}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous log"
                disabled={!hasPrev}
                onClick={() => onNavigate(-1)}
              >
                <ChevronUp aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next log"
                disabled={!hasNext}
                onClick={() => onNavigate(1)}
              >
                <ChevronDown aria-hidden />
              </Button>
            </div>
            <SheetHeader className="border-b">
              <SheetTitle className="flex flex-wrap items-center gap-2 pr-44 text-sm">
                <SeverityBadge
                  severityNumber={log.severityNumber}
                  severityText={log.severityText}
                />
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  {new Date(log.timeMs).toISOString()}
                </span>
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Service</span>
                <span className="truncate font-medium text-foreground">
                  {log.serviceNamespace ? `${log.serviceNamespace}/` : ""}
                  {log.serviceName}
                  {log.serviceVersion ? ` · v${log.serviceVersion}` : ""}
                </span>
              </SheetDescription>
              <CopyButton
                value={JSON.stringify(log, null, 2)}
                label="Copy as JSON"
                className="mt-2 self-start"
              >
                Copy as JSON
              </CopyButton>
            </SheetHeader>

            <div className="flex flex-col gap-5 p-4">
              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <SectionHeading>Body</SectionHeading>
                  <CopyButton value={log.body} label="Copy body" />
                </div>
                <pre
                  data-log-detail-body
                  className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-xs whitespace-pre-wrap break-all"
                >
                  {prettyBody(log.body)}
                </pre>
              </section>

              {(log.traceId || log.spanId) && (
                <section className="flex flex-col gap-1">
                  {log.traceId && <IdRow label="trace.id" value={log.traceId} />}
                  {log.spanId && <IdRow label="span.id" value={log.spanId} />}
                </section>
              )}

              <section>
                <div className="mb-1.5">
                  <SectionHeading>
                    Attributes{" "}
                    <span className="font-normal">({Object.keys(log.attributes).length})</span>
                  </SectionHeading>
                </div>
                <AttributesTable attributes={log.attributes} />
              </section>

              <CollapsedSection
                title="Resource attributes"
                count={Object.keys(log.resourceAttributes).length}
                attributes={log.resourceAttributes}
              />
              <CollapsedSection
                title={`Scope attributes${log.scopeName ? ` · ${log.scopeName}` : ""}`}
                count={Object.keys(log.scopeAttributes).length}
                attributes={log.scopeAttributes}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
