import { describe, expect, it } from "vitest";
import { flatten } from "./flatten";
import type { AnyValue, LogsPayload, ResourceLogs } from "./otlp-types";

// Hand-written nested fixtures so expected values can be asserted literally.

const attr = (key: string, value: AnyValue) => ({ key, value });
const str = (s: string): AnyValue => ({ stringValue: s });

function resourceLogsFor(records: object[], resourceAttrs = defaultResourceAttrs()): ResourceLogs {
  return {
    resource: { attributes: resourceAttrs },
    scopeLogs: [{ scope: { name: "mock" }, logRecords: records }],
  };
}

function defaultResourceAttrs() {
  return [
    attr("service.namespace", str("architectures")),
    attr("service.name", str("matrix")),
    attr("service.version", str("2.8.12")),
  ];
}

const baseRecord = {
  timeUnixNano: "1787326212929000000",
  severityNumber: 8,
  severityText: "DEBUG",
  body: str("hello"),
  attributes: [],
};

describe("flatten", () => {
  it("produces one FlatLog per logRecord across all resource/scope nesting", () => {
    const payload: LogsPayload = {
      resourceLogs: [
        {
          resource: { attributes: defaultResourceAttrs() },
          scopeLogs: [
            { scope: { name: "a" }, logRecords: [baseRecord, baseRecord] },
            { scope: { name: "b" }, logRecords: [baseRecord] },
          ],
        },
        resourceLogsFor([baseRecord, baseRecord, baseRecord]),
      ],
    };
    const logs = flatten(payload);
    expect(logs).toHaveLength(6);
    expect(logs.map((l) => l.id)).toEqual(["0", "1", "2", "3", "4", "5"]);
  });

  it("derives service identity from resource attributes", () => {
    const [log] = flatten({ resourceLogs: [resourceLogsFor([baseRecord])] });
    expect(log.serviceName).toBe("matrix");
    expect(log.serviceNamespace).toBe("architectures");
    expect(log.serviceVersion).toBe("2.8.12");
    expect(log.serviceKey).toBe("architectures/matrix");
  });

  it("falls back to serviceName='unknown' when resource has no service.name", () => {
    const [log] = flatten({ resourceLogs: [resourceLogsFor([baseRecord], [])] });
    expect(log.serviceName).toBe("unknown");
    expect(log.serviceNamespace).toBeUndefined();
    expect(log.serviceKey).toBe("unknown");
  });

  it("converts timeUnixNano (string of nanoseconds) to timeMs (number)", () => {
    const [log] = flatten({ resourceLogs: [resourceLogsFor([baseRecord])] });
    expect(log.timeMs).toBe(1787326212929);

    const [fallback] = flatten({
      resourceLogs: [
        resourceLogsFor([
          { ...baseRecord, timeUnixNano: "0", observedTimeUnixNano: "1700000000123000000" },
        ]),
      ],
    });
    expect(fallback.timeMs).toBe(1700000000123);
  });

  it("extracts trace/span ids from top-level fields OR trace.id/span.id attributes", () => {
    const [a, b, c] = flatten({
      resourceLogs: [
        resourceLogsFor([
          { ...baseRecord, traceId: "abc123", spanId: "def456" },
          {
            ...baseRecord,
            attributes: [
              attr("trace.id", str("aaa")),
              attr("span.id", str("bbb")),
              attr("http.method", str("GET")),
            ],
          },
          baseRecord,
        ]),
      ],
    });
    expect([a.traceId, a.spanId]).toEqual(["abc123", "def456"]);
    // This API's actual shape: ids as attributes, promoted and removed from
    // the attributes record so the sidebar doesn't render them twice.
    expect([b.traceId, b.spanId]).toEqual(["aaa", "bbb"]);
    expect(b.attributes).toEqual({ "http.method": "GET" });
    expect([c.traceId, c.spanId]).toEqual([undefined, undefined]);
  });

  it("stringifies AnyValue bodies of every shape", () => {
    const bodies: (AnyValue | undefined)[] = [
      { stringValue: "plain" },
      { intValue: 42 },
      { doubleValue: 1.5 },
      { boolValue: true },
      { kvlistValue: { values: [attr("k", str("v")), attr("n", { intValue: 7 })] } },
      { arrayValue: { values: [str("x"), { boolValue: false }] } },
      undefined,
    ];
    const logs = flatten({
      resourceLogs: [resourceLogsFor(bodies.map((body) => ({ ...baseRecord, body })))],
    });
    expect(logs.map((l) => l.body)).toEqual([
      "plain",
      "42",
      "1.5",
      "true",
      '{"k":"v","n":7}',
      '["x",false]',
      "",
    ]);
  });

  it("converts attribute lists to plain records with typed values", () => {
    const [log] = flatten({
      resourceLogs: [
        {
          resource: {
            attributes: [...defaultResourceAttrs(), attr("host.up", { boolValue: true })],
          },
          scopeLogs: [
            {
              scope: { name: "mock", attributes: [attr("sdk", str("dash0"))] },
              logRecords: [
                {
                  ...baseRecord,
                  attributes: [
                    attr("http.status_code", { intValue: 204 }),
                    attr("http.method", str("GET")),
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(log.attributes).toEqual({ "http.status_code": 204, "http.method": "GET" });
    expect(log.scopeAttributes).toEqual({ sdk: "dash0" });
    expect(log.resourceAttributes).toMatchObject({ "service.name": "matrix", "host.up": true });
  });

  it("carries scope name and severity fields through unchanged", () => {
    const [log, bare] = flatten({
      resourceLogs: [
        resourceLogsFor([
          baseRecord,
          { ...baseRecord, severityNumber: undefined, severityText: undefined },
        ]),
      ],
    });
    expect(log.scopeName).toBe("mock");
    expect(log.severityNumber).toBe(8);
    expect(log.severityText).toBe("DEBUG");
    expect(bare.severityNumber).toBe(0);
    expect(bare.severityText).toBeUndefined();
  });
});
