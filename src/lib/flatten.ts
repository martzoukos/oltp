// Flattens the OTLP hierarchy (resourceLogs -> scopeLogs -> logRecords) into one
// FlatLog per record, and canonicalizes values along the way: attribute lists become
// plain records, AnyValue bodies become strings, nano timestamps become epoch ms,
// and trace/span ids are promoted to first-class fields.

import type { AnyValue, KeyValue, LogsPayload } from "./otlp-types";

export type AttrValue = string | number | boolean;

export interface FlatLog {
  id: string;
  timeMs: number;
  severityNumber: number;
  severityText?: string;
  body: string;
  attributes: Record<string, AttrValue>;
  serviceKey: string;
  serviceName: string;
  serviceNamespace?: string;
  serviceVersion?: string;
  scopeName?: string;
  scopeAttributes: Record<string, AttrValue>;
  resourceAttributes: Record<string, AttrValue>;
  traceId?: string;
  spanId?: string;
}

function anyValueToPlain(v: AnyValue): unknown {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.intValue !== undefined) return Number(v.intValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.boolValue !== undefined) return v.boolValue;
  if (v.bytesValue !== undefined) return v.bytesValue;
  if (v.arrayValue !== undefined) return v.arrayValue.values.map(anyValueToPlain);
  if (v.kvlistValue !== undefined) {
    return Object.fromEntries(
      v.kvlistValue.values.map((kv) => [kv.key, anyValueToPlain(kv.value)]),
    );
  }
  return undefined;
}

function toAttrValue(v: AnyValue): AttrValue {
  const plain = anyValueToPlain(v);
  if (
    typeof plain === "string" ||
    typeof plain === "number" ||
    typeof plain === "boolean"
  ) {
    return plain;
  }
  return JSON.stringify(plain ?? null);
}

function toRecord(kvs?: KeyValue[]): Record<string, AttrValue> {
  return Object.fromEntries((kvs ?? []).map((kv) => [kv.key, toAttrValue(kv.value)]));
}

export function bodyToString(body?: AnyValue): string {
  if (body === undefined) return "";
  const plain = anyValueToPlain(body);
  if (plain === undefined) return "";
  if (typeof plain === "string") return plain;
  if (typeof plain === "number" || typeof plain === "boolean") return String(plain);
  return JSON.stringify(plain);
}

// Exact conversion — Number("1787326212929000000") already exceeds 2^53.
function nanosToMs(nanos?: string): number | undefined {
  if (!nanos || nanos === "0") return undefined;
  return Number(BigInt(nanos) / BigInt(1_000_000));
}

export function flatten(payload: LogsPayload): FlatLog[] {
  const out: FlatLog[] = [];
  for (const resourceLog of payload.resourceLogs ?? []) {
    const resourceAttributes = toRecord(resourceLog.resource?.attributes);
    const serviceName =
      typeof resourceAttributes["service.name"] === "string"
        ? (resourceAttributes["service.name"] as string)
        : "unknown";
    const serviceNamespace =
      typeof resourceAttributes["service.namespace"] === "string"
        ? (resourceAttributes["service.namespace"] as string)
        : undefined;
    const serviceVersion =
      typeof resourceAttributes["service.version"] === "string"
        ? (resourceAttributes["service.version"] as string)
        : undefined;
    const serviceKey = serviceNamespace
      ? `${serviceNamespace}/${serviceName}`
      : serviceName;

    for (const scopeLog of resourceLog.scopeLogs ?? []) {
      const scopeAttributes = toRecord(scopeLog.scope?.attributes);
      for (const record of scopeLog.logRecords ?? []) {
        const attributes = toRecord(record.attributes);

        // The OTLP spec carries ids as top-level fields; this API ships them as
        // trace.id / span.id attributes. Promote either form and drop the
        // attribute copy so the sidebar doesn't render them twice.
        let traceId = record.traceId;
        let spanId = record.spanId;
        if (traceId === undefined && typeof attributes["trace.id"] === "string") {
          traceId = attributes["trace.id"] as string;
          delete attributes["trace.id"];
        }
        if (spanId === undefined && typeof attributes["span.id"] === "string") {
          spanId = attributes["span.id"] as string;
          delete attributes["span.id"];
        }

        out.push({
          id: String(out.length),
          timeMs:
            nanosToMs(record.timeUnixNano) ??
            nanosToMs(record.observedTimeUnixNano) ??
            0,
          severityNumber: record.severityNumber ?? 0,
          severityText: record.severityText,
          body: bodyToString(record.body),
          attributes,
          serviceKey,
          serviceName,
          serviceNamespace,
          serviceVersion,
          scopeName: scopeLog.scope?.name,
          scopeAttributes,
          resourceAttributes,
          traceId,
          spanId,
        });
      }
    }
  }
  return out;
}
