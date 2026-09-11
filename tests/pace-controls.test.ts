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
  conversionPreview,
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
  const s = initialScenario();
  s.waves.push({ id: "slower", name: "Slower", color: "#123456", start: 7200 });
  s.waveRules.boundaries = [profiles[0].overall_mean_pace_seconds_per_mile];
  return syncAssignments(s);
}
describe("linked pace ranges", () => {
  it("defaults new scenarios to a range covering all 51 teams", () => {
    const s = initialScenario();
    expect(s.waveRules.mode).toBe("pace");
    expect(Object.keys(resolveAssignments(s))).toHaveLength(51);
    expect(simulate(s)).toEqual(simulate(baseline()));
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
    const s = initialScenario();
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
    const s = initialScenario();
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
  it("conversion retains wave metadata and produces complete assignments", () => {
    const s = baseline();
    s.waves.push({ id: "late", name: "Late", color: "#445566", start: 12000 });
    const next = conversionPreview(s);
    expect(next.waves.map(({ name, ...w }) => w)).toEqual(
      s.waves.map(({ name, ...w }) => w),
    );
    expect(next.waveRules.boundaries).toHaveLength(1);
    expect(Object.keys(next.assignments)).toHaveLength(51);
    expect(validateScenario(next)).toEqual(next);
    expect(s.waveRules.mode).toBe("manual");
  });
});
describe("visual release pace and compatibility", () => {
  it("matches custom segments at all five boundaries, including challenge allowances", () => {
    const s = twoWaves();
    s.release.mode = "visual";
    s.release.visualPaces = [500, 600, 700, 800, 900];
    s.release.anchor = 23 * 3600;
    const custom = structuredClone(s);
    custom.release.mode = "generated";
    custom.release.segments = bins.map((b, i) => ({
      startLeg: b.first_leg,
      pace: s.release.visualPaces[i],
    }));
    expect(releaseSchedule(s)).toEqual(releaseSchedule(custom));
    const r = releaseSchedule(s);
    expect(r[14] - r[13]).toBeCloseTo(course.legs[13].distance_miles * 500);
    expect(r[15] - r[14]).toBeCloseTo(course.legs[14].distance_miles * 600);
    expect(r[35] - r[34]).toBeCloseTo(
      course.legs[34].distance_miles * 700 + s.challenges.monument,
    );
    expect(r[53] - r[52]).toBeCloseTo(
      course.legs[52].distance_miles * 800 + s.challenges.lighthouse,
    );
    expect(simulate(s).teams.map((t) => t.movingTime)).toEqual(
      simulate(baseline()).teams.map((t) => t.movingTime),
    );
  });
  it("preserves published timetable after edits in other modes", () => {
    const s = baseline();
    const published = releaseSchedule(s);
    s.release.visualPaces = [900, 901, 902, 903, 904];
    s.challenges.monument = 0;
    expect(releaseSchedule(s)).toEqual(published);
  });
  it("validates only the selected release mode and retains inactive edits", () => {
    const s = baseline();
    s.release.visualPaces[1] = NaN;
    s.release.mode = "generated";
    expect(simulate(validateScenario(s)).releases).toEqual(releaseSchedule(s));
    s.release.mode = "visual";
    expect(() => validateScenario(s)).toThrow("five");
    s.release.visualPaces[1] = 625;
    s.release.segments = [{ startLeg: 2, pace: NaN }];
    expect(simulate(validateScenario(s)).releases).toEqual(releaseSchedule(s));
    s.release.mode = "generated";
    expect(() => validateScenario(s)).toThrow("Pace segments");
    s.release.mode = "published";
    s.release.anchor = NaN;
    s.release.visualPaces[1] = NaN;
    expect(simulate(validateScenario(s)).releases).toEqual(releaseSchedule(baseline()));
    const loaded = parseScenario(serializeScenario(s));
    expect(simulate(loaded).releases).toEqual(releaseSchedule(baseline()));
    loaded.release.mode = "generated";
    expect(() => validateScenario(loaded)).toThrow("anchor");
  });
  it("migrates v1 files and saves with identical manual assignments and results", () => {
    const s = baseline();
    s.waves.push({ id: "late", name: "Late", color: "#445566", start: 12000 });
    s.assignments[s.selectedTeamIds[0]] = "late";
    const old: any = structuredClone(s);
    old.schemaVersion = 1;
    delete old.waveRules;
    delete old.release.visualPaces;
    const loaded = parseScenario(JSON.stringify(old));
    expect(loaded.schemaVersion).toBe(4);
    expect(loaded.waveRules.mode).toBe("manual");
    expect(simulate(loaded)).toEqual(simulate(s));
    const saves = readSaves({
      getItem: (key) =>
        key === STORAGE_KEY
          ? JSON.stringify([
              { id: "legacy", updatedAt: "2026-01-01", scenario: old },
            ])
          : null,
    });
    expect(saves[0].scenario).toEqual(loaded);
  });
  it("round trips ranges and independent release settings", () => {
    const s = twoWaves();
    s.release.mode = "visual";
    s.release.visualPaces[2] = 701;
    s.release.segments[0].pace = 780;
    expect(parseScenario(serializeScenario(s))).toEqual(s);
  });
  it.each([[625], [625, 625, 625, 625, 0], [625, 625, 625, 625, Infinity]])(
    "rejects invalid five-node pace values %s",
    (...values) => {
      const s = baseline();
      s.release.mode = "visual";
      s.release.visualPaces = values as number[];
      expect(() => validateScenario(s)).toThrow("five");
    },
  );
});
describe("exchange windows", () => {
  it("includes every arrival and departure, with separate wave and field aggregates", () => {
    const s = twoWaves();
    s.buffers = { before: 300, after: 600 };
    s.release.mode = "visual";
    s.release.visualPaces.fill(400);
    const r = simulate(s);
    for (const group of [
      r.teams,
      r.teams.filter((t) => t.waveId === "slower"),
    ]) {
      const exchanges = exchangeSummaries(group, s.buffers);
      for (const t of group)
        for (const l of t.legs) {
          const start = exchanges[l.leg - 1],
            end = exchanges[l.leg];
          expect(start.latestDeparture).toBeGreaterThanOrEqual(l.departure);
          expect(start.coverageStart!).toBeLessThanOrEqual(l.departure - 300);
          expect(start.coverageEnd!).toBeGreaterThanOrEqual(l.departure + 600);
          expect(end.coverageStart!).toBeLessThanOrEqual(l.arrival - 300);
          expect(end.coverageEnd!).toBeGreaterThanOrEqual(l.arrival + 600);
        }
      expect(exchanges).toHaveLength(72);
      expect(exchanges[0].earliestArrival).toBeNull();
      expect(exchanges[71].latestDeparture).toBeNull();
    }
    expect(
      r.exchanges.some(
        (e) =>
          e.latestArrival !== null &&
          e.latestDeparture !== null &&
          e.latestArrival > e.latestDeparture,
      ),
    ).toBe(true);
  });
});
