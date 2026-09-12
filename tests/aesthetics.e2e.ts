import { test, expect } from "@playwright/test";

test("history controls leave room for keyboard focus at every viewport", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("navigation").getByRole("button", { name: "Historical data", exact: true }).click();
  for (const width of [1440, 1024, 768, 600, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const panel = await page.locator(".history-panel").boundingBox();
    const filters = await page.locator(".history-filters").boundingBox();
    for (const name of ["Historical year", "Find historical team"]) {
      const input = page.getByLabel(name);
      await input.focus();
      const box = (await input.boundingBox())!;
      expect(box.x - panel!.x).toBeGreaterThanOrEqual(16);
      expect(panel!.x + panel!.width - box.x - box.width).toBeGreaterThanOrEqual(16);
      expect(filters!.y + filters!.height - box.y - box.height).toBeGreaterThanOrEqual(16);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  }
  await page.getByLabel("Find historical team").fill("no matching historical team");
  await expect(page.getByRole("status")).toContainText("No historical records match");
});

test("all workspaces and expanded settings stay within a narrow viewport", async ({ page }) => {
  await page.goto("./");
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ["Historical data", "Historical replay", "Results", "Simulation"]) {
      await page.getByRole("navigation").getByRole("button", { name, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    }
    for (const summary of await page.locator(".compact-settings summary").all()) {
      await summary.click();
      const content = page.locator(".secondary-control[open] .settings-content");
      await expect(content).toBeVisible();
      expect(await content.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      await summary.click();
    }
  }
});
