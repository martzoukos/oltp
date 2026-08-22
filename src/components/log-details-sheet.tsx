"use client";

// Detail sidebar (decision 6): severity + timestamp + service, full body,
// first-class trace/span ids, log attributes, then resource & scope
// attributes collapsed. Copy buttons on ids, ID-ish values, the body, and
// the whole record as JSON.

import { CopyButton } from "@/components/copy-button";
import { SeverityBadge } from "@/components/severity-badge";
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

function IdRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
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
          <dt className="w-2/5 shrink-0 break-all text-muted-foreground">{key}</dt>
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
  attributes,
}: {
  title: string;
  attributes: Record<string, AttrValue>;
}) {
  return (
    <details className="group border-t pt-3">
      <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground select-none hover:text-foreground">
        <span className="mr-1 inline-block transition-transform group-open:rotate-90">▸</span>
        {title} ({Object.keys(attributes).length})
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
}: {
  log: FlatLog | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={log !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        // the defaults are data-[side=right]-scoped, so overrides must be too
        className="flex flex-col gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        {log && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle className="flex flex-wrap items-center gap-2 text-sm">
                <SeverityBadge
                  severityNumber={log.severityNumber}
                  severityText={log.severityText}
                />
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  {new Date(log.timeMs).toISOString()}
                </span>
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 text-xs">
                <span className="truncate">
                  {log.serviceNamespace ? `${log.serviceNamespace}/` : ""}
                  {log.serviceName}
                  {log.serviceVersion ? ` · v${log.serviceVersion}` : ""}
                </span>
                <CopyButton
                  value={JSON.stringify(log, null, 2)}
                  label="Copy as JSON"
                  className="ml-auto"
                />
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-4 p-4">
              <section>
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-xs font-medium text-muted-foreground">Body</h3>
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
                <h3 className="mb-1 text-xs font-medium text-muted-foreground">
                  Attributes ({Object.keys(log.attributes).length})
                </h3>
                <AttributesTable attributes={log.attributes} />
              </section>

              <CollapsedSection title="Resource attributes" attributes={log.resourceAttributes} />
              <CollapsedSection
                title={`Scope attributes${log.scopeName ? ` · ${log.scopeName}` : ""}`}
                attributes={log.scopeAttributes}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
