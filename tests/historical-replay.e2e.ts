import { test, expect, type Page } from "@playwright/test";
async function section(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Planner sections" }).getByRole("button", { name, exact: true }).click();
}
test.beforeEach(async ({ page }) => { await page.goto("./"); await section(page, "Historical replay"); });
test("compares years, preserves exchange and stays independent of invalid simulation", async ({ page }) => {
  const replay = page.getByRole("region", { name: "Historical replay", exact: true });
  await expect(page.getByRole("checkbox", { name: "2025", exact: true })).toBeChecked();
  await expect(replay.locator('.replay-marker')).toHaveCount(20);
  await replay.getByLabel("Replay exchange", { exact: true }).fill("35");
  const before = await replay.locator('.replay-year-metrics').innerText();
  await page.getByRole("checkbox", { name: "2024", exact: true }).check();
  await expect(replay.locator('.replay-marker')).toHaveCount(40);
  await expect(replay.getByLabel("Replay exchange", { exact: true })).toHaveValue("35");
  const axis = await replay.locator('.replay-axis').getAttribute('data-axis-seconds');
  await replay.getByRole("button", { name: "Next", exact: true }).click();
  expect(await replay.locator('.replay-axis').getAttribute('data-axis-seconds')).toBe(axis);
  await page.getByRole("checkbox", { name: "2024", exact: true }).uncheck();
  await replay.getByLabel("Replay exchange", { exact: true }).fill("35");
  await replay.getByLabel("Seconds per exchange").selectOption("5");
  await replay.getByLabel("Loop", { exact: true }).check();
  await replay.getByRole("button", { name: "Play", exact: true }).click();
  await section(page, "Simulation");
  await page.getByLabel("Release pace", { exact: true }).fill("bad");
  await section(page, "Historical replay");
  await expect(replay.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(replay.getByLabel("Replay exchange", { exact: true })).toHaveValue("35");
  await expect(replay.getByLabel("Seconds per exchange")).toHaveValue("5");
  await expect(replay.getByLabel("Loop", { exact: true })).toBeChecked();
  expect(await replay.locator('.replay-year-metrics').innerText()).toBe(before);
  await page.getByRole("checkbox", { name: "2025", exact: true }).uncheck();
  await expect(replay.getByRole("button", { name: "Play", exact: true })).toBeDisabled();
  await expect(replay.locator(".replay-empty")).toContainText("Select one or more years");
});
test("diamonds expose release details and IDs stay unique beside simulator replay", async ({ page }) => {
  const replay = page.getByRole("region", { name: "Historical replay", exact: true });
  await page.getByRole("checkbox", { name: "2024", exact: true }).check();
  await page.getByRole("checkbox", { name: "2026", exact: true }).check();
  await expect(replay.locator('.is-diamond')).toHaveCount(0);
  await replay.getByLabel("Replay exchange", { exact: true }).fill("35");
  const diamond = replay.locator('.is-diamond').first();
  await expect(diamond).toBeVisible();
  await diamond.focus();
  await expect(diamond).toHaveAttribute('aria-label', /diamond, arrival after release/);
  await expect(replay.getByLabel("Replay team details")).toContainText("Published release:");
  await expect(replay.getByLabel("Replay team details")).toContainText("Another runner departed before arrival:");
  await diamond.press("Enter");
  await expect(diamond).toHaveAttribute('aria-pressed', 'true');
  await diamond.press("Escape");
  await expect(diamond).toHaveAttribute('aria-pressed', 'false');
  await replay.getByLabel("Replay exchange", { exact: true }).fill("71");
  await expect(replay.locator('.is-diamond')).toHaveCount(0);
  await section(page, "Simulation");
  await page.getByRole("button", { name: "Spread replay", exact: true }).click();
  const duplicates = await page.locator('[id]').evaluateAll(nodes => {
    const ids = nodes.map(n => n.id); return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  expect(duplicates).toEqual([]);
});
test("mobile controls and comparison fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const year of [2024, 2026]) await page.getByRole('checkbox', { name: String(year), exact: true }).check();
  const replay = page.getByRole("region", { name: "Historical replay", exact: true });
  await replay.getByLabel("Replay exchange", { exact: true }).fill("35");
  await replay.getByLabel("Replay exchange", { exact: true }).press("ArrowRight");
  await expect(replay.getByLabel("Replay exchange", { exact: true })).toHaveValue("36");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: 'test-results/historical-replay-mobile.png', fullPage: true });
});
