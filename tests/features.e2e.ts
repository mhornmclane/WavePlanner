import { test, expect } from "@playwright/test";
import { baseline, profiles, teamId } from "../src/data";
import { exchangeSummaries, simulate } from "../src/engine";
import { clock, pace } from "../src/format";

test("wave start accepts signed and fractional hour offsets and retains them in saves", async ({
  page,
}) => {
  await page.goto("./");
  const offset = page.getByLabel("Wave 1 start offset (hours)", {
    exact: true,
  });
  const display = page.locator(".wave-start-offset output").first();
  await expect(offset).toHaveValue("0");
  await expect(display).toHaveText("Day 1 01:00");
  await offset.fill("-3");
  await expect(display).toHaveText("Day 0 22:00 (previous day)");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".staffing-table tbody tr").first()).toContainText(
    "D0 22:00",
  );
  await expect(page.locator(".chart-scroll")).toContainText("-3h");
  await offset.fill("+3");
  await expect(display).toHaveText("Day 1 04:00");
  await offset.fill("0.5");
  await expect(display).toHaveText("Day 1 01:30");
  await offset.fill("-");
  await expect(page.getByRole("alert")).toContainText("numeric start offset");
  await offset.fill("-3");
  await page
    .getByLabel("Configuration name", { exact: true })
    .fill("Early wave offset");
  await page
    .getByRole("button", { name: "Save configuration", exact: true })
    .click();
  await page.reload();
  await page
    .getByLabel("Load configuration")
    .selectOption({ label: "Early wave offset" });
  await expect(offset).toHaveValue("-3");
  await expect(display).toHaveText("Day 0 22:00 (previous day)");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("linked wave boundaries update rosters, prevent overlap and sort the field", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "+ Add wave", exact: true }).click();
  await page.getByLabel("New shared pace boundary").fill("12:00");
  await page.getByRole("button", { name: "Confirm split" }).click();
  const first = page.getByLabel("Wave 1 maximum pace (exclusive)");
  const second = page.getByLabel("Wave 2 minimum pace (inclusive)");
  await expect(first).toHaveValue("12:00");
  await expect(second).toHaveValue("12:00");
  await first.fill("11:00");
  await first.press("Enter");
  await expect(second).toHaveValue("11:00");
  const fastCount = profiles.filter(
    (p) => p.overall_mean_pace_seconds_per_mile < 660,
  ).length;
  await expect(
    page.locator(".wave-card").first().locator(".wave-count"),
  ).toHaveText(`${fastCount} teams`);
  await page.locator(".wave-members summary").first().click();
  await expect(
    page.locator(".wave-card").first().locator(".wave-roster li"),
  ).toHaveCount(fastCount);
  await page.getByRole("button", { name: "Split this range" }).last().click();
  await page.getByLabel("New shared pace boundary").fill("14:00");
  await page.getByRole("button", { name: "Confirm split" }).click();
  await first.fill("15:00");
  await first.press("Enter");
  await expect(first).toHaveAttribute("aria-invalid", "true");
  await expect(second).toHaveValue("11:00");
  await first.press("Escape");
  await page.getByRole("tab", { name: /Historical field/ }).click();
  await expect(page.getByLabel("Bulk assignment wave")).toHaveCount(0);
  const fastest = Math.min(
    ...profiles.map((p) => p.overall_mean_pace_seconds_per_mile),
  );
  const slowest = Math.max(
    ...profiles.map((p) => p.overall_mean_pace_seconds_per_mile),
  );
  await expect(page.locator(".overall-pace").first()).toHaveText(pace(fastest));
  await page.getByRole("button", { name: "Overall ↑" }).click();
  await expect(page.locator(".overall-pace").first()).toHaveText(pace(slowest));
  await page.getByLabel("Search teams", { exact: true }).fill("BCSO");
  await expect(page.locator(".results-label")).toContainText(
    "51 HISTORICAL TEAMS",
  );
});

test("five visual pace nodes support dragging, keyboard and independent mode settings", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await page
    .getByRole("tab", { name: "Release schedule", exact: true })
    .click();
  await page.getByRole("radio", { name: /Generate from pace/ }).check();
  await page.getByLabel("Segment 1 pace").fill("12:34");
  await page.getByRole("radio", { name: /Visual five-section pace/ }).check();
  await expect(page.locator('.pace-editor [role="slider"]')).toHaveCount(5);
  await page.getByLabel("Visual section 1 pace").fill("11:30");
  const node = page.getByRole("slider", { name: /Visual pace node 1,/ });
  await node.focus();
  await node.press("ArrowUp");
  await expect(page.getByLabel("Visual section 1 pace")).toHaveValue("11:29");
  const rect = (await node.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width / 2,
    rect.y + rect.height / 2 + 15,
    { steps: 6 },
  );
  await page.mouse.up();
  await expect(page.getByLabel("Visual section 1 pace")).not.toHaveValue(
    "11:29",
  );
  const after = await page.getByLabel("Visual section 1 pace").inputValue();
  await expect(page.locator(".release-pace-label")).toHaveCount(5);
  await page.getByRole("radio", { name: /Generate from pace/ }).check();
  await expect(page.getByLabel("Segment 1 pace")).toHaveValue("12:34");
  await page.getByRole("radio", { name: /Visual five-section pace/ }).check();
  await expect(page.getByLabel("Visual section 1 pace")).toHaveValue(after);
  await page.getByLabel("Visual section 2 pace").fill("bad");
  await expect(page.getByRole("alert")).toContainText("five");
  await page.getByLabel("Visual section 2 pace").fill("10:25");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.screenshot({
    path: test.info().outputPath("visual-editor.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("exchange popup agrees with engine, supports endpoints, pinning, releases and keyboard", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByLabel("Highlight team", { exact: true })
    .selectOption(teamId(profiles[0]));
  await page
    .getByRole("checkbox", { name: "Release schedule", exact: true })
    .uncheck();
  const hit = page.locator('.hit-line[data-leg="36"]').first();
  await hit.scrollIntoViewIfNeeded();
  // Use actual SVG endpoint geometry rather than the bounding box of a diagonal line.
  const points = await hit.evaluate((el) => {
    const l = el as SVGLineElement;
    const matrix = l.getScreenCTM()!;
    const a = new DOMPoint(
      l.x1.baseVal.value,
      l.y1.baseVal.value,
    ).matrixTransform(matrix);
    const b = new DOMPoint(
      l.x2.baseVal.value,
      l.y2.baseVal.value,
    ).matrixTransform(matrix);
    return { x: a.x * 0.9 + b.x * 0.1, y: a.y * 0.9 + b.y * 0.1 };
  });
  await page.mouse.move(points.x, points.y);
  const popup = page.locator(".exchange-popup");
  await expect(popup).toContainText("EX 35");
  const result = simulate(baseline());
  await expect(popup).toContainText(
    clock(result.exchanges[35].latestDeparture),
  );
  await expect(popup).toContainText("Field (51)");
  await expect(popup).toContainText("Wave (51)");
  await page.mouse.click(points.x, points.y);
  await expect(popup).toHaveAttribute("role", "dialog");
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await page.getByLabel("Inspect exchange", { exact: true }).selectOption("71");
  await page.getByRole("button", { name: "Show exchange details" }).focus();
  await page.keyboard.press("Enter");
  await expect(popup).toContainText("FINISH");
  await expect(popup).toContainText("no outgoing runner");
  await page.keyboard.press("Escape");
  await page
    .getByRole("checkbox", { name: "2026 baseline", exact: true })
    .check();
  await page.getByLabel("Inspect exchange", { exact: true }).selectOption("0");
  await page.getByRole("button", { name: "Show exchange details" }).click();
  await expect(popup).toContainText("START");
  await expect(popup).toContainText("Change from 2026 baseline");
  await page.keyboard.press("Escape");
  const point = page.locator('[data-release-leg="15"]');
  await page
    .getByRole("checkbox", { name: "Release schedule", exact: true })
    .check();
  await point.hover();
  await expect(popup).toContainText("Release point · outbound leg 15");
  await expect(popup).toContainText("Nominal pace 10:25");
  await page.getByRole("heading", { name: "The field, over time" }).click();
  await expect(popup).toHaveCount(0);
});

test("legacy saves preserve manual assignments until a reviewed conversion", async ({
  page,
}) => {
  const s = baseline();
  s.waves.push({ id: "late", name: "Later", color: "#123456", start: 7200 });
  s.assignments[s.selectedTeamIds[0]] = "late";
  const old: any = structuredClone(s);
  old.schemaVersion = 1;
  delete old.waveRules;
  delete old.release.visualPaces;
  await page.goto("./");
  await page.getByLabel("Import configuration JSON").setInputFiles({
    name: "legacy.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(old)),
  });
  await expect(
    page.locator(".wave-card").last().locator(".wave-count"),
  ).toHaveText("1 teams");
  await page.getByRole("button", { name: "Preview pace ranges" }).click();
  await expect(page.locator(".range-preview")).toContainText(
    "replaces manual assignments",
  );
  await page.getByRole("button", { name: "Cancel conversion" }).click();
  await expect(
    page.locator(".wave-card").last().locator(".wave-count"),
  ).toHaveText("1 teams");
  await page.getByRole("button", { name: "Preview pace ranges" }).click();
  await page.getByRole("button", { name: "Apply pace ranges" }).click();
  await expect(
    page.getByLabel("Wave 1 maximum pace (exclusive)"),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("mobile visual editor and pinned popup remain within viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await page
    .getByRole("tab", { name: "Release schedule", exact: true })
    .click();
  await page.getByRole("radio", { name: /Visual five-section pace/ }).check();
  await expect(page.getByLabel("Visual section 5 pace")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Show exchange details" }).click();
  const popup = page.locator(".exchange-popup");
  await expect(popup).toBeVisible();
  const rect = (await popup.boundingBox())!;
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(390);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.y + rect.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: test.info().outputPath("mobile-popup.png") });
});

test("popup wave windows and baseline differences match a multi-wave simulation", async ({
  page,
}) => {
  const s = baseline();
  s.waves.push({
    id: "slower",
    name: "Slower start",
    start: 7200,
    color: "#993355",
  });
  s.waveRules = { mode: "pace", boundaries: [660] };
  s.buffers = { before: 600, after: 900 };
  const result = simulate(s);
  const slower = result.teams.filter((t) => t.waveId === "slower");
  const wave = exchangeSummaries(slower, s.buffers)[35];
  await page.goto("./");
  await page.getByLabel("Import configuration JSON").setInputFiles({
    name: "ranges.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(s)),
  });
  await page
    .getByLabel("Highlight team", { exact: true })
    .selectOption(slower[0].teamId);
  await page
    .getByRole("checkbox", { name: "2026 baseline", exact: true })
    .check();
  await page.getByLabel("Inspect exchange", { exact: true }).selectOption("35");
  await page.getByRole("button", { name: "Show exchange details" }).click();
  const popup = page.locator(".exchange-popup");
  await expect(popup).toContainText(`Wave (${slower.length})`);
  const firstArrival = popup
    .locator("table")
    .first()
    .getByRole("row", { name: /^First arrival/ });
  await expect(firstArrival.locator("td").nth(0)).toHaveText(
    clock(result.exchanges[35].earliestArrival),
  );
  await expect(firstArrival.locator("td").nth(1)).toHaveText(
    clock(wave.earliestArrival),
  );
  const departure = popup
    .locator("table")
    .first()
    .getByRole("row", { name: /^Last departure/ });
  await expect(departure.locator("td").nth(1)).toHaveText(
    clock(wave.latestDeparture),
  );
  await page.screenshot({ path: test.info().outputPath("wave-popup.png") });
  await page.getByLabel("Chart zoom").fill("2");
  await expect(popup).toHaveCount(0);
});
