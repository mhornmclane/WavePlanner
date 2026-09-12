import { describe, expect, it } from "vitest";
import { baseline } from "../src/data";
import { simulate } from "../src/engine";
import { arrivalEnvelope } from "../src/chartComparison";

describe("baseline arrival envelope", () => {
  it("uses starts and incoming arrivals through Finish, allowing boundary teams to change", () => {
    const result = simulate(baseline());
    result.teams = result.teams.slice(0, 2);
    result.teams[0].legs[0].departure = 100;
    result.teams[1].legs[0].departure = 200;
    result.teams[0].legs[0].arrival = 400;
    result.teams[1].legs[0].arrival = 300;
    const points = arrivalEnvelope(result);
    expect(points).toHaveLength(72);
    expect(points[0]).toEqual({ index: 0, earliest: 100, latest: 200 });
    expect(points[1]).toEqual({ index: 1, earliest: 300, latest: 400 });
    for (const p of points.slice(1)) {
      const arrivals = result.teams.map(t => t.legs[p.index - 1].arrival);
      expect(p.earliest).toBe(Math.min(...arrivals));
      expect(p.latest).toBe(Math.max(...arrivals));
    }
  });
  it("collapses to one line for one team and omits an empty field", () => {
    const result = simulate(baseline());
    result.teams = result.teams.slice(0, 1);
    expect(arrivalEnvelope(result).every(p => p.earliest === p.latest)).toBe(true);
    result.teams = [];
    expect(arrivalEnvelope(result)).toEqual([]);
  });
});
