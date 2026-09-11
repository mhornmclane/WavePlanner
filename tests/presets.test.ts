import { describe, expect, it } from "vitest";
import { baseline, profileById, profiles, teamId } from "../src/data";
import { createPreset, presets } from "../src/presets";
import { simulate } from "../src/engine";
import { syncAssignments } from "../src/waves";
import { parseScenario, serializeScenario, readSaves, writeSaves } from "../src/storage";

describe("configuration presets", () => {
  it.each(presets)("creates an editable, isolated $name with baseline settings", (preset) => {
    const ids = profiles.slice(0, 4).map(teamId);
    const s = createPreset(preset.id, ids);
    const b = baseline(ids);
    expect(s.selectedTeamIds).toEqual(ids);
    expect(s.release).toEqual(b.release);
    expect(s.challenges).toEqual(b.challenges);
    expect(s.buffers).toEqual(b.buffers);
    expect(s.waveRules.mode).toBe("pace");
    expect(parseScenario(serializeScenario(s))).toEqual(s);
    const original = structuredClone(s);
    s.waves[0].start += 3600;
    s.release.visualPaces[0] = 700;
    s.selectedTeamIds.pop();
    expect(createPreset(preset.id, ids)).toEqual(original);
    expect(createPreset(preset.id, []).assignments).toEqual({});
  });

  it("matches the status quo simulation exactly", () => {
    const ids = profiles.map(teamId);
    expect(simulate(createPreset("status-quo", ids))).toEqual(simulate(baseline(ids)));
  });

  it.each([
    ["three-waves", 570, 10800, 7200],
    ["three-waves", 615, 7200, 3600],
    ["midnight-waves", 570, 7200, 3600],
    ["midnight-waves", 630, 3600, 0],
    ["two-waves", 555, 10800, 3600],
  ] as const)("%s assigns both sides of %s and exact equality", (id, cutoff, faster, slower) => {
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
