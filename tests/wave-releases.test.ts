import { describe, expect, it } from "vitest";
import { baseline, course, fieldIds } from "../src/data";
import { latestStart, releaseSchedule, simulate } from "../src/engine";
import { createPreset, presets } from "../src/presets";
import { buildReplay } from "../src/replay";
import { finishTargetLabel, releaseGroups, targetGroups } from "../src/releases";
import { parseScenario, readSaves, serializeScenario, STORAGE_KEY, teamResultsCsv, validateScenario, writeSaves } from "../src/storage";
import { removeWave, syncAssignments } from "../src/waves";
import reference from "./preset-reference.json";

describe("wave-specific releases", () => {
  it.each(presets)("$id never launches after any wave’s latest start", preset => {
    for (const year of ["all", 2024, 2025, 2026] as const) {
      const s = createPreset(preset.id, fieldIds(year));
      for (const wave of s.waves) {
        expect(wave.start).toBeLessThanOrEqual(latestStart(s, wave)+1e-6);
        expect(wave.solver).toBe("finish");
        expect(wave.release.targetFinish).toBeCloseTo(wave.start+course.event.total_distance_miles*wave.release.pace+s.challenges.monument+s.challenges.lighthouse,8);
        expect(wave.release.pace).toBeLessThanOrEqual(preset.releasePace);
      }
    }
  });
  it("offers exactly the original seven presets", () => {
    expect(presets.map(p=>p.id)).toEqual(["status-quo","two-waves","three-waves","tight-finish","earlier-finish","eleven-am","earlier-launch"]);
  });

  it.each(reference)("preserves $id results for $year", expected => {
    const s = createPreset(expected.id as Parameters<typeof createPreset>[0], fieldIds(expected.year as "all" | number));
    // Legacy saves retain their original shared settings even though presets are now corrected.
    const preset = presets.find(p=>p.id===expected.id)!;
    s.waves.forEach(w=>w.release={targetFinish:preset.targetFinish,pace:preset.releasePace});
    const r = simulate(s);
    for (const key of ["exchangeHours", "lastOffCourse", "releaseCount", "peakActive", "finishSpread"] as const)
      expect(r[key]).toBe(expected[key]);
    expect(r.teams.map(t => ({ teamId: t.teamId, finish: t.finish, allComplete: t.allComplete }))).toEqual(expected.teams);
  });

  it("changing one wave changes only its timetable and teams", () => {
    const s = createPreset("three-waves", fieldIds("all"));
    const before = simulate(s);
    const wave = s.waves[1];
    wave.release = { targetFinish: wave.release.targetFinish - 1800, pace: 600 };
    const after = simulate(s);
    expect(after.releasesByWave[wave.id]).not.toEqual(before.releasesByWave[wave.id]);
    for (const other of s.waves.filter(w => w.id !== wave.id)) {
      expect(after.releasesByWave[other.id]).toEqual(before.releasesByWave[other.id]);
      expect(after.teams.filter(t => t.waveId === other.id)).toEqual(before.teams.filter(t => t.waveId === other.id));
    }
    expect(after.teams.filter(t => t.waveId === wave.id)).not.toEqual(before.teams.filter(t => t.waveId === wave.id));
    const replay = buildReplay(after);
    for (const team of after.teams) {
      expect(team.legs.map(l => l.releaseTime)).toEqual(after.releasesByWave[team.waveId]);
      expect(team.movingTime).toBe(before.teams.find(t => t.teamId === team.teamId)!.movingTime);
      const marker = replay.frames[36].markers.find(m => m.teamId === team.teamId)!;
      expect(marker.release).toBe(after.releasesByWave[team.waveId][36]);
      expect(marker.late).toBe(Math.max(0, team.legs[35].arrival - marker.release!));
    }
  });

  it("works backward per wave including challenges and fractional seconds", () => {
    const s = createPreset("three-waves", []);
    s.waves.forEach((wave, i) => {
      wave.release = { targetFinish: 140000.25 + i * 900, pace: 610 + i * 11 };
      const timetable = releaseSchedule(s, wave);
      expect(timetable[0]).toBe(latestStart(s, wave));
      expect(timetable[70] + course.legs[70].distance_miles * wave.release.pace).toBeCloseTo(wave.release.targetFinish, 8);
    });
    const starts = s.waves.map(w => latestStart(s, w));
    s.challenges.monument += 600;
    s.waves.forEach((wave, i) => expect(latestStart(s, wave)).toBeCloseTo(starts[i] - 600, 8));
    expect(Object.keys(simulate(s).releasesByWave)).toHaveLength(3);
  });

  it("keeps schedules attached to wave identity through boundary edits and removal", () => {
    const s = createPreset("three-waves", fieldIds("all"));
    s.waves.forEach((w, i) => w.release.targetFinish += i * 600);
    s.waveRules.boundaries = [600, 660];
    const reassigned = syncAssignments(s);
    const result = simulate(reassigned);
    for (const team of result.teams) expect(team.legs[40].releaseTime).toBe(result.releasesByWave[team.waveId][40]);
    const merged = removeWave(reassigned, 1);
    expect(merged.waves.map(w => w.release)).toEqual([s.waves[0].release, s.waves[2].release]);
  });

  it("groups identical guides and targets, and exports wave-specific overruns", () => {
    const s = createPreset("three-waves", fieldIds("all"));
    s.waves.forEach(w=>w.release={...s.waves[0].release});
    expect(releaseGroups(s, simulate(s))).toHaveLength(1);
    expect(targetGroups(s)).toHaveLength(1);
    s.waves[0].release.targetFinish -= 1800;
    const result = simulate(s);
    expect(releaseGroups(s, result)).toHaveLength(2);
    expect(targetGroups(s)).toHaveLength(2);
    expect(finishTargetLabel(s)).toMatch(/^Wave targets:/);
    const csv = teamResultsCsv(s, result).split("\r\n");
    result.teams.forEach((t, i) => {
      const target = s.waves.find(w => w.id === t.waveId)!.release.targetFinish;
      expect(csv[i + 1]).toContain(`"${Math.max(0, t.finish - target)}"`);
    });
  });
});

function legacy() {
  const current = createPreset("three-waves", fieldIds("all"));
  return { ...current, schemaVersion: 6, release: { ...current.waves[0].release },
    waves: current.waves.map(({ release: _release, ...wave }) => wave) };
}

describe("release settings persistence", () => {
  it("migrates v6 without changing its results or mutating the input", () => {
    const old = legacy(), snapshot = structuredClone(old);
    const migrated = parseScenario(JSON.stringify(old));
    expect(migrated.schemaVersion).toBe(8);
    expect(migrated).not.toHaveProperty("release");
    const expected = createPreset("three-waves", fieldIds("all"));
    expected.waves.forEach(w=>w.release={...old.release});
    expect(simulate(migrated)).toEqual(simulate(expected));
    expect(old).toEqual(snapshot);
    migrated.waves[0].release.pace++;
    expect(migrated.waves[1].release.pace).toBe(old.release.pace);
    expect(parseScenario(serializeScenario(migrated))).toEqual(migrated);
  });

  it("retains legacy browser data on read and failed write, and prefers v7 after a successful write", () => {
    const old = JSON.stringify([{ id: "saved", updatedAt: "2026-09-14", scenario: legacy() }]);
    const data = new Map([["ruck4hit-scenarios-v6", old]]);
    const storage = { getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); } };
    const saves = readSaves(storage);
    expect(saves[0].scenario.schemaVersion).toBe(8);
    expect(data.size).toBe(1);
    expect(() => writeSaves({ setItem: () => { throw new Error("quota"); } }, saves)).toThrow("quota");
    expect(data.get("ruck4hit-scenarios-v6")).toBe(old);
    saves[0].scenario.waves[0].release.pace = 630;
    writeSaves(storage, saves);
    expect(data.has(STORAGE_KEY)).toBe(true);
    expect(readSaves(storage)).toEqual(saves);
    expect(data.get("ruck4hit-scenarios-v6")).toBe(old);
    writeSaves(storage, []);
    expect(readSaves(storage)).toEqual([]);
  });

  it.each([undefined, { pace: 0, targetFinish: 140000 }, { pace: 625, targetFinish: Infinity },
    { pace: 625, targetFinish: 140000, extra: true }])("rejects invalid wave release settings %j", release => {
    const s = baseline() as any;
    s.waves[0].release = release;
    expect(() => validateScenario(s)).toThrow("Wave 1");
  });
  it("rejects malformed legacy settings instead of silently applying defaults", () => {
    const s = legacy(); s.release.pace = 0;
    expect(() => validateScenario(s)).toThrow("release pace");
  });
});
