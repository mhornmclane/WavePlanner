import { test, expect } from "@playwright/test";
import { baseline, profiles, teamId } from "../src/data";
import { simulate } from "../src/engine";
import { clock, duration } from "../src/format";

test("full historical field renders under repository subpath and agrees with engine", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const failed: string[] = [];
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(r.url());
  });
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Race configuration" }),
  ).toBeVisible();
  await expect(page.locator(".results-label")).toContainText(
    "51 SELECTED TEAMS",
  );
  const r = simulate(baseline());
  await expect(
    page.locator(".metrics article").nth(0).locator("strong"),
  ).toHaveText(duration(r.finishSpread));
  await expect(
    page.locator(".metrics article").nth(1).locator("strong"),
  ).toHaveText(clock(r.lastOffCourse));
  await expect(
    page.locator(".metrics article").nth(3).locator("strong"),
  ).toHaveText(String(r.releaseCount));
  await expect(page.locator(".staffing-table tbody tr")).toHaveCount(72);
  const monument = page.locator(".staffing-table tbody tr").nth(35);
  await expect(monument).toContainText(clock(r.exchanges[35].latestArrival));
  await page
    .getByRole("checkbox", { name: "2026 baseline", exact: true })
    .check();
  await expect(
    page.getByRole("columnheader", { name: "2026 coverage", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".staffing-table .improved, .staffing-table .increased"),
  ).toHaveCount(0);
  await page.screenshot({
    path: test.info().outputPath("desktop.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test("team selection, year filtering, wave assignment and removal work", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "+ Add wave", exact: true }).click();
  await page.getByLabel("New shared pace boundary").fill("1:00");
  await page
    .getByRole("button", { name: "Confirm split", exact: true })
    .click();
  await page.getByLabel("Wave 1 name", { exact: true }).fill("Late starters");
  await page
    .getByLabel("Wave 1 start offset (hours)", { exact: true })
    .fill("2");
  await page.getByRole("tab", { name: /Historical field/ }).click();
  await expect(page.locator(".team-table tbody tr")).toHaveCount(51);
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page.locator(".results-label")).toContainText(
    "0 SELECTED TEAMS",
  );
  await expect(
    page.getByText("Select at least one team to see its course timeline."),
  ).toBeVisible();
  await page.getByLabel("Filter historical year").selectOption("2026");
  await expect(page.locator(".team-table tbody tr")).toHaveCount(11);
  await page.getByRole("button", { name: "Select shown", exact: true }).click();
  await expect(page.locator(".results-label")).toContainText(
    "11 SELECTED TEAMS",
  );
  await page.getByRole("tab", { name: /Starting waves/ }).click();
  await expect(page.locator(".wave-row").nth(0)).toContainText("11 teams");
  await page
    .getByRole("button", { name: "Remove wave 1", exact: true })
    .click();
  await expect(page.locator(".wave-row")).toHaveCount(1);
  await expect(page.locator(".wave-row")).toContainText("11 teams");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("release editing validates input, buffers affect coverage, chart is inspectable", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("tab", { name: "Release schedule", exact: true })
    .click();
  await page.getByRole("radio", { name: /Generate from pace/ }).check();
  await page.getByLabel("Segment 1 pace").fill("12:00");
  await page.getByRole("button", { name: "+ Add pace segment" }).click();
  await page.getByLabel("Segment 2 starting leg").fill("36");
  await page.getByLabel("Segment 2 pace").fill("11:30");
  await page.getByLabel("Segment 2 starting leg").fill("1");
  await expect(page.getByRole("alert")).toContainText("unique starting legs");
  await expect(
    page.getByRole("button", { name: "Save configuration", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Segment 2 starting leg").fill("36");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByLabel("Segment 1 pace").fill("bad");
  await expect(page.getByRole("alert")).toContainText("positive m:ss");
  await page.getByLabel("Segment 1 pace").fill("12:00");
  await page.getByText("Inspect all 71 release times", { exact: true }).click();
  await expect(page.locator(".schedule-table tbody tr")).toHaveCount(71);
  const before = await page
    .locator(".metrics article")
    .nth(2)
    .locator("strong")
    .innerText();
  await page
    .getByRole("tab", { name: "Staffing & assumptions", exact: true })
    .click();
  await page.getByLabel("Before first activity", { exact: true }).fill("10");
  await page.getByLabel("After last activity", { exact: true }).fill("15");
  const after = await page
    .locator(".metrics article")
    .nth(2)
    .locator("strong")
    .innerText();
  expect(parseFloat(after) - parseFloat(before)).toBeCloseTo(30, 1);
  await page
    .getByLabel("Highlight team", { exact: true })
    .selectOption(teamId(profiles[0]));
  await page.getByRole("button", { name: "Exchanges", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Exchanges", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Chart zoom").fill("2");
  await expect(page.locator(".zoom")).toContainText("2×");
  // Removing a highlighted team must restore a visible, undimmed field.
  await page.getByRole("tab", { name: /Historical field/ }).click();
  await page
    .getByLabel(`Include ${profiles[0].team} ${profiles[0].year}`, {
      exact: true,
    })
    .uncheck();
  await expect(page.getByLabel("Highlight team", { exact: true })).toHaveValue(
    "",
  );
});

test("save, duplicate, load, delete and JSON/CSV exports round trip; invalid import is non-destructive", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByLabel("Configuration name", { exact: true })
    .fill("Wave experiment");
  await page
    .getByRole("button", { name: "Save configuration", exact: true })
    .click();
  await expect(page.locator(".config-status")).toContainText(
    "Saved in this browser",
  );
  const exportEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "↓ JSON", exact: true }).click();
  const jsonDownload = await exportEvent;
  const exported = test.info().outputPath("scenario.json");
  await jsonDownload.saveAs(exported);
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(
    page.getByLabel("Configuration name", { exact: true }),
  ).toHaveValue("Wave experiment copy");
  await page.getByRole("button", { name: "Delete saved", exact: true }).click();
  await page
    .getByLabel("Load configuration")
    .selectOption({ label: "Wave experiment" });
  await expect(
    page.getByLabel("Configuration name", { exact: true }),
  ).toHaveValue("Wave experiment");
  await page.reload();
  await page
    .getByLabel("Load configuration")
    .selectOption({ label: "Wave experiment" });
  await page.getByLabel("Import configuration JSON").setInputFiles(exported);
  await expect(page.locator(".notice")).toContainText(
    "Imported Wave experiment",
  );
  await page.getByLabel("Import configuration JSON").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":2}'),
  });
  await expect(page.getByRole("alert")).toContainText("Import rejected");
  await expect(
    page.getByLabel("Configuration name", { exact: true }),
  ).toHaveValue("Wave experiment");
  const csvEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "↓ Export all CSV", exact: true })
    .click();
  const csv = await csvEvent;
  expect(csv.suggestedFilename()).toBe("ruck4hit-exchange-staffing.csv");
  await csv.saveAs(test.info().outputPath("staffing.csv"));
});

test("keyboard tabs and small-screen layout remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await page.getByRole("tab", { name: /Starting waves/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: /Historical field/ }),
  ).toBeFocused();
  await expect(
    page.getByRole("tab", { name: /Historical field/ }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Search teams", { exact: true }).fill("BCSO");
  await expect(page.locator(".team-table tbody tr")).not.toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
  await page.screenshot({
    path: test.info().outputPath("mobile.png"),
    fullPage: true,
  });
});
