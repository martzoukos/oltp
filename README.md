# OTLP Log Viewer

**Live: [oltp-pi.vercel.app](https://oltp-pi.vercel.app)**

A log viewer for OTLP log records, built with Next.js (App Router), React, and
TypeScript. Fetches from the take-home OTLP logs API, flattens the nested
resource → scope → record hierarchy client-side, and renders a virtualized,
filterable, deep-linkable log exploration UI.

## Run it

```bash
npm install
npx playwright install chromium   # once, for the e2e suite
npm run dev                       # http://localhost:3000
```

Tests:

```bash
npm test              # Vitest — pure data-layer transforms
npm run test:e2e      # Playwright — UI behavior against the production build
```

The e2e suite intercepts the API with captured fixtures (`e2e/fixtures/`) and
rebases their timestamps at serve time — the real API returns random data per
request, so fixtures are the only route to deterministic UI tests.

## What it does

- **Histogram** — hand-rolled SVG, stacked by severity group. Click a bar to
  zoom to that bucket; drag to select a range; hover for per-severity counts.
  Bucket sizes snap to nice units targeting ≤60 bars per window. A chip above
  the chart shows the window length, with an undo button that steps back
  through zooms.
- **Severity filtering** — the legend chips under the histogram are the filter
  (dash0 pattern): Error & Fatal, Warn, Info, Trace & Debug, Unknown. Chips
  filter bars and rows together.
- **Time windows** — presets (30m/1h/6h/24h/7d), custom absolute ranges, and
  prev/next arrows that shift the window by its own length. Shifted windows
  become fixed ranges — they stop following the clock.
- **Flat & grouped views** — flat is a virtualized sortable table; a
  "Group by service" toggle nests rows under sticky, open-by-default service
  headers ordered by log count, each with a severity breakdown.
- **Detail sheet** — non-modal: the table stays scrollable and clickable while
  it's open. Full body (JSON pretty-printed), first-class trace.id/span.id
  with copy buttons, log attributes; service resource attributes fold into the
  header and scope shows as an instrumentation footer. Copy any id, the body,
  or the whole record as JSON. Previous/Next buttons and arrow keys page
  through logs in table order, with a "3 of 325" position counter.
- **Keyboard nav** — arrow keys move the row cursor from first load,
  Enter/Space opens the sheet, Escape closes it.
- **URL state** — window, view, sort, density, and severity filter live in the
  URL (nuqs). Any view is shareable as a link.
- **Light/dark** — system default plus a toggle, applied pre-hydration.
- **Mobile** — stacked two-line rows, toolbar sort menu, full-width sheet,
  tap-a-bar bucket selection.

## Architecture

```
src/
  lib/            # pure functions — the unit-tested core
    otlp-types.ts   # minimal hand-written OTLP interfaces
    flatten.ts      # ResourceLogs[] -> FlatLog[] (+ value canonicalization)
    severity.ts     # OTel ranges -> buckets -> legend groups (single source of truth)
    time.ts         # timeAgo, presets, window shifting
    histogram.ts    # bucket sizing, stacking counts, drag snapping
    filter.ts       # service grouping/aggregation
    url-state.ts    # nuqs parsers for every shareable state param
  components/     # logs-provider (fetch-once context) + UI
  styles/tokens.css # the reskin surface — semantic tokens, light+dark
```

Design decisions worth naming:

- **Data flows one way**: fetch once → flatten → `useMemo` chain
  (window filter → severity filter → sort/group → buckets). Nothing derived is
  ever stored in state; URL state and React state are the same thing via nuqs.
- **Ephemeral state references the dataset**: selection and expanded groups
  use ids that don't survive a refresh, so refresh clears them. The detail
  sheet deliberately stays open when its log is filtered out of the table.
- **trace.id/span.id** arrive as attributes from this API (the OTLP spec puts
  them top-level); `flatten` promotes either form and drops the attribute copy.
- **TanStack Table** drives flat-view sorting; grouped view is hand-rolled
  because TanStack's grouped row model can't order groups by aggregate count.
- **Severity palette** validated for color-vision-deficiency and
  normal-vision separation in both themes; gray for trace/debug is the
  observability convention, and every colored mark carries a text label.
- The full decision log (interview-style, locked before implementation) is in
  [docs/PLAN.md](docs/PLAN.md); the test suites were specced as skeletons and
  approved before any implementation code was written.

## Production readiness — what this deliberately defers

- **Server-side pagination/streaming.** The app fetches the whole dataset and
  windows client-side — right for ~600 records, wrong at scale. Production
  needs cursor pagination driven by the time window, with the histogram served
  by a pre-aggregated endpoint.
- **Live tail.** There's a Refresh button, not a streaming tail. Production
  would follow new records over SSE/WebSocket with the window pinned to "now".
- **Stable record ids.** Ids are index-based per dataset because the API
  returns random data; selection can't survive a refresh. Real ingest ids
  would make selection, permalinks-to-records, and diffing possible.
- **Full-text search / attribute queries** — the obvious next filter axis.
- **Error budgets around the fetch**: one retry button, no backoff/telemetry.
