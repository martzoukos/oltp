import { expect, test, type Page } from "@playwright/test";
import { serveFixtures, uniqueBodyLog, type FixtureServer } from "./helpers";
import { legendGroupOf } from "../src/lib/severity";

// Every test intercepts the API with fixtures (the real API returns random
// data). Timestamps are rebased at serve time — see helpers.ts. Assertions
// use row content and relative comparisons, not absolute bucket counts.

async function openApp(page: Page, fixtures = ["logs.json"]): Promise<FixtureServer> {
  const server = await serveFixtures(page, fixtures);
  await page.goto("/");
  await page.locator("[data-log-row]").first().waitFor();
  return server;
}

const firstRow = (page: Page) => page.locator("[data-log-row]").first();
const rowBody = (row: ReturnType<Page["locator"]>) => row.locator("[data-log-body]");

test.describe("logs table", () => {
  test("renders fixture rows sorted by time desc by default", async ({ page }) => {
    const server = await openApp(page);
    const logs = server.flat();
    const newest = [...logs].sort((a, b) => b.timeMs - a.timeMs)[0];

    await expect(page.getByText(`${logs.length} of ${logs.length} logs`)).toBeVisible();
    await expect(rowBody(firstRow(page))).toHaveText(newest.body);
    await expect(page.getByRole("columnheader").filter({ hasText: "Time" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    // a row carries badge, time-ago, and monospace body
    await expect(firstRow(page).locator("[title]")).toBeVisible();
  });

  test("severity and time column sorts toggle asc/desc", async ({ page }) => {
    const server = await openApp(page);
    const logs = server.flat();
    const severities = logs.map((l) => l.severityNumber);
    const byTime = [...logs].sort((a, b) => a.timeMs - b.timeMs);

    // ties on severityNumber make body order unstable — assert the number itself
    await page.getByRole("button", { name: "Severity" }).click();
    await expect(page.getByRole("columnheader").first()).toHaveAttribute("aria-sort", "ascending");
    await expect(firstRow(page)).toHaveAttribute("data-severity", String(Math.min(...severities)));

    await page.getByRole("button", { name: "Severity" }).click();
    await expect(page.getByRole("columnheader").first()).toHaveAttribute("aria-sort", "descending");
    await expect(firstRow(page)).toHaveAttribute("data-severity", String(Math.max(...severities)));

    await page.getByRole("button", { name: "Time", exact: true }).click();
    await expect(rowBody(firstRow(page))).toHaveText(byTime[0].body);
    await page.getByRole("button", { name: "Time", exact: true }).click();
    await expect(rowBody(firstRow(page))).toHaveText(byTime[byTime.length - 1].body);
  });

  test("body density toggle switches rows between 1-line and 3-line", async ({ page }) => {
    await openApp(page);
    const row = firstRow(page);
    const height1 = (await row.boundingBox())!.height;
    await expect(rowBody(row)).toHaveCSS("-webkit-line-clamp", "1");

    await page.getByRole("radio", { name: "Expanded rows" }).click();
    await expect(rowBody(row)).toHaveCSS("-webkit-line-clamp", "3");
    await expect(page).toHaveURL(/density=3/);
    const height3 = (await row.boundingBox())!.height;
    expect(height3).toBeGreaterThan(height1);

    await page.getByRole("radio", { name: "Compact rows" }).click();
    await expect(rowBody(row)).toHaveCSS("-webkit-line-clamp", "1");
  });

  test("time cell exposes the full timestamp on hover via title attribute", async ({ page }) => {
    const server = await openApp(page);
    const newest = [...server.flat()].sort((a, b) => b.timeMs - a.timeMs)[0];
    await expect(firstRow(page).locator("[title]")).toHaveAttribute(
      "title",
      new Date(newest.timeMs).toISOString(),
    );
  });
});

test.describe("detail sidebar", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("row click opens sidebar with full body, ids, and attributes; copy works", async ({
    page,
  }) => {
    const server = await openApp(page);
    // Only the first ~viewport of rows is rendered (virtualization), so pick
    // the target from the newest rows shown by the default time-desc sort —
    // but check body uniqueness against the whole dataset.
    const logs = server.flat();
    const top = new Set(
      [...logs].sort((a, b) => b.timeMs - a.timeMs).slice(0, 12).map((l) => l.id),
    );
    const log = uniqueBodyLog(logs, (l) => top.has(l.id) && !!l.traceId && !!l.spanId);

    await page.locator("[data-log-row]", { hasText: log.body }).first().click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();

    // header: severity + full timestamp + service identity
    await expect(sheet).toContainText(new Date(log.timeMs).toISOString());
    await expect(sheet).toContainText(log.serviceName);
    // full body
    await expect(sheet.locator("[data-log-detail-body]")).toContainText(log.body.slice(0, 40));
    // first-class ids, not duplicated in the attributes table
    await expect(sheet).toContainText(log.traceId!);
    await expect(sheet).toContainText(log.spanId!);
    await expect(sheet.locator("dt", { hasText: "trace.id" })).toHaveCount(0);
    // log attributes listed
    for (const key of Object.keys(log.attributes).slice(0, 2)) {
      await expect(sheet).toContainText(key);
    }
    // resource + scope sections collapsed by default
    await expect(sheet.locator("details[open]")).toHaveCount(0);

    await sheet.getByRole("button", { name: "Copy trace.id" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(log.traceId);

    await sheet.getByRole("button", { name: "Copy as JSON" }).click();
    const record = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
    expect(record.traceId).toBe(log.traceId);
    expect(record.body).toBe(log.body);
  });
});

test.describe("keyboard navigation", () => {
  test("arrows drive an outlined row from first load; enter opens, movement resumes after close", async ({
    page,
  }) => {
    await openApp(page);
    const rows = page.locator("[data-log-row]");

    // Nothing is focused yet — arrows must work immediately.
    await page.keyboard.press("ArrowDown");
    await expect(rows.nth(0)).toHaveAttribute("data-active", "true");
    await page.keyboard.press("ArrowDown");
    await expect(rows.nth(1)).toHaveAttribute("data-active", "true");
    await expect(rows.nth(0)).not.toHaveAttribute("data-active", "true");
    await page.keyboard.press("ArrowUp");
    await expect(rows.nth(0)).toHaveAttribute("data-active", "true");

    // Enter opens the sheet for the active row.
    const activeBody = await rows.nth(0).locator("[data-log-body]").textContent();
    await page.keyboard.press("Enter");
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.locator("[data-log-detail-body]")).toContainText(
      activeBody!.replace(/…$/, "").slice(0, 30),
    );

    // Escape closes; movement resumes from the row the sheet was opened on.
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await page.keyboard.press("ArrowDown");
    await expect(rows.nth(1)).toHaveAttribute("data-active", "true");

    // Hovering parks the cursor; arrows continue from there.
    await rows.nth(4).hover();
    await expect(rows.nth(4)).toHaveAttribute("data-active", "true");
    await page.keyboard.press("ArrowDown");
    await expect(rows.nth(5)).toHaveAttribute("data-active", "true");
  });

  test("open sheet pages through logs via arrows and prev/next buttons", async ({ page }) => {
    const server = await openApp(page);
    // Default sort is time desc — the table order the sheet navigates.
    const ordered = [...server.flat()].sort((a, b) => b.timeMs - a.timeMs);
    const iso = (i: number) => new Date(ordered[i].timeMs).toISOString();
    const rows = page.locator("[data-log-row]");
    const sheet = page.getByRole("dialog");

    await rows.nth(0).click();
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText(iso(0));
    await expect(sheet.locator("[data-sheet-position]")).toHaveText(`1 of ${ordered.length}`);
    await expect(sheet.getByRole("button", { name: "Previous log" })).toBeDisabled();

    // Arrows keep working while the sheet is open and switch the shown log.
    await page.keyboard.press("ArrowDown");
    await expect(sheet).toContainText(iso(1));
    await expect(sheet.locator("[data-sheet-position]")).toHaveText(`2 of ${ordered.length}`);
    await expect(rows.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(sheet.getByRole("button", { name: "Previous log" })).toBeEnabled();

    // Prev/next buttons navigate the same order.
    await sheet.getByRole("button", { name: "Next log" }).click();
    await expect(sheet).toContainText(iso(2));
    await sheet.getByRole("button", { name: "Previous log" }).click();
    await expect(sheet).toContainText(iso(1));
    await page.keyboard.press("ArrowUp");
    await expect(sheet).toContainText(iso(0));
    await expect(sheet.getByRole("button", { name: "Previous log" })).toBeDisabled();

    // Non-modal: the table behind stays interactive — clicking another row
    // switches the sheet instead of closing it.
    await rows.nth(3).click();
    await expect(sheet).toContainText(iso(3));

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(rows.nth(3)).toHaveAttribute("data-active", "true");
  });
});

test.describe("grouped view", () => {
  test("view toggle groups rows under expandable service headers", async ({ page }) => {
    const server = await openApp(page);
    const logs = server.flat();
    const counts = new Map<string, number>();
    for (const log of logs) counts.set(log.serviceKey, (counts.get(log.serviceKey) ?? 0) + 1);
    const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);

    await page.getByRole("switch", { name: "Group by service" }).click();
    await expect(page).toHaveURL(/view=grouped/);

    const headers = page.locator("[data-group-header]");
    await expect(headers).toHaveCount(counts.size);
    // groups ordered by count desc; header shows count badge
    await expect(headers.first()).toHaveAttribute("data-group-header", ordered[0][0]);
    await expect(headers.first()).toContainText(String(ordered[0][1]));
    // children hidden until expanded
    await expect(page.locator("[data-log-row]")).toHaveCount(0);

    await headers.first().click();
    await expect(headers.first()).toHaveAttribute("aria-expanded", "true");
    expect(await page.locator("[data-log-row]").count()).toBeGreaterThan(0);

    await headers.first().click();
    await expect(page.locator("[data-log-row]")).toHaveCount(0);
  });
});

test.describe("histogram & time window", () => {
  test("clicking a histogram bucket narrows the window to that bucket", async ({ page }) => {
    await openApp(page);
    const bar = page.locator("[data-histogram-bar] rect").first();
    await bar.click();

    await expect(page).toHaveURL(/window=\d+-\d+/);
    const match = /window=(\d+)-(\d+)/.exec(page.url())!;
    // default 24h window buckets at 30m — a click selects exactly one bucket
    expect(Number(match[2]) - Number(match[1])).toBe(30 * 60_000);
  });

  test("dragging across the histogram selects a time range", async ({ page }) => {
    const server = await openApp(page);
    const svg = page.locator("[data-histogram] svg");
    const box = (await svg.boundingBox())!;

    await page.mouse.move(box.x + box.width * 0.2, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, box.y + 40, { steps: 5 });
    await page.mouse.up();

    await expect(page).toHaveURL(/window=\d+-\d+/);
    const match = /window=(\d+)-(\d+)/.exec(page.url())!;
    const [fromMs, toMs] = [Number(match[1]), Number(match[2])];
    expect(toMs - fromMs).toBeGreaterThan(30 * 60_000); // multi-bucket range

    // table is filtered to the selected range
    const logs = server.flat();
    const expected = logs.filter((l) => l.timeMs >= fromMs && l.timeMs < toMs).length;
    await expect(page.getByText(`${expected} of ${logs.length} logs`)).toBeVisible();
  });

  test("severity legend chips filter bars and rows; clear resets", async ({ page }) => {
    const server = await openApp(page);
    const logs = server.flat();
    const groupCount = (groups: string[]) =>
      logs.filter((l) => groups.includes(legendGroupOf(l.severityNumber))).length;

    await page.getByRole("button", { name: /Error & Fatal/ }).click();
    await expect(page).toHaveURL(/severities=error/);
    await expect(page.getByText(`${groupCount(["error"])} of ${logs.length} logs`)).toBeVisible();
    // only error-group segments remain in the bars
    const groups = await page
      .locator("[data-histogram-bar] rect")
      .evaluateAll((rects) => [...new Set(rects.map((r) => (r as SVGElement).dataset.severityGroup))]);
    expect(groups).toEqual(["error"]);

    // second chip -> union
    await page.getByRole("button", { name: /Warn/ }).click();
    await expect(
      page.getByText(`${groupCount(["error", "warn"])} of ${logs.length} logs`),
    ).toBeVisible();

    await page.getByRole("button", { name: "Clear severity filter" }).click();
    await expect(page.getByText(`${logs.length} of ${logs.length} logs`)).toBeVisible();
    await expect(page).not.toHaveURL(/severities=/);
  });

  test("preset dropdown change updates histogram and table", async ({ page }) => {
    const server = await openApp(page);
    const logs = server.flat();
    const nowMs = Math.max(...logs.map((l) => l.timeMs));
    const expected = logs.filter((l) => l.timeMs > nowMs - 3_600_000).length;

    await page.locator("[data-time-range-trigger]").click();
    await page.getByRole("menuitem", { name: "Last 1 hour" }).click();

    await expect(page).toHaveURL(/window=1h/);
    // fetchedAt (the app's anchor) is within ~1s of the newest record; the
    // count can therefore differ only if a record sits within that sliver of
    // the boundary — the fixture has none.
    await expect(page.getByText(`${expected} of ${logs.length} logs`)).toBeVisible();
  });

  test("prev/next arrows shift the window by its own length", async ({ page }) => {
    await openApp(page);
    await page.locator("[data-time-range-trigger]").click();
    await page.getByRole("menuitem", { name: "Last 1 hour" }).click();
    await expect(page).toHaveURL(/window=1h/);

    await page.getByRole("button", { name: "Previous time window" }).click();
    await expect(page).toHaveURL(/window=\d+-\d+/);
    const prev = /window=(\d+)-(\d+)/.exec(page.url())!;
    expect(Number(prev[2]) - Number(prev[1])).toBe(3_600_000);

    await page.getByRole("button", { name: "Next time window" }).click();
    await expect(page).toHaveURL(new RegExp(`window=${prev[2]}-`));
    const next = /window=(\d+)-(\d+)/.exec(page.url())!;
    expect(Number(next[1])).toBe(Number(prev[2]));
    expect(Number(next[2]) - Number(next[1])).toBe(3_600_000);
  });

  test("span indicator tracks the window length and undo steps back through zooms", async ({
    page,
  }) => {
    await openApp(page);
    const span = page.locator("[data-window-span]");
    const back = page.getByRole("button", { name: "Undo zoom" });

    // default 24h preset — indicator visible, nothing to undo yet
    await expect(span).toHaveText("24h");
    await expect(back).toBeHidden();

    // first zoom: one 30m bucket
    await page.locator("[data-histogram-bar] rect").first().click();
    await expect(page).toHaveURL(/window=\d+-\d+/);
    await expect(span).toHaveText("30m");
    await expect(back).toBeVisible();

    // second zoom: a 30m window buckets at 30s
    await page.locator("[data-histogram-bar] rect").first().click();
    await expect(span).toHaveText("30s");

    // undo unwinds one zoom at a time, ending back on the live preset
    await back.click();
    await expect(span).toHaveText("30m");
    await back.click();
    await expect(span).toHaveText("24h");
    await expect(page).not.toHaveURL(/window=\d+-\d+/);
    await expect(back).toBeHidden();

    // a toolbar window change is deliberate — it clears the undo history
    await page.locator("[data-histogram-bar] rect").first().click();
    await expect(back).toBeVisible();
    await page.locator("[data-time-range-trigger]").click();
    await page.getByRole("menuitem", { name: "Last 1 hour" }).click();
    await expect(span).toHaveText("1h");
    await expect(back).toBeHidden();
  });

  test("refresh pulls a new dataset", async ({ page }) => {
    const server = await openApp(page, ["logs.json", "logs-refresh.json"]);
    const firstTotal = server.flat(0).length;
    await expect(page.locator("[data-dataset-id='1']")).toBeVisible();

    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.locator("[data-dataset-id='2']")).toBeVisible();
    const secondTotal = server.flat(1).length;
    await expect(page.getByText(`of ${secondTotal} logs`)).toBeVisible();
    expect(server.served).toHaveLength(2);
    // totals differ between the two captured fixtures, proving new content
    expect(secondTotal).not.toBe(firstTotal);
  });
});

test.describe("url state", () => {
  test("full URL round-trip restores window, view, sort, density, and severities", async ({
    page,
    context,
  }) => {
    await openApp(page);

    await page.locator("[data-time-range-trigger]").click();
    await page.getByRole("menuitem", { name: "Last 1 hour" }).click();
    await page.getByRole("switch", { name: "Group by service" }).click();
    await page.getByRole("button", { name: "Severity" }).click(); // severity.asc
    await page.getByRole("radio", { name: "Expanded rows" }).click();
    await page.getByRole("button", { name: /Error & Fatal/ }).click();
    await expect(page).toHaveURL(/severities=error/);
    await expect(page).toHaveURL(/density=3/);
    const url = page.url();

    const fresh = await context.newPage();
    await serveFixtures(fresh, ["logs.json"]);
    await fresh.goto(url);
    await fresh.locator("[data-group-header]").first().waitFor();

    await expect(fresh.locator("[data-time-range-trigger]")).toHaveText(/Last 1 hour/);
    await expect(fresh.getByRole("switch", { name: "Group by service" })).toBeChecked();
    await expect(fresh.getByRole("columnheader").first()).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await expect(fresh.getByRole("radio", { name: "Expanded rows" })).toHaveAttribute(
      "data-state",
      "on",
    );
    await expect(fresh.getByRole("button", { name: /Error & Fatal/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await fresh.close();
  });
});

test.describe("mobile @mobile", () => {
  test("stacked rows, full-width sheet, theme toggle", async ({ page }) => {
    await openApp(page);

    // stacked two-line layout; column headers replaced by the toolbar sort menu
    await expect(firstRow(page).locator("[data-mobile-row-meta]")).toBeVisible();
    await expect(page.getByRole("columnheader").first()).toBeHidden();
    await expect(page.getByRole("button", { name: "Sort logs" })).toBeVisible();

    // tapping a row opens a full-width sheet
    await firstRow(page).tap();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const viewport = page.viewportSize()!;
    expect((await sheet.boundingBox())!.width).toBeCloseTo(viewport.width, 0);
    await page.keyboard.press("Escape");

    // theme toggle flips the class and persists across reload
    await page.getByRole("button", { name: "Toggle theme" }).tap();
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    await page.reload();
    await page.locator("[data-log-row]").first().waitFor();
    expect(
      await page.evaluate(() => document.documentElement.classList.contains("dark")),
    ).toBe(isDark);
  });
});
