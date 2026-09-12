import { describe, expect, it } from "vitest";
import { baseline, fieldIds, profileById, profiles, teamId, worstCaseIds } from "../src/data";
import { applyPreset, createPreset, presets } from "../src/presets";
import { simulate } from "../src/engine";
import { syncAssignments } from "../src/waves";
import { parseScenario, serializeScenario, readSaves, writeSaves } from "../src/storage";

describe("configuration presets", () => {
  it.each(presets)("creates an editable, isolated $name with baseline settings", (preset) => {
    const ids = profiles.map(teamId);
    const s = createPreset(preset.id, ids);
    const b = baseline(ids);
    expect(s.selectedTeamIds).toEqual(ids);
    expect(s.release).toEqual({ targetFinish: preset.targetFinish, pace: preset.releasePace });
    expect(s.challenges).toEqual(b.challenges);
    expect(s.buffers).toEqual(b.buffers);
    expect(s.waveRules.mode).toBe("pace");
    expect(parseScenario(serializeScenario(s))).toEqual(s);
    const original = structuredClone(s);
    s.waves[0].start += 3600;
    s.release.pace = 700;
    s.selectedTeamIds.pop();
    expect(createPreset(preset.id, ids)).toEqual(original);
    expect(createPreset(preset.id, []).assignments).toEqual({});
  });

  it("matches the status quo simulation exactly", () => {
    const ids = profiles.map(teamId);
    expect(simulate(createPreset("status-quo", ids))).toEqual(simulate(baseline(ids)));
  });

  it.each(presets.flatMap(p => p.boundaries.map((cutoff, index) => ({
    id: p.id, cutoff, faster: p.starts[index], slower: p.starts[index + 1],
  }))))("$id assigns both sides of $cutoff and exact equality", ({id, cutoff, faster, slower}) => {
    const profile = profiles[0];
    const key = teamId(profile);
    const original = profileById.get(key)!;
    try {
      for (const [pace, start] of [[cutoff - 0.01, faster], [cutoff, slower], [cutoff + 0.01, slower]]) {
        profileById.set(key, { ...original, overall_mean_pace_seconds_per_mile: pace });
        const s = createPreset(id, [key]);
        expect(s.waves.find((w) => w.id === s.assignments[key])!.start).toBe(start);
        expect(simulate(s).teams[0].legs[0].departure).toBe(start);
      }
    } finally {
      profileById.set(key, original);
    }
  });

  it("reassigns edited boundaries and round trips edited results through JSON and browser saves", () => {
    const s = createPreset("two-waves", profiles.map(teamId));
    s.waveRules.boundaries = [900];
    s.waves[0].start = 7200;
    const edited = syncAssignments(s);
    expect(edited.assignments).not.toEqual(createPreset("two-waves", s.selectedTeamIds).assignments);
    const loaded = parseScenario(serializeScenario(edited));
    expect(simulate(loaded)).toEqual(simulate(edited));
    let raw = "";
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    writeSaves(storage, [{ id: "edited", updatedAt: "2026-09-11", scenario: edited }]);
    expect(readSaves(storage)[0].scenario).toEqual(edited);
  });
});

describe("complete strategy application", () => {
  it.each(presets)("restores $name while preserving the chosen field, paces and buffers", p => {
    const current = baseline([...fieldIds(2025), worstCaseIds.fastest]);
    current.fieldYear = 2025;
    current.buffers = { before: 600, after: 1200 };
    current.worstCaseTeams.fastest.mode = "flat";
    current.worstCaseTeams.fastest.flatPace = 590;
    current.release = { targetFinish: 150000, pace: 900 };
    current.challenges = { monument: 2000, lighthouse: 3000 };
    current.fastWaveReleases = { enabled: false, fromExchange: 53 };
    current.timingRules = [{ id: "custom", enabled: true, exchange: 10, type: "clear-by", time: 40000 }];
    const snapshot = structuredClone(current);
    const next = applyPreset(p.id, current);
    expect(next.fieldYear).toBe(2025);
    expect(next.selectedTeamIds).toEqual(current.selectedTeamIds);
    expect(next.worstCaseTeams).toEqual(current.worstCaseTeams);
    expect(next.buffers).toEqual(current.buffers);
    expect(next.name).toBe(p.name);
    expect(next.waves.map(w => w.start)).toEqual(p.starts);
    expect(next.waveRules.boundaries).toEqual(p.boundaries);
    expect(next.release).toEqual({ targetFinish: p.targetFinish, pace: p.releasePace });
    expect(next.timingRules).toEqual(baseline().timingRules);
    expect(next.challenges).toEqual({ monument: 960, lighthouse: 1260 });
    expect(next.fastWaveReleases).toEqual({ enabled: true, fromExchange: 35 });
    const expectedIndex = p.boundaries.filter(b => 590 >= b).length;
    expect(next.assignments[worstCaseIds.fastest]).toBe(next.waves[expectedIndex].id);
    expect(parseScenario(serializeScenario(next))).toEqual(next);
    next.buffers.before++;
    next.worstCaseTeams.fastest.flatPace++;
    next.timingRules[0].time++;
    next.selectedTeamIds.pop();
    expect(current).toEqual(snapshot);
  });

  it.each(presets.flatMap(p => ["all", 2024, 2025, 2026].map(year => ({ id: p.id, year }))))(
    "$id clears the nominal monument deadline for $year", ({id, year}) => {
      const s = createPreset(id, fieldIds(year as "all" | number));
      const r = simulate(s);
      expect(Object.keys(s.assignments)).toHaveLength(s.selectedTeamIds.length);
      expect(r.timingRules.find(r => r.ruleId === "monument-deadline")!.status).toBe("passed");
    },
  );

  it("reproduces the analyzed 11 AM result and exact target references", () => {
    const s = createPreset("eleven-am", profiles.map(teamId));
    const r = simulate(s);
    expect(s.release).toEqual({ targetFinish: 126000, pace: 580 });
    expect(r.exchangeHours).toBeCloseTo(124.02, 2);
    expect(r.lastOffCourse).toBeCloseTo(126590.07, 2);
    expect(r.releaseCount).toBe(2013);
    expect(createPreset("earlier-finish", []).release.targetFinish).toBe(130801.25);
    expect(createPreset("status-quo", []).release.targetFinish).toBe(134401.25);
  });

  it("round trips an edited Thursday launch through browser saves", () => {
    const s = createPreset("earlier-launch", fieldIds(2026));
    s.fieldYear = 2026;
    expect(s.waves.at(-1)!.start).toBe(-3600);
    s.release.pace = 655;
    let raw = "";
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    writeSaves(storage, [{ id: "thursday", updatedAt: "2026-09-12", scenario: s }]);
    expect(readSaves(storage)[0].scenario).toEqual(s);
  });
});
