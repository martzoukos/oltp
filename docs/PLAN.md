# OTLP Log Viewer — Implementation Plan

## Context

Take-home assignment (dash0): build a log viewer for OTLP log records from
`https://take-home-assignment-otlp-logs-api.vercel.app/api/v2/logs`.
Mandated stack: React + TypeScript + Next.js App Router. Judged on: data transformation of
nested OTLP types, component architecture, observability-domain UX conventions, visual polish,
production-ready organization. Bonus: Vercel deployment. New repo, greenfield (current dir
`~/Projects/sandbox/oltp` is an empty git repo).

**API facts (verified):** returns random data per request; ~19 services, ~630 log records,
timestamps span the **last 24 hours** (not 7 days); CORS `access-control-allow-origin: *`
(direct client fetch, no proxy); bodies are plain strings, multi-line stack traces, or
stringified JSON.

## Decisions (interviewed & locked)

1. **Fetch once per session**, hold in memory, all windowing/sorting/grouping client-side. Explicit "Refresh" button pulls a new dataset.
2. **Default time window: Last 24 hours** (matches the data span); dropdown also offers Last 30m / 1h / 6h / 7d / custom range, with prev/next arrows that shift the window by its own length.
3. **Libraries:** Tailwind, shadcn/ui primitives, TanStack Table, `@tanstack/react-virtual` (virtualized scroll — no fake client-side pagination; README notes production needs server-side cursor pagination), hand-rolled SVG histogram (drag-select needs custom interaction anyway).
4. **URL state:** time window, view mode (flat/grouped), sort — via `nuqs`. Selected log stays in React state (no stable IDs across random datasets).
5. **Body cell:** monospace, truncated, with a 1-line ↔ 3-line density toggle (Datadog-style). No hover tooltip. Full body in detail sidebar.
6. **Detail sidebar** (shadcn Sheet), top to bottom: severity badge + full timestamp + service name → full body (pretty-print JSON, scrollable monospace for stack traces) → trace.id/span.id first-class with copy buttons → log attributes table → resource + scope attributes collapsed. Copy buttons: trace.id, span.id, ID-ish values, full body, "Copy as JSON" for the record.
7. **Grouped view:** log-level columns kept; service rows are full-width expandable group headers (chevron, service.name + namespace, log-count badge, mini severity-dot breakdown). Sorting applies within groups; groups ordered by count desc.
8. **Histogram:** identical in both modes — stacked by severity, global across services. Drag selects a range; click selects one bucket; window change filters the table.
9. **Severity filter via histogram legend (dash0 pattern):** legend chips under the histogram act as checkbox-style filters using dash0's groupings — ERROR & FATAL (red), WARN (amber), INFO (blue), TRACE & DEBUG (gray), UNKNOWN (muted) — plus an × to clear. Toggling a chip filters both the histogram bars and the table rows (flat and grouped). Filter state lives in the URL.
10. **Testing: test-first, defined together before implementation.** Two suites written up front as a red suite, then implemented to green: Vitest for pure data-layer transforms, Playwright for UI interactions with `page.route` serving a fixed JSON fixture (random API ⇒ mandatory for determinism). **Dedup rule: if a behavior is covered by both, keep only the browser test** — Vitest keeps only transforms not directly observable in the UI.
11. **Deploy to Vercel** at the end (confirm with user before running deploy).
12. **Design system:** single tokens layer — Tailwind v4 `@theme` + semantic CSS custom properties (typography scale, colors, spacing, radii, severity palette) in one `tokens.css` block; every component consumes semantic tokens only, so the user can reskin by editing one file after handoff. Baseline aesthetic: dash0/Vercel/Linear — dense, quiet borders, Geist Sans + Geist Mono (via `next/font`), subtle motion. **Light/dark mode**: system-preference default + toolbar toggle (`.dark` class, persisted in localStorage).
13. **Mobile (interviewed & locked):** stacked two-line rows on narrow screens (severity badge + time-ago / truncated body) with sort moved to a toolbar dropdown; histogram touch = tap-a-bar selects that bucket, drag-select is desktop-pointer-only (ranges via presets + arrows); detail sheet goes full-width; toolbar wraps.
14. **React state — no store library.** Four kinds: (a) the dataset in `logs-provider` context (`useState` + one fetch effect; no SWR/Query — one GET doesn't justify it); (b) shareable UI state (window, view, sort, density, severities) managed BY nuqs — URL and React state are the same thing, never two synced copies; (c) ephemeral `useState` where it lives — selected log lifted to `page.tsx`, expanded groups, drag-in-progress, tooltip; (d) everything else derived via `useMemo` chain (flatten → filter → sort → group → buckets), never stored, no state-syncing effects. Theme is the exception: `.dark` class + localStorage, ~15-line hand-rolled toggle (must apply pre-hydration, doesn't belong in URL).
    **Invariant (no nuqs/useState conflicts):** ephemeral state never duplicates a URL param — it is either a transient preview (drag renders locally, URL written once on pointer-up) or it references the dataset (selection by FlatLog id, expanded serviceKeys) and is cleared by `refresh()` since ids don't survive a new random dataset. Sheet stays open if the selected log is filtered out of view (selection references the dataset, not the filtered view).

## Dependencies (gate #4 — each stated with why)

- `next`, `react`, `typescript` — mandated stack (create-next-app)
- `tailwindcss` — styling (via scaffold)
- shadcn/ui (copy-in; brings `radix-ui` primitives, `lucide-react`) — dropdown/sheet/tooltip/toggle primitives
- `@tanstack/react-table` — headless sorting/grouping/expansion row model
- `@tanstack/react-virtual` — virtualized rows over the flattened row model (works in grouped mode too)
- `nuqs` — typed URL query state
- `vitest` — data-layer unit tests
- `@playwright/test` — UI behavior suite (core, not stretch; fixture-intercepted)

No chart library. No date library — hand-roll `timeAgo` with `Intl.RelativeTimeFormat` (~20 lines).

## Architecture

```
src/
  app/
    layout.tsx, page.tsx          # shell; page wires provider + toolbar + histogram + table + sheet
  lib/                            # PURE functions — the TDD surface
    otlp-types.ts                 # hand-written minimal OTLP interfaces (protobuf codegen is overkill)
    flatten.ts                    # ResourceLogs[] -> FlatLog[]
    severity.ts                   # severityNumber -> bucket + color/label (OTel ranges: 1-4 trace, 5-8 debug, 9-12 info, 13-16 warn, 17-20 error, 21-24 fatal, 0 unspecified)
    time.ts                       # timeAgo, window presets, prev/next shifting
    histogram.ts                  # chooseBucketSize(windowMs) -> nice unit targeting ~40-60 bars; bucketize(logs, window) -> per-severity stacked counts
    filter.ts                     # window filtering, group aggregation (counts, severity breakdown)
  components/
    logs-provider.tsx             # fetch-once context: {data, status, refresh()}
    toolbar.tsx                   # TimeRangePicker (presets + custom + arrows), view toggle, density toggle, refresh
    histogram.tsx                 # SVG: stacked bars, hover tooltip, drag-select overlay, click-to-bucket
    logs-table.tsx                # TanStack Table + virtualizer; flat & grouped via grouping/expanded row models
    group-header-row.tsx, severity-badge.tsx, time-cell.tsx (title attr = full timestamp)
    log-details-sheet.tsx         # sidebar per decision 6; copy-button.tsx
  styles/tokens.css               # the reskin surface (semantic tokens, light/dark)
  colocated *.test.ts             # Vitest
  e2e/                            # Playwright + fixtures/logs.json
```

`FlatLog`: `{ id (index-based), timeMs, severityNumber, severityText, body, attributes, serviceKey, serviceName, serviceNamespace, serviceVersion, scopeName, scopeAttributes, resourceAttributes, traceId?, spanId? }`.

## Test suites (defined with the user BEFORE implementation — draft, iterate together)

**Vitest — pure transforms only (not UI-observable):**
- `flatten`: nested OTLP fixture → FlatLog list (count, service keys, trace/span id extraction, missing/optional field handling, non-string body values)
- `severity`: severityNumber → bucket mapping incl. edges (0, 1–4, 5–8, 9–12, 13–16, 17–20, 21–24, out-of-range) and dash0-style legend groupings (ERROR & FATAL, TRACE & DEBUG, UNKNOWN)
- `histogram`: chooseBucketSize picks nice units (~40–60 bars) across window sizes; drag pixel-range → time-range snap math
- `time`: timeAgo formatting; prev/next window shifting

**Playwright — UI behavior, fixture-intercepted via `page.route` (owns anything user-visible; filtering lives here, not in Vitest):**
1. Table renders fixture rows, default sort Time desc
2. Severity column sort toggles asc/desc; Time sort toggles
3. Row click → sidebar with full body + attributes; copy button puts value on clipboard
4. View toggle → grouped: service headers with counts, expand/collapse reveals child rows
5. Histogram bucket click → window narrows to that bucket → table filtered
6. Histogram drag → range window → table filtered
7. Severity legend chip toggle → histogram bars AND table rows filtered; × clears the filter
8. Preset dropdown change (e.g. Last 1h) → histogram + table update
9. Prev/next arrows shift the window
10. Refresh button → second fixture served → table content changes
11. Body density toggle 1↔3 lines
12. Time cell exposes full timestamp on hover (title attr)
13. URL round-trip: set window + view + sort + severity via UI → open captured URL in fresh page → identical state (covers all URL writes + deep-link reads)
14. Mobile viewport (390px): rows render stacked two-line layout; row click opens full-width sheet; theme toggle switches light/dark

## Steps

1. **Scaffold** (~15 min): `create-next-app` (TS, Tailwind, App Router, src dir), shadcn init + needed components, install deps, Vitest + Playwright config, save API fixture. Commit.
2. **Write test skeletons, then HARD STOP** (~30 min): write both suites as `describe`/`it` skeletons where each test body contains comments explaining exactly what will be asserted (inputs, actions, expected outcomes) — no implementation, no assertions yet. Show them to the user inline and **wait for an explicit go/nogo** before writing any further code. Iterate on the skeletons until go.
3. **Data layer to green** (~30 min, after go): fill in Vitest assertions, implement `lib/` until green. Commit.
4. **Fetch provider + URL state** (~20 min): logs-provider, nuqs params (`window`, `view`, `sort`, `density`, `severities`).
5. **Flat table** (~45 min): TanStack + virtualizer, Severity/Time/Body columns, sortable Severity & Time (default: Time desc), severity badge, time-ago cell with `title` hover, body density toggle. Loading/empty/error states.
6. **Detail sidebar** (~30 min): per decision 6.
7. **Histogram + window controls + severity legend filter** (~75 min): SVG stacked bars, axis labels, hover tooltip, drag-to-select, click-to-bucket, legend chips (dash0 groupings) filtering bars + rows, toolbar presets + prev/next arrows.
8. **Grouped view** (~30 min): TanStack grouping by `serviceKey`, rich group header rows, expand/collapse, virtualized; respects severity filter.
9. **Polish pass** (~45 min): tokens-file audit (everything semantic, nothing hardcoded), light/dark toggle, mobile layouts (stacked rows, full-width sheet, tap-bucket), empty-window state ("no logs in this range — widen or refresh"), keyboard row navigation if cheap. All Playwright green by here.
10. **README + deploy** (~20 min): run instructions, architecture notes, explicit "production readiness" section (server-side pagination/streaming, live tail, etc.). **Copy this plan file into the repo** (e.g. `docs/PLAN.md`, linked from the README) — it documents the decision process and is part of the assignment submission. Vercel deploy (ask first). Final commit.

Total: ~5.5–6h. Commits at the end of each green step; no push without explicit word (gate #1). Steps 5–9 work the Playwright suite from red to green incrementally.

## Verification

- `npm test` (Vitest) and `npx playwright test` — both suites green; they ARE the spec.
- `npm run dev` → manual pass in Chrome: severity legend chips filter bars + rows; drag on histogram narrows window and URL updates; grouped view respects active filters; refresh pulls a new dataset.
- `npm run build` — clean production build before deploy.
