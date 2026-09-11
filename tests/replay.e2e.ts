import { test, expect } from "@playwright/test";
import { baseline, profiles, teamId } from "../src/data";
import { simulate } from "../src/engine";
import { buildReplay } from "../src/replay";
import { clock, duration } from "../src/format";

test("51-team replay matches exchanges, supports inspection, and keeps a fixed hours scale", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("button", { name: "Spread replay", exact: true })
    .click();
  const panel = page.locator(".spread-replay");
  await expect(panel.locator(".replay-marker")).toHaveCount(51);
  const dots = await panel.locator(".replay-marker").evaluateAll((elements) =>
    elements.map((el) => {
      const box = el.getBoundingClientRect();
      return {
        y: box.y,
        width: box.width,
        height: box.height,
        text: el.textContent?.trim(),
      };
    }),
  );
  expect(new Set(dots.map((dot) => dot.y)).size).toBe(1);
  expect(
    dots.every(
      (dot) => dot.width === 16 && dot.height === 16 && dot.text === "",
    ),
  ).toBe(true);
  await panel.locator(".replay-marker").last().hover();
  await expect(panel.locator(".replay-detail")).toContainText(
    profiles.at(-1)!.team,
  );
  await expect(panel.getByTestId("replay-spread")).toHaveText("0h 00m");
  const axis = await panel
    .locator(".replay-axis")
    .getAttribute("data-axis-seconds");
  const data = buildReplay(simulate(baseline()));
  for (const index of [1, 35, 54, 70, 71]) {
    await panel
      .getByRole("slider", { name: "Replay exchange" })
      .fill(String(index));
    await expect(panel.getByTestId("replay-first")).toHaveText(
      clock(data.frames[index].first),
    );
    await expect(panel.getByTestId("replay-last")).toHaveText(
      clock(data.frames[index].last),
    );
    await expect(panel.getByTestId("replay-spread")).toHaveText(
      duration(data.frames[index].spread),
    );
    await expect(panel.locator(".replay-axis")).toHaveAttribute(
      "data-axis-seconds",
      axis!,
    );
  }
  const first = panel.locator(".replay-marker").first();
  await first.focus();
  await expect(panel.locator(".replay-detail")).toContainText(profiles[0].team);
  await first.press("Enter");
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await first.press("Escape");
  await expect(first).toHaveAttribute("aria-pressed", "false");
  await panel.getByLabel("Find a team").fill(profiles[0].team);
  await panel
    .getByLabel("Highlight replay team")
    .selectOption(teamId(profiles[0]));
  await expect(panel.locator(".replay-marker")).toHaveCount(51);
  await expect(first).toHaveClass(/is-highlighted/);
  await expect(panel.getByTestId("replay-spread")).toHaveText(
    duration(data.frames[71].spread),
  );
  await panel.getByRole("button", { name: "Reset", exact: true }).click();
  await panel.getByRole("slider", { name: "Replay exchange" }).fill("35");
  await panel.screenshot({
    path: "test-results/replay-desktop.png",
    animations: "disabled",
  });
});

test("playback speed, pause, scrub, looping, view cleanup and scenario reset", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("./");
  await page
    .getByRole("button", { name: "Spread replay", exact: true })
    .click();
  const panel = page.locator(".spread-replay");
  const slider = panel.getByRole("slider", { name: "Replay exchange" });
  await panel.getByLabel("Seconds per exchange").selectOption("0.25");
  await panel.getByRole("button", { name: "Play", exact: true }).click();
  await page.clock.runFor(260);
  await expect(slider).toHaveValue("1");
  await panel.getByRole("button", { name: "Pause", exact: true }).click();
  await page.clock.runFor(1000);
  await expect(slider).toHaveValue("1");
  await panel.getByRole("button", { name: "Next", exact: true }).click();
  await expect(slider).toHaveValue("2");
  await panel.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(slider).toHaveValue("1");
  await slider.fill("70");
  await panel.getByRole("button", { name: "Play", exact: true }).click();
  await page.clock.runFor(260);
  await expect(slider).toHaveValue("71");
  await expect(
    panel.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await panel.getByRole("checkbox", { name: "Loop", exact: true }).check();
  await slider.fill("70");
  await panel.getByRole("button", { name: "Play", exact: true }).click();
  await page.clock.runFor(260);
  await expect(slider).toHaveValue("71");
  await page.clock.runFor(260);
  await expect(slider).toHaveValue("0");
  await slider.fill("35");
  await page.clock.runFor(500);
  await expect(slider).toHaveValue("35");
  await panel.getByRole("button", { name: "Play", exact: true }).click();
  await page
    .getByRole("button", { name: "Time / course chart", exact: true })
    .click();
  await page.clock.runFor(1000);
  await page
    .getByRole("button", { name: "Spread replay", exact: true })
    .click();
  await expect(slider).toHaveValue("0");
  await slider.fill("20");
  await panel.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByLabel("Import configuration JSON").setInputFiles({
    name: "empty.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(baseline([]))),
  });
  await expect(slider).toHaveValue("0");
  await expect(
    panel.getByRole("button", { name: "Play", exact: true }),
  ).toBeDisabled();
  await expect(panel.locator(".replay-marker")).toHaveCount(0);
  await expect(panel.getByTestId("replay-first")).toHaveText("—");
});

test("mobile replay supports tap, keyboard scrubbing, staggered starts and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  const s = baseline();
  s.waves.push({
    id: "late",
    name: "Later start",
    color: "#993355",
    start: 14400,
  });
  s.waves[0].start = -7200;
  s.assignments[teamId(profiles[1])] = "late";
  await page.getByLabel("Import configuration JSON").setInputFiles({
    name: "waves.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(s)),
  });
  await page
    .getByRole("button", { name: "Spread replay", exact: true })
    .click();
  const panel = page.locator(".spread-replay");
  await expect(panel.getByTestId("replay-spread")).toHaveText("6h 00m");
  await expect(panel.getByTestId("replay-first")).toHaveText("D0 22:00");
  await panel
    .getByLabel("Highlight replay team")
    .selectOption(teamId(profiles[0]));
  const marker = panel.locator(".replay-marker").first();
  await marker.click();
  await expect(panel.locator(".replay-detail")).toContainText(profiles[0].team);
  await expect(marker).toHaveAttribute("aria-pressed", "true");
  expect(
    await marker.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  const slider = panel.getByRole("slider", { name: "Replay exchange" });
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(slider).toHaveValue("1");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel.scrollIntoViewIfNeeded();
  await panel.screenshot({
    path: "test-results/replay-mobile.png",
    animations: "disabled",
  });
});
