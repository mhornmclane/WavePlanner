import { describe, expect, it } from "vitest";
import raw from "../src/data/Ruck4HIT_replay_paces.json";
import { baseline, course } from "../src/data";
import { clockSeconds, simulate } from "../src/engine";
import { buildHistoricalReplay, historicalResult, replayRecords, validateReplayRecords, yearColors } from "../src/historicalReplayData";

describe("historical replay", () => {
  it("validates the complete supplied record and rejects malformed data", () => {
    expect(replayRecords).toHaveLength(51);
    expect(replayRecords.filter(r => r.year === 2025)).toHaveLength(20);
    for (const mutate of [
      (d: typeof raw) => { d.pace_unit = "minutes"; },
      (d: typeof raw) => { d.records.push(d.records[0]); },
      (d: typeof raw) => { d.records[0].legs["1"] = 0; },
      (d: typeof raw) => { d.records[0].legs["1"] = NaN; },
      (d: typeof raw) => { delete (d.records[0].legs as Record<string, number>)["71"]; },
    ]) { const d = structuredClone(raw); mutate(d); expect(() => validateReplayRecords(d)).toThrow(); }
  });
  it("uses every supplied leg pace with the fixed baseline mechanics", () => {
    expect(historicalResult.releases).toEqual(course.legs.map(l => clockSeconds(l.release_time)));
    for (const [i, team] of historicalResult.teams.entries()) {
      expect(team.legs[0].departure).toBe(3600);
      for (const leg of team.legs) {
        expect(leg.duration).toBe(replayRecords[i].legs[leg.leg] * course.legs[leg.leg - 1].distance_miles);
        const prev = team.legs[leg.leg - 2];
        const challenge = leg.leg === 36 ? 960 : leg.leg === 54 ? 1260 : 0;
        const eligible = prev ? Math.max(prev.departure, 3600, Math.min(prev.arrival + challenge, historicalResult.releases[leg.leg - 1])) : 3600;
        expect(leg.departure).toBe(Math.max(eligible, leg.leg === 70 ? 108000 : -Infinity));
      }
    }
    const s = baseline(); s.release.pace = NaN;
    expect(() => simulate(s, true, () => NaN)).toThrow("Invalid replay pace");
  });
  it("normalizes each year independently and shares one fixed scale", () => {
    const data = buildHistoricalReplay(historicalResult);
    expect(data.frames).toHaveLength(72);
    for (const f of data.frames) for (const y of f.years!) {
      const markers = f.markers.filter(m => m.teamId.startsWith(`${y.year}::`));
      expect(Math.min(...markers.map(m => m.ahead))).toBe(0);
      expect(Math.max(...markers.map(m => m.ahead))).toBe(y.spread);
      expect(y.spread).toBe(y.last - y.first);
    }
    expect(data.axisSeconds).toBe(Math.max(...data.frames.flatMap(f => f.years!.map(y => y.spread))));
    expect(new Set(Object.values(yearColors)).size).toBe(3);
    const empty = buildHistoricalReplay({ ...historicalResult, teams: [] });
    expect(empty.axisSeconds).toBe(3600);
    expect(empty.frames.every(f => !f.markers.length && !f.years!.length)).toBe(true);
    const single = buildHistoricalReplay({ ...historicalResult, teams: historicalResult.teams.filter(t => t.teamId.startsWith("2025::")) });
    expect(single.frames.every(f => f.years!.length === 1 && f.markers.length === 20)).toBe(true);
  });
  it("marks late incoming arrivals independently of actual overlapping departures", () => {
    const result = structuredClone(historicalResult);
    result.teams = result.teams.slice(0, 1);
    const leg = result.teams[0].legs[0];
    const outgoing = result.teams[0].legs[1];
    const release = result.releases[1];
    for (const offset of [-0.1, 0, 0.1]) {
      leg.arrival = release + offset;
      outgoing.departure = release + 100;
      const marker = buildHistoricalReplay(result).frames[1].markers[0];
      expect(marker.late).toBeCloseTo(Math.max(0, offset));
      expect(marker.overlaps).toBe(false);
    }
    outgoing.departure = release;
    expect(buildHistoricalReplay(result).frames[1].markers[0].overlaps).toBe(true);
    for (const i of [0, 71]) expect(buildHistoricalReplay(result).frames[i].markers[0].release).toBeUndefined();
  });
});
