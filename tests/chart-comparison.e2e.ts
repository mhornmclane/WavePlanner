import { test, expect } from "@playwright/test";

test("wave focus draws in front without changing the baseline envelope or viewport", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Strategy preset").selectOption("three-waves");
  await page.getByLabel("2026 baseline", { exact: true }).check();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const chart = page.locator(".chart-canvas");
  const view = await chart.getAttribute("data-viewport");
  const band = await page.locator(".baseline-band").getAttribute("d");
  const focus = page.getByLabel("Highlight team");
  await page.getByRole("button", { name: "Highlight Wave 2", exact: true }).click();
  const trajectories = page.locator(".team-trajectory");
  const originalCount = await trajectories.count();
  await expect(focus.locator('option[value^="wave:"]')).toHaveCount(0);
  await expect(focus).toHaveValue("");
  const waves = await trajectories.evaluateAll(nodes => nodes.map(n => n.getAttribute("data-wave-id")));
  expect(waves.slice(waves.indexOf("wave-2")).every(w => w === "wave-2")).toBe(true);
  await expect(trajectories.filter({ has: page.locator('.hit-line') }).first()).toHaveAttribute("data-wave-id", "wave-2");
  for (const node of await trajectories.all()) {
    const active = await node.getAttribute("data-wave-id") === "wave-2";
    await expect(node).toHaveAttribute("opacity", active ? "1" : "0.15");
    if (active) await expect(node.locator('line[stroke-width="2.5"]').first()).toBeAttached();
  }
  await expect(chart).toHaveAttribute("data-viewport", view!);
  await expect(page.locator(".baseline-band")).toHaveAttribute("d", band!);
  await page.getByRole("button", { name: "Highlight Wave 2", exact: true }).click();
  await expect(trajectories.first()).toHaveAttribute("opacity", "0.62");
  await page.getByRole("button", { name: "Highlight Wave 2", exact: true }).click();
  const team = await page.locator('optgroup[label="Teams"] option').first().getAttribute("value");
  await focus.selectOption(team!);
  await expect(page.getByRole("button", { name: "Highlight Wave 2", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(trajectories.last()).toHaveAttribute("data-team-id", team!);
  await focus.selectOption("");
  await expect(trajectories).toHaveCount(originalCount);
  await expect(trajectories.first()).toHaveAttribute("opacity", "0.62");
  await page.getByRole("button", { name: "Highlight Wave 2", exact: true }).click();
  await page.getByLabel("Wave 2 start time", { exact: true }).fill("03:00");
  await expect(page.getByRole("button", { name: "Highlight Wave 2", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Remove wave 2", { exact: true }).click();
  await expect(focus).toHaveValue("");
  await focus.selectOption(team!);
  await page.getByLabel("Simulation field").selectOption("2026");
  await expect(focus).toHaveValue("");
});

test("summary leads both visualizers and baseline fits at desktop, tablet and phone sizes", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Strategy preset").selectOption("three-waves");
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator('.configuration-heading').getByLabel('Simulation field')).toBeVisible();
    await expect(page.locator('.viewer-controls').getByLabel('Simulation field')).toHaveCount(0);
    const summary = page.locator('.simulation-visual .live-summary');
    const rules = page.locator('.simulation-visual .timing-rule-summary');
    const controls = page.locator('.viewer-controls');
    const below = async () => {
      const box = (await rules.boundingBox())!;
      expect((await controls.boundingBox())!.y).toBeGreaterThanOrEqual(box.y + box.height);
      expect((await summary.boundingBox())!.y).toBeLessThan(box.y);
    };
    await below();
    await page.getByLabel("2026 baseline", { exact: true }).check();
    await expect(page.locator('.baseline-envelope')).toBeAttached();
    await page.getByRole("button", { name: "Highlight Wave 2", exact: true }).click();
    await page.locator('.trajectory').screenshot({ path: `artifacts/comparison-${width}.png` });
    await page.getByRole('button', {name:'Zoom in',exact:true}).click();
    await page.locator('.trajectory').screenshot({ path: `artifacts/comparison-zoom-${width}.png` });
    await page.getByRole('button', {name:'Exchanges',exact:true}).click();
    await expect(page.locator('.baseline-latest')).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await page.getByRole('button', {name:'Spread replay',exact:true}).click();
    await below();
    await page.getByRole('button', {name:'Time / course chart',exact:true}).click();
  }
});
