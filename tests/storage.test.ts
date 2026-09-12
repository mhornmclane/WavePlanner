import { resolveAssignments } from "../src/waves";
import { describe, expect, it } from "vitest";
import { baseline } from "../src/data";
import { simulate } from "../src/engine";
import { clock } from "../src/format";
import {
  parseScenario,
  readSaves,
  serializeScenario,
  staffingCsv,
  validateScenario,
  writeSaves,
} from "../src/storage";

describe("configuration serialization and browser storage", () => {
  it.each([
    [-3, "Thursday 10:00 PM"],
    [3, "Friday 4:00 AM"],
    [0.5, "Friday 1:30 AM"],
    [-1, "Friday 12:00 AM"],
  ])(
    "preserves a %s hour wave offset across midnight and JSON round trips",
    (hours, expected) => {
      const original = baseline();
      const s = baseline();
      s.waves[0].start = 3600 + hours * 3600;
      const loaded = parseScenario(serializeScenario(s));
      expect(loaded.waves[0].start).toBe(s.waves[0].start);
      expect(clock(loaded.waves[0].start)).toBe(expected);
      const result = simulate(loaded);
      expect(
        result.teams.every((t) => t.legs[0].departure === s.waves[0].start),
      ).toBe(true);
      expect(result.teams.map((t) => t.movingTime)).toEqual(
        simulate(original).teams.map((t) => t.movingTime),
      );
    },
  );
  it("round trips a non-default configuration and its exact simulated results", () => {
    const s = baseline();
    s.name = "Two waves";
    s.waves.push({
      id: "second",
      name: "Later",
      color: "#445566",
      start: 7200,
    });
    s.waveRules.boundaries = [600];
    s.assignments = resolveAssignments(s);
    s.release.pace = 710;
    s.buffers.before = 600;
    s.waves[0].name = "Wave 2";
    const parsed = parseScenario(serializeScenario(s));
    expect(parsed).toEqual(s);
    expect(simulate(parsed)).toEqual(simulate(s));
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };
    expect(readSaves(storage)).toEqual([]);
    const saves = [
      { id: "test", updatedAt: "2026-09-11T00:00:00Z", scenario: s },
    ];
    writeSaves(storage, saves);
    expect(readSaves(storage)).toEqual(saves);
    writeSaves(storage, []);
    expect(readSaves(storage)).toEqual([]);
  });
  it("rejects wrong versions, source data, malformed JSON and oversized input", () => {
    expect(() => parseScenario("{bad")).toThrow("JSON");
    expect(() => parseScenario(" ".repeat(1_000_001))).toThrow("large");
    expect(() => validateScenario({ ...baseline(), schemaVersion: 5 })).toThrow(
      "version",
    );
    expect(() => validateScenario({ ...baseline(), sources: {} })).toThrow(
      "different",
    );
  });
  it.each([
    [
      "duplicate teams",
      (s: any) => s.selectedTeamIds.push(s.selectedTeamIds[0]),
    ],
    ["unknown team", (s: any) => s.selectedTeamIds.push("unknown")],
    [
      "missing assignment",
      (s: any) => delete s.assignments[s.selectedTeamIds[0]],
    ],
    [
      "unknown wave",
      (s: any) => (s.assignments[s.selectedTeamIds[0]] = "missing"),
    ],
    ["extra assignment", (s: any) => (s.assignments.unknown = "wave-1")],
    ["duplicate waves", (s: any) => s.waves.push(s.waves[0])],
    ["empty waves", (s: any) => (s.waves = [])],
    ["invalid color", (s: any) => (s.waves[0].color = "url(bad)")],
    ["start too early", (s: any) => (s.waves[0].start = -30 * 86400 - 1)],
    ["nonfinite number", (s: any) => (s.release.targetFinish = Infinity)],
    ["zero pace", (s: any) => (s.release.pace = 0)],
    ["negative buffer", (s: any) => (s.buffers.after = -1)],
    ["oversized challenge", (s: any) => (s.challenges.monument = 86401)],
  ])("rejects %s", (_, change) => {
    const s = baseline();
    change(s);
    expect(() => validateScenario(s)).toThrow();
  });
  it("exports every staffing occurrence with proper CSV quoting", () => {
    const r = simulate(baseline());
    const csv = staffingCsv(r, r);
    expect(csv.split("\r\n")).toHaveLength(73);
    expect(csv).toContain('"Pilgrim Monument, 1 High Pole Rd"');
    expect(csv).toContain('"Coverage difference hours"');
    expect(
      csv
        .split("\r\n")
        .slice(1)
        .every((row) => row.endsWith('"0.0000"')),
    ).toBe(true);
  });
});
