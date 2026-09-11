import { describe, expect, it } from "vitest";
import { baseline, ORIGIN, worstCaseIds } from "../src/data";
import { challengeBefore, simulate } from "../src/engine";
import { parseScenario, serializeScenario, validateScenario } from "../src/storage";
import { createPreset } from "../src/presets";

function laterWave() {
  const s = baseline([worstCaseIds.fastest]);
  s.waves[0].start = ORIGIN + 3600;
  s.worstCaseTeams.fastest.mode = "flat";
  s.worstCaseTeams.fastest.flatPace = 900;
  return s;
}
describe("configurable fast-wave releases", () => {
  it.each([1, 10, 35, 53, 70])("resumes at exchange %s after physical arrival", fromExchange => {
    const s = laterWave();
    s.fastWaveReleases.fromExchange = fromExchange;
    const result = simulate(s), legs = result.teams[0].legs;
    legs.forEach((leg, i) => {
      expect(leg.releaseSuppressed).toBe(i < fromExchange);
      if (i > 0 && i < fromExchange) expect(leg.departure).toBeGreaterThanOrEqual(legs[i - 1].arrival + challengeBefore(i + 1, s));
      if (i >= fromExchange) expect(leg.departure).toBeGreaterThanOrEqual(legs[fromExchange - 1].arrival);
    });
    expect(legs[fromExchange].releaseSuppressed).toBe(false);
    expect(legs[fromExchange].releaseUsed).toBe(fromExchange === 35 || fromExchange === 53);
  });
  it("can apply releases from the start without retaining a hidden monument floor", () => {
    const s = laterWave();
    s.fastWaveReleases.fromExchange = 0;
    s.worstCaseTeams.fastest.flatPace = 1200;
    const { legs } = simulate(s).teams[0];
    expect(legs.every(l => !l.releaseSuppressed)).toBe(true);
    expect(legs[1].departure).toBeLessThan(legs[0].arrival);
    expect(legs[35].departure).toBeLessThan(legs[34].arrival);
    expect(legs.every(l => l.departure >= s.waves[0].start)).toBe(true);
  });
  it("turns releases off for the full course while retaining challenges and gates", () => {
    const s = laterWave();
    s.fastWaveReleases.enabled = false;
    s.timingRules.push({ id: "test-opening", enabled: true, exchange: 2, type: "depart-after", time: 50000 });
    const result = simulate(s), team = result.teams[0];
    expect(result.releaseCount).toBe(0);
    expect(team.peakActive).toBe(1);
    expect(team.legs[2].gateWait).toBeGreaterThan(0);
    expect(team.legs[2].departure).toBe(50000);
    team.legs.forEach((l, i) => {
      expect(l.releaseSuppressed).toBe(true);
      if (i) expect(l.departure).toBeGreaterThanOrEqual(team.legs[i - 1].arrival + challengeBefore(i + 1, s));
    });
    expect(team.legs[35].challengeWait).toBe(s.challenges.monument);
    expect(team.legs[53].challengeWait).toBe(s.challenges.lighthouse);
  });
  it.each([ORIGIN - 3600, ORIGIN])("leaves waves starting at %s unchanged", start => {
    const s = laterWave();
    s.waves[0].start = start;
    const before = simulate(s);
    s.fastWaveReleases = { enabled: false, fromExchange: 70 };
    expect(simulate(s)).toEqual(before);
  });
  it("works for all release schedule modes without modifying moving time", () => {
    const s = laterWave();
    for (const mode of ["published", "generated", "visual"] as const) {
      s.release.mode = mode;
      s.fastWaveReleases.enabled = true;
      const before = simulate(s);
      s.fastWaveReleases.enabled = false;
      const after = simulate(s);
      expect(after.releaseCount).toBe(0);
      expect(after.teams[0].movingTime).toBe(before.teams[0].movingTime);
      expect(after.releases).toEqual(before.releases);
    }
  });
  it.each([1, 2, 3, 4])("migrates version %s with the previous monument behavior", schemaVersion => {
    const s = baseline();
    s.waves[0].start = 7200;
    const old = { ...s, schemaVersion } as Record<string, unknown>;
    delete old.fastWaveReleases;
    const migrated = validateScenario(old);
    expect(migrated.fastWaveReleases).toEqual({ enabled: true, fromExchange: 35 });
    expect(simulate(migrated)).toEqual(simulate(s));
  });
  it("preserves disabled policy and the chosen exchange in JSON and presets", () => {
    const s = laterWave();
    s.fastWaveReleases = { enabled: false, fromExchange: 53 };
    expect(parseScenario(serializeScenario(s))).toEqual(s);
    const preset = createPreset("three-waves", s.selectedTeamIds, s.worstCaseTeams, s.timingRules, s.fastWaveReleases);
    expect(preset.fastWaveReleases).toEqual(s.fastWaveReleases);
    preset.fastWaveReleases.fromExchange = 1;
    expect(s.fastWaveReleases.fromExchange).toBe(53);
  });
  it.each([-1, 71, 1.5, NaN])("rejects invalid exchange %s even while off", fromExchange => {
    const s = laterWave();
    s.fastWaveReleases = { enabled: false, fromExchange };
    expect(() => validateScenario(s)).toThrow("Fast-wave releases");
  });
});
