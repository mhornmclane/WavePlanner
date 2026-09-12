import { test, expect } from "@playwright/test";

test("simulation retains every team and uses historical release marker shapes", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("navigation", { name: "Planner sections" }).getByRole("button", { name: "Simulation", exact: true }).click();
  await page.getByLabel("Target finish time", { exact: true }).fill("06:00");
  await page.getByRole("button", { name: "Spread replay", exact: true }).click();
  const replay = page.getByRole("region", { name: "Spread replay", exact: true });
  const count = await replay.locator(".replay-marker").count();
  expect(count).toBeGreaterThan(0);
  await expect(replay.locator(".is-diamond")).toHaveCount(0);
  await expect(replay.locator(".replay-shape-legend")).toContainText("Diamond: arrival after release");
  await replay.getByLabel("Replay exchange", { exact: true }).fill("60");
  await expect(replay.locator(".replay-marker")).toHaveCount(count);
  const diamond = replay.locator(".is-diamond").first();
  await expect(diamond).toBeVisible();
  await diamond.focus();
  await expect(diamond).toHaveAttribute("aria-label", /diamond, arrival after release/);
  await expect(replay.getByLabel("Replay team details")).toContainText("Scenario release:");
  await expect(replay.getByLabel("Replay team details")).toContainText("Another runner departed before arrival:");
  await replay.getByLabel("Replay exchange", { exact: true }).fill("71");
  await expect(replay.locator(".is-diamond")).toHaveCount(0);
  await expect(replay.locator(".replay-marker")).toHaveCount(count);
});
