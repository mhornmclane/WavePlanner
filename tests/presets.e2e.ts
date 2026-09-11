import { test, expect } from "@playwright/test";
import { baseline, profiles, teamId } from "../src/data";
import { presets } from "../src/presets";

test("presets can be reviewed, edited, restored and switched to Custom", async ({ page }) => {
  await page.goto("./");
  const selector = page.getByLabel("Configuration preset");
  await expect(selector).toHaveValue("custom");
  for (const preset of presets) {
    await selector.selectOption(preset.id);
    await expect(page.locator(".preset-summary")).toContainText(preset.summary);
    for (const [index, start] of [...preset.starts].reverse().entries()) {
      await expect(page.getByLabel(`Wave ${index + 1} start offset (hours)`, { exact: true }))
        .toHaveValue(String((start - 3600) / 3600));
    }
  }
  await selector.selectOption("midnight-waves");
  const boundary = page.getByLabel("Wave 1 minimum pace (inclusive)");
  await boundary.focus();
  await boundary.press("Tab");
  await expect(selector).toHaveValue("midnight-waves");
  await boundary.fill("11:00");
  await boundary.press("Enter");
  await expect(selector).toHaveValue("custom");
  await expect(page.getByLabel("Wave 2 maximum pace (exclusive)")).toHaveValue("11:00");
  await selector.selectOption("midnight-waves");
  await expect(boundary).toHaveValue("10:30");
  await selector.selectOption("custom");
  await expect(boundary).toHaveValue("10:30");
  await page.getByLabel("Wave 1 start offset (hours)", { exact: true }).fill("-2");
  await selector.selectOption("midnight-waves");
  await expect(page.getByLabel("Wave 1 start offset (hours)", { exact: true })).toHaveValue("-1");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(selector).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("presets-mobile.png") });
});

test("loading presets resets settings, retains teams and protects existing saves", async ({ page }) => {
  const old = baseline(profiles.slice(0, 3).map(teamId));
  old.name = "Existing custom";
  old.buffers.before = 600;
  old.challenges.monument = 1200;
  old.release.mode = "visual";
  await page.goto("./");
  await page.getByLabel("Import configuration JSON").setInputFiles({
    name: "existing.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(old)),
  });
  await page.getByRole("button", { name: "Save configuration", exact: true }).click();
  await page.getByLabel("Configuration preset").selectOption("three-waves");
  await expect(page.getByRole("button", { name: "Delete saved", exact: true })).toBeDisabled();
  await page.getByLabel("Wave 1 start offset (hours)", { exact: true }).fill("0.5");
  await page.getByRole("button", { name: "Save configuration", exact: true }).click();
  const entries = await page.evaluate(() => JSON.parse(localStorage.getItem("ruck4hit-scenarios-v1")!));
  expect(entries).toHaveLength(2);
  expect(entries[0].scenario).toEqual(old);
  expect(entries[1].scenario.selectedTeamIds).toEqual(old.selectedTeamIds);
  expect(entries[1].scenario.buffers.before).toBe(0);
  expect(entries[1].scenario.challenges.monument).toBe(960);
  expect(entries[1].scenario.release.mode).toBe("published");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "↓ JSON", exact: true }).click();
  const download = await downloadEvent;
  const exported = test.info().outputPath("edited-preset.json");
  await download.saveAs(exported);
  await page.getByLabel("Load configuration").selectOption({ label: "Existing custom" });
  await expect(page.getByLabel("Configuration name", { exact: true })).toHaveValue("Existing custom");
  await page.getByLabel("Load configuration").selectOption({ label: "3 waves · 1–3am" });
  await expect(page.getByLabel("Configuration preset")).toHaveValue("custom");
  await expect(page.getByLabel("Wave 1 start offset (hours)", { exact: true })).toHaveValue("0.5");
  await page.getByLabel("Configuration preset").selectOption("status-quo");
  await page.getByLabel("Import configuration JSON").setInputFiles(exported);
  await expect(page.getByLabel("Configuration preset")).toHaveValue("custom");
  await expect(page.getByLabel("Wave 1 start offset (hours)", { exact: true })).toHaveValue("0.5");
});
