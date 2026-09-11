import { describe, expect, it } from "vitest";
import { baseline, bins, course, defaultWorstCaseTeam, resolveProfile, shiftBinPaces,
  weightedPace, worstCaseIds, worstCaseSource } from "../src/data";
import { simulate } from "../src/engine";
import { createPreset } from "../src/presets";
import { parseScenario, serializeScenario, validateScenario, staffingCsv } from "../src/storage";
import { syncAssignments } from "../src/waves";

describe("worst-case team profiles", () => {
  it.each(["fastest", "slowest"] as const)("seeds %s at its target while retaining historical bin differences", kind => {
    const source = worstCaseSource(kind), custom = defaultWorstCaseTeam(kind);
    expect(weightedPace(custom.binPaces)).toBeCloseTo(kind === "fastest" ? 486 : 850, 10);
    const offsets = bins.map(b => custom.binPaces[b.bin_id] - source.bin_mean_pace_seconds_per_mile[b.bin_id]);
    offsets.forEach(offset => expect(offset).toBeCloseTo(offsets[0], 10));
  });
  it("shifts the overall, computes bin edits by distance, and rejects impossible shifts", () => {
    const t = defaultWorstCaseTeam("fastest");
    const shifted = shiftBinPaces(t.binPaces, 600);
    expect(weightedPace(shifted)).toBeCloseTo(600, 10);
    const b = bins[0], changed = { ...shifted, [b.bin_id]: shifted[b.bin_id] + 60 };
    const miles = course.legs.filter(l => l.leg_number <= b.last_leg).reduce((n, l) => n + l.distance_miles, 0);
    const total = course.legs.reduce((n, l) => n + l.distance_miles, 0);
    expect(weightedPace(changed)).toBeCloseTo(600 + 60 * miles / total, 10);
    expect(() => shiftBinPaces(t.binPaces, 1)).toThrow("bin pace");
    expect(() => shiftBinPaces(t.binPaces, 5999)).toThrow("bin pace");
  });
  it.each([[worstCaseIds.fastest], [worstCaseIds.slowest], Object.values(worstCaseIds)].map(ids => ({ ids })))("simulates synthetic-only selections $ids", ({ ids }) => {
    const s = baseline(ids), result = simulate(s);
    expect(result.teams).toHaveLength(ids.length);
    result.teams.forEach(t => {
      const p = resolveProfile(s, t.teamId);
      expect(t.movingTime).toBeCloseTo(p.overall_mean_pace_seconds_per_mile * course.legs.reduce((n, l) => n + l.distance_miles, 0), 6);
      expect(t.legs).toHaveLength(course.legs.length);
    });
    expect(staffingCsv(result, result)).not.toContain("NaN");
  });
  it("uses flat pace on every leg and assigns automatic waves after editing", () => {
    const s = createPreset("three-waves", Object.values(worstCaseIds));
    expect(s.assignments[worstCaseIds.fastest]).toBe(s.waves[0].id);
    expect(s.assignments[worstCaseIds.slowest]).toBe(s.waves[2].id);
    s.worstCaseTeams.fastest.mode = "flat";
    s.worstCaseTeams.fastest.flatPace = 700;
    const next = syncAssignments(s);
    expect(next.assignments[worstCaseIds.fastest]).toBe(next.waves[2].id);
    simulate(next).teams[0].legs.forEach((l, i) => expect(l.duration).toBe(course.legs[i].distance_miles * 700));
  });
  it.each([1, 2])("migrates version %s without changing historical results", version => {
    const original = baseline();
    const old = { ...original, schemaVersion: version } as Record<string, unknown>;
    delete old.worstCaseTeams;
    if (version === 1) delete old.waveRules;
    const migrated = validateScenario(old);
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.selectedTeamIds).toEqual(original.selectedTeamIds);
    expect(simulate(migrated)).toEqual(simulate(original));
  });
  it("preserves edits through JSON, presets and independent copies", () => {
    const s = baseline(Object.values(worstCaseIds));
    s.worstCaseTeams.fastest.binPaces[bins[0].bin_id] = 400;
    s.worstCaseTeams.slowest.mode = "flat";
    s.worstCaseTeams.slowest.flatPace = 900;
    const loaded = parseScenario(serializeScenario(s));
    expect(loaded).toEqual(s);
    expect(simulate(loaded)).toEqual(simulate(s));
    const preset = createPreset("two-waves", s.selectedTeamIds, s.worstCaseTeams);
    expect(preset.worstCaseTeams).toEqual(s.worstCaseTeams);
    preset.worstCaseTeams.fastest.flatPace = 555;
    expect(s.worstCaseTeams.fastest.flatPace).toBe(486);
  });
  it.each([0, -1, 6000, NaN, Infinity])("rejects invalid custom pace %s even when disabled", value => {
    const s = baseline();
    s.worstCaseTeams.fastest.binPaces[bins[0].bin_id] = value;
    expect(() => validateScenario(s)).toThrow("Worst-case");
  });
  it("rejects incomplete definitions and unknown IDs", () => {
    const s = baseline();
    delete s.worstCaseTeams.fastest.binPaces[bins[0].bin_id];
    expect(() => validateScenario(s)).toThrow("Worst-case");
    expect(() => validateScenario(baseline(["synthetic::unknown"]))).toThrow("Selected teams");
  });
});
