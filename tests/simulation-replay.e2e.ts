import { test, expect } from "@playwright/test";

test("baseline overlay defaults on, keeps a fixed scale and survives view switches independently", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("2026 baseline", { exact: true })).not.toBeChecked();
  await page.getByRole("button", { name: "Spread replay", exact: true }).click();
  const replay = page.getByRole("region", { name: "Spread replay", exact: true });
  const toggle = replay.getByLabel("2026 baseline", { exact: true });
  await expect(toggle).toBeChecked();
  await expect(replay.locator(".replay-comparison-cap")).toHaveCount(1);
  await expect(replay.locator(".replay-comparison-cap")).toHaveText("Baseline first / last");
  await expect(replay.getByLabel("2026 baseline metrics")).toContainText("First start");
  const axis = await replay.locator(".replay-axis").getAttribute("data-axis-seconds");
  await replay.getByLabel("Replay exchange", { exact: true }).fill("60");
  await expect(replay.locator(".replay-comparison-cap")).toHaveCount(2);
  const spread = Number(await replay.locator(".replay-comparison").getAttribute("data-spread"));
  const width = await replay.locator(".replay-comparison-band").evaluate(el => parseFloat((el as HTMLElement).style.width));
  expect(width).toBeCloseTo(spread / Number(axis) * 100, 4);
  await replay.getByPlaceholder("Team or year").fill("Ruck");
  await expect(replay.locator(".replay-comparison")).toHaveAttribute("data-spread", String(spread));
  await replay.getByLabel("Seconds per exchange").selectOption("0.25");
  await replay.getByRole("button", { name: "Play", exact: true }).click();
  await expect(replay.getByLabel("Replay exchange", { exact: true })).not.toHaveValue("60");
  await replay.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(replay.locator(".replay-axis")).toHaveAttribute("data-axis-seconds", axis!);
  const positions = await replay.locator(".replay-marker").evaluateAll(nodes => nodes.map(n => (n as HTMLElement).style.left));
  await toggle.uncheck();
  await expect(replay.locator(".replay-comparison")).toHaveCount(0);
  expect(await replay.locator(".replay-marker").evaluateAll(nodes => nodes.map(n => (n as HTMLElement).style.left))).toEqual(positions);
  await expect(replay.locator(".replay-axis")).toHaveAttribute("data-axis-seconds", axis!);
  await page.getByRole("button", { name: "Time / course chart", exact: true }).click();
  await page.getByLabel("2026 baseline", { exact: true }).check();
  await page.getByRole("button", { name: "Spread replay", exact: true }).click();
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await replay.getByLabel("Replay exchange", { exact: true }).fill("71");
  await expect(replay.getByLabel("2026 baseline metrics")).toContainText("First arrival");
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const label of await replay.locator(".replay-comparison-cap span").all()) {
      const box = (await label.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.screenshot({ path: "test-results/replay-baseline-mobile.png", fullPage: true });
  const baselineBefore = await replay.locator(".replay-comparison").getAttribute("data-spread");
  await page.getByLabel("Wave 1 target finish time", { exact: true }).fill("06:00");
  await expect(replay.getByLabel("Replay exchange", { exact: true })).toHaveValue("0");
  await expect(toggle).toBeChecked();
  await replay.getByLabel("Replay exchange", { exact: true }).fill("71");
  await expect(replay.locator(".replay-comparison")).toHaveAttribute("data-spread", baselineBefore!);
  const updatedAxis = Number(await replay.locator(".replay-axis").getAttribute("data-axis-seconds"));
  const updatedWidth = await replay.locator(".replay-comparison-band").evaluate(el => parseFloat((el as HTMLElement).style.width));
  expect(updatedWidth).toBeCloseTo(Number(baselineBefore) / updatedAxis * 100, 4);
});

test("simulation retains every team and uses historical release marker shapes", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("navigation", { name: "Planner sections" }).getByRole("button", { name: "Simulation", exact: true }).click();
  await page.getByLabel("Wave 1 target finish time", { exact: true }).fill("06:00");
  await page.getByRole("button", { name: "Spread replay", exact: true }).click();
  const replay = page.getByRole("region", { name: "Spread replay", exact: true });
  const count = await replay.locator(".replay-marker").count();
  expect(count).toBeGreaterThan(0);
  await expect(replay.locator(".is-diamond")).toHaveCount(0);
  await expect(replay.locator(".replay-shape-legend")).toContainText("Diamond: another runner departed before arrival");
  await replay.getByLabel("Replay exchange", { exact: true }).fill("60");
  await expect(replay.locator(".replay-marker")).toHaveCount(count);
  const diamond = replay.locator(".is-diamond").first();
  await expect(diamond).toBeVisible();
  await diamond.focus();
  await expect(diamond).toHaveAttribute("aria-label", /diamond, overlapping runners/);
  await expect(replay.getByLabel("Replay team details")).toContainText("Scenario release:");
  await expect(replay.getByLabel("Replay team details")).toContainText("Another runner departed before arrival: Yes");
  await replay.getByLabel("Replay exchange", { exact: true }).fill("71");
  await expect(replay.locator(".is-diamond")).toHaveCount(0);
  await expect(replay.locator(".replay-marker")).toHaveCount(count);
});
