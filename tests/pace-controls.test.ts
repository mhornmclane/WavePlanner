import { describe, expect, it } from "vitest";
import {
  baseline,
  bins,
  course,
  initialScenario,
  profiles,
  teamId,
} from "../src/data";
import { exchangeSummaries, releaseSchedule, simulate } from "../src/engine";
import {
  orderedWaveEntries,
  removeWave,
  resolveAssignments,
  splitSuggestion,
  syncAssignments,
  validBoundary,
} from "../src/waves";
import {
  parseScenario,
  readSaves,
  serializeScenario,
  STORAGE_KEY,
  validateScenario,
} from "../src/storage";

function twoWaves() {
  const s = baseline();
  s.waves.push({ id: "slower", name: "Slower", color: "#123456", start: 7200 });
  s.waveRules.boundaries = [profiles[0].overall_mean_pace_seconds_per_mile];
  return syncAssignments(s);
}
describe("linked pace ranges", () => {
  it("defaults new scenarios to 2025 teams", () => {
    const s = initialScenario();
    expect(s.waveRules.mode).toBe("pace");
    expect(Object.keys(resolveAssignments(s))).toHaveLength(profiles.filter(p=>p.year===2025).length);
    expect(s.fieldYear).toBe(2025);
    expect(simulate(s)).toEqual(simulate(baseline(s.selectedTeamIds)));
  });
  it("assigns exact-boundary teams to the slower wave, independently of start order", () => {
    const s = twoWaves();
    s.waves[1].start = 0;
    expect(resolveAssignments(s)[teamId(profiles[0])]).toBe("slower");
    for (const p of profiles)
      expect(resolveAssignments(s)[teamId(p)]).toBe(
        p.overall_mean_pace_seconds_per_mile < s.waveRules.boundaries[0]
          ? "wave-1"
          : "slower",
      );
  });
  it("numbers and displays default waves slowest first after splits and removals", () => {
    const s = baseline();
    s.waves.push({ id: "middle", name: "Wave 2", color: "#123456", start: 7200 });
    s.waves.push({ id: "slow", name: "Wave 3", color: "#234567", start: 0 });
    s.waveRules.boundaries = [600, 800];
    const next = syncAssignments(s);
    expect(orderedWaveEntries(next).map(({ w }) => [w.id, w.name])).toEqual([
      ["slow", "Wave 1"], ["middle", "Wave 2"], ["wave-1", "Wave 3"],
    ]);
    for (const p of profiles) {
      const w = next.waves.find((w) => w.id === next.assignments[teamId(p)])!;
      const pace = p.overall_mean_pace_seconds_per_mile;
      expect(w.name).toBe(pace >= 800 ? "Wave 1" : pace >= 600 ? "Wave 2" : "Wave 3");
    }
    expect(orderedWaveEntries(removeWave(next, 1)).map(({ w }) => w.name))
      .toEqual(["Wave 1", "Wave 2"]);
  });
  it("recalculates selected teams and never changes moving time", () => {
    const s = twoWaves();
    const original = simulate(s);
    s.waveRules.boundaries[0] += 120;
    const changed = simulate(s);
    expect(changed.teams.map((t) => t.movingTime)).toEqual(
      original.teams.map((t) => t.movingTime),
    );
    s.selectedTeamIds = s.selectedTeamIds.slice(0, 3);
    expect(Object.keys(resolveAssignments(s))).toEqual(s.selectedTeamIds);
    s.selectedTeamIds = [];
    expect(resolveAssignments(s)).toEqual({});
  });
  it("validates shared boundaries and rejects gaps in the boundary list", () => {
    expect(validBoundary([600, 700], 0, 699)).toBe(true);
    expect(validBoundary([600, 700], 0, 700)).toBe(false);
    expect(validBoundary([600, 700], 1, 600)).toBe(false);
    const s = twoWaves();
    s.waveRules.boundaries = [];
    expect(() => validateScenario(s)).toThrow("boundaries");
  });
  it("suggests the middle distinct pace gap and merges either outer wave", () => {
    const s = baseline();
    const paces = [
      ...new Set(profiles.map((p) => p.overall_mean_pace_seconds_per_mile)),
    ].sort((a, b) => a - b);
    const m = Math.floor(paces.length / 2);
    expect(splitSuggestion(s, 0)).toBe(
      Math.ceil((paces[m - 1] + paces[m]) / 2),
    );
    const two = twoWaves();
    for (const i of [0, 1]) {
      const merged = removeWave(two, i);
      expect(merged.waveRules.boundaries).toEqual([]);
      expect(new Set(Object.values(merged.assignments))).toEqual(
        new Set([merged.waves[0].id]),
      );
      expect(validateScenario(merged)).toEqual(merged);
    }
  });
});
