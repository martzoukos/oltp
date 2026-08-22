// Minimal hand-written OTLP logs interfaces — only the fields this app reads.
// The OTLP/JSON spec serializes int64 as strings, but this API emits plain
// numbers for intValue and string nanos for timestamps; both are accepted.

export interface AnyValue {
  stringValue?: string;
  intValue?: number | string;
  doubleValue?: number;
  boolValue?: boolean;
  bytesValue?: string;
  arrayValue?: { values: AnyValue[] };
  kvlistValue?: { values: KeyValue[] };
}

export interface KeyValue {
  key: string;
  value: AnyValue;
}

export interface Resource {
  attributes?: KeyValue[];
  droppedAttributesCount?: number;
}

export interface InstrumentationScope {
  name?: string;
  version?: string;
  attributes?: KeyValue[];
}

export interface LogRecord {
  timeUnixNano?: string;
  observedTimeUnixNano?: string;
  severityNumber?: number;
  severityText?: string;
  body?: AnyValue;
  attributes?: KeyValue[];
  traceId?: string;
  spanId?: string;
  droppedAttributesCount?: number;
}

export interface ScopeLogs {
  scope?: InstrumentationScope;
  logRecords?: LogRecord[];
}

export interface ResourceLogs {
  resource?: Resource;
  scopeLogs?: ScopeLogs[];
}

export interface LogsPayload {
  resourceLogs?: ResourceLogs[];
}
