import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createPreset } from "../src/presets";
import { fieldIds } from "../src/data";
import { simulate } from "../src/engine";
import { clock } from "../src/format";

async function exportScenario(page: Page) {
  // The files toolbar may already be open after an import.
  const exportButton = page.getByRole("button", { name: "↓ JSON", exact: true });
  if (!await exportButton.isVisible()) await page.getByText(/^Configuration files ·/).click();
  const download = page.waitForEvent("download");
  await exportButton.click();
  return JSON.parse(await readFile((await (await download).path())!, "utf8"));
}

test("wave controls, guides, timetable and replay use the same independent settings", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Strategy preset").selectOption("three-waves");
  await expect(page.locator('.wave-release-guide')).toHaveCount(3);
  await page.getByRole("group",{name:"Wave 2 solver",exact:true}).getByRole("radio",{name:"None",exact:true}).check();
  await page.getByLabel("Wave 2 target finish time", { exact: true }).fill("12:00");
  await page.getByLabel("Wave 2 release pace", { exact: true }).fill("10:00");
  await expect(page.getByLabel("Wave 1 target finish time", { exact: true })).toHaveValue("Saturday 1:20 PM");
  await expect(page.getByLabel("Wave 3 release pace", { exact: true })).toHaveValue("9:41");
  await expect(page.getByLabel("Strategy preset")).toHaveValue("custom");
  await expect(page.locator('.wave-release-guide')).toHaveCount(3);
  await expect(page.locator('.finish-target-marker')).toHaveCount(3);
  await page.getByRole("button", { name: "Highlight Wave 2", exact: true }).click();
  await expect(page.locator('.wave-release-guide[data-wave-ids="wave-2"]')).toHaveAttribute("opacity", "1");
  await expect(page.locator('.wave-release-guide').filter({ has: page.locator('title', { hasText: 'Wave 1' }) })).toHaveAttribute("opacity", "0.15");

  const saved = await exportScenario(page);
  expect(saved.schemaVersion).toBe(8);
  expect(saved.release).toBeUndefined();
  const result = simulate(saved);
  const marker = page.locator('[data-release-leg="36"][data-wave-ids="wave-2"]');
  await marker.scrollIntoViewIfNeeded();
  await marker.click();
  const details = page.getByRole("dialog", { name: "Exchange 35 details" });
  await expect(details).toContainText("Wave 2 release");
  await expect(details).toContainText(clock(result.releasesByWave['wave-2'][35]));
  await page.keyboard.press("Escape");
  await page.getByRole("navigation", { name: "Planner sections" }).getByRole("button", { name: "Results", exact: true }).click();
  const table = page.getByRole("region", { name: "Release timetable", exact: true });
  await expect(table.locator('thead th')).toHaveCount(5);
  const cells = table.locator('tbody tr').nth(35).locator('td');
  for (const [i, wave] of [...saved.waves].reverse().entries())
    await expect(cells.nth(i + 1)).toHaveText(clock(result.releasesByWave[wave.id][35]));
  await page.getByRole("navigation", { name: "Planner sections" }).getByRole("button", { name: "Simulation", exact: true }).click();
  await page.getByRole("button", { name: "Spread replay", exact: true }).click();
  const replay = page.getByRole("region", { name: "Spread replay", exact: true });
  await replay.getByLabel("Replay exchange", { exact: true }).fill("35");
  const team = result.teams.find(t => t.waveId === 'wave-2')!;
  await replay.locator(`.replay-marker[data-team-id="${team.teamId}"]`).focus();
  await expect(replay.getByLabel("Replay team details")).toContainText(`Scenario release: ${clock(result.releasesByWave['wave-2'][35])}`);
});

test("splits copy settings independently, removal retains the receiving wave, and presets restore feasible settings", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Wave 1 release pace", { exact: true }).fill("11:00");
  await page.getByLabel("Wave 1 target finish time", { exact: true }).fill("12:00");
  await page.getByRole("button", { name: "+ Add wave", exact: true }).click();
  await page.getByRole("button", { name: "Confirm split", exact: true }).click();
  await expect(page.getByLabel("Wave 2 release pace", { exact: true })).toHaveValue("11:00");
  await expect(page.getByLabel("Wave 2 target finish time", { exact: true })).toHaveValue("12:00");
  await page.getByLabel("Wave 2 release pace", { exact: true }).fill("10:00");
  await expect(page.getByLabel("Wave 1 release pace", { exact: true })).toHaveValue("11:00");
  await page.getByLabel("Remove wave 1", { exact: true }).click();
  await expect(page.getByLabel("Wave 1 release pace", { exact: true })).toHaveValue("10:00");
  await page.getByLabel("Strategy preset").selectOption("eleven-am");
  await expect(page.getByLabel("Wave 1 release pace", { exact: true })).toHaveValue("9:40");
  await expect(page.getByLabel("Wave 2 release pace", { exact: true })).toHaveValue("9:26");
  await expect(page.getByLabel("Wave 3 release pace", { exact: true })).toHaveValue("9:00");
  await expect(page.locator('.wave-card .rule-failed')).toHaveCount(0);
});

test("v6 browser saves migrate and edited v7 settings survive reload; invalid imports preserve edits", async ({ page }) => {
  const s = createPreset("three-waves", fieldIds(2025));
  s.fieldYear = 2025;
  const old = { ...s, schemaVersion: 6, release: s.waves[0].release,
    waves: s.waves.map(({ release: _release, ...w }) => w) };
  const raw = JSON.stringify([{ id: 'legacy', updatedAt: '2026-09-14', scenario: old }]);
  await page.addInitScript(raw => { if (!localStorage.getItem('ruck4hit-scenarios-v6')) localStorage.setItem('ruck4hit-scenarios-v6', raw); }, raw);
  await page.goto("./");
  await page.getByText(/^Configuration files ·/).click();
  await page.getByLabel("Load configuration", { exact: true }).selectOption('legacy');
  await page.getByLabel("Wave 2 release pace", { exact: true }).fill("11:00");
  await page.getByRole("button", { name: "Save configuration", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('ruck4hit-scenarios-v6'))).toBe(raw);
  await page.reload();
  await page.getByText(/^Configuration files ·/).click();
  await page.getByLabel("Load configuration", { exact: true }).selectOption('legacy');
  await expect(page.getByLabel("Wave 2 release pace", { exact: true })).toHaveValue("11:00");
  const invalid = await exportScenario(page);
  invalid.waves[1].release.pace = 0;
  await page.getByLabel("Import configuration JSON").setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
  await expect(page.getByRole("alert")).toContainText("Wave 2");
  await expect(page.getByLabel("Wave 2 release pace", { exact: true })).toHaveValue("11:00");
  for (const width of [1440, 740, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(page.getByLabel("Wave 3 target finish time", { exact: true })).toBeVisible();
  }
  await page.locator('.configuration-panel').screenshot({ path: 'test-results/per-wave-mobile.png' });
});

test("all seven presets have no late-start warnings", async ({ page }) => {
  await page.goto("./");
  const selector = page.getByLabel("Strategy preset");
  const ids = await selector.locator('option').evaluateAll(options => options.map(o=>(o as HTMLOptionElement).value).filter(id=>id!=="custom"));
  expect(ids).toHaveLength(7);
  for (const id of ids) {
    await selector.selectOption(id);
    await expect(page.locator('.wave-card .rule-failed')).toHaveCount(0);
    for (const group of await page.getByRole("group",{name:/Wave \d+ solver/}).all()) await expect(group.getByRole("radio",{name:"Finish",exact:true})).toBeChecked();
  }
});
