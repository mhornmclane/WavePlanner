import { describe, expect, it } from "vitest";
import {
  baseline,
  bins,
  course,
  profileById,
  profiles,
  teamId,
} from "../src/data";
import {
  clockSeconds,
  legDuration,
  peakConcurrency,
  releaseSchedule,
  simulate,
} from "../src/engine";
import { clock } from "../src/format";
import type { Profile, Scenario } from "../src/model";
import historical from "../src/data/historical.json" with { type: "json" };

function synthetic(pace: number, fn: (s: Scenario) => void) {
  const p: Profile = {
    year: 2000,
    team: "Test fixture",
    overall_mean_pace_seconds_per_mile: pace,
    bin_mean_pace_seconds_per_mile: Object.fromEntries(
      bins.map((b) => [b.bin_id, pace]),
    ),
  };
  const id = teamId(p);
  profileById.set(id, p);
  try {
    fn(baseline([id]));
  } finally {
    profileById.delete(id);
  }
}
describe("source integrity and pace calculation", () => {
  it("preserves all 51 unique team-year records and the 71-leg course", () => {
    expect(profiles).toHaveLength(51);
    expect(new Set(profiles.map(teamId)).size).toBe(51);
    expect(course.legs).toHaveLength(71);
    let cumulative = 0;
    course.legs.forEach((leg, i) => {
      expect(leg.leg_number).toBe(i + 1);
      expect(leg.distance_miles).toBe(historical.course.legs[i].distance_miles);
      cumulative += leg.distance_miles;
      expect(leg.cumulative_distance_miles).toBeCloseTo(cumulative, 7);
    });
    expect(cumulative).toBeCloseTo(205.72, 8);
  });
  it.each([
    [14, "legs_01_14"],
    [15, "legs_15_28"],
    [28, "legs_15_28"],
    [29, "legs_29_42"],
    [42, "legs_29_42"],
    [43, "legs_43_56"],
    [56, "legs_43_56"],
    [57, "legs_57_71"],
    [71, "legs_57_71"],
  ])("uses correct pace at leg %s", (leg, bin) => {
    const n = Number(leg);
    expect(legDuration(profiles[0], n)).toBeCloseTo(
      course.legs[n - 1].distance_miles *
        profiles[0].bin_mean_pace_seconds_per_mile[bin],
      9,
    );
  });
});
describe("race simulation", () => {
  it("matches hand-calculated early releases and overlapping legs", () =>
    synthetic(900, (s) => {
      s.waves[0].release = { pace: 600, targetFinish: 3600 + 205.72 * 600 + s.challenges.monument + s.challenges.lighthouse };
      const t = simulate(s).teams[0];
      expect(t.legs[0].departure).toBe(3600);
      expect(t.legs[0].arrival).toBe(6048);
      expect(t.legs[1].departure).toBe(5232);
      expect(t.legs[1].arrival).toBe(7743);
      expect(t.legs[1].releaseUsed).toBe(true);
      expect(t.peakActive).toBeGreaterThan(1);
    }));
  it("allows a challenge release before incoming arrival and adds no fictitious wait", () =>
    synthetic(900, (s) => {
      s.waves[0].release = { pace: 600, targetFinish: 3600 + 205.72 * 600 + s.challenges.monument + s.challenges.lighthouse };
      const { legs } = simulate(s).teams[0];
      // Prior runner: 2.7 * 900 = 2430 sec. Release gap: 2.7 * 600 + 960 = 2580 sec.
      expect(legs[35].departure - legs[34].departure).toBeCloseTo(2580, 8);
      expect(legs[35].departure - legs[34].arrival).toBeCloseTo(150, 8);
      expect(legs[35].challengeWait).toBeCloseTo(150, 8);
      expect(legs[35].releaseUsed).toBe(true);
      s.challenges.monument = 0;
      const early = simulate(s).teams[0].legs;
      expect(early[35].departure).toBeLessThan(early[34].arrival);
      expect(early[35].challengeWait).toBe(0);
    }));
  it("fast teams complete challenges and wait at the fixed JBCC gate", () =>
    synthetic(300, (s) => {
      const { legs, movingTime } = simulate(s).teams[0];
      expect(legs[35].departure - legs[34].arrival).toBeCloseTo(960, 8);
      expect(legs[53].departure - legs[52].arrival).toBeCloseTo(1260, 8);
      expect(legs[69].departure).toBe(86400 + 6 * 3600);
      expect(legs[69].gateWait).toBeGreaterThan(0);
      expect(movingTime).toBeCloseTo(205.72 * 300, 8);
    }));
  it("never starts a leg before its team or an earlier leg when waves start very late", () => {
    const s = baseline();
    s.waves[0].start = 3 * 86400;
    const r = simulate(s);
    r.teams.forEach((t) =>
      t.legs.forEach((l, i) => {
        expect(l.departure).toBeGreaterThanOrEqual(s.waves[0].start);
        if (i)
          expect(l.departure).toBeGreaterThanOrEqual(t.legs[i - 1].departure);
      }),
    );
  });
  it("counts tied finish/start as a handoff, not simultaneous runners", () =>
    synthetic(300, (s) => {
      expect(simulate(s).teams[0].peakActive).toBe(1);
    }));
  it("distinguishes final-leg arrival from outstanding runner completion", () =>
    synthetic(2400, (s) => {
      s.waves[0].release = { pace: 60, targetFinish: 3600 + 205.72 * 60 + s.challenges.monument + s.challenges.lighthouse };
      const r = simulate(s),
        t = r.teams[0];
      expect(t.allComplete).toBeGreaterThan(t.finish);
      expect(t.allComplete).toBe(t.legs[69].arrival);
      expect(r.lastOffCourse).toBe(t.allComplete);
    }));
  it("moving times are invariant under wave, challenge and release changes", () => {
    const s = baseline(),
      original = simulate(s);
    s.waves[0].start += 7200;
    s.challenges.monument = 5400;
    s.waves[0].release = { pace: 450, targetFinish: 3600 + 205.72 * 450 + s.challenges.monument + s.challenges.lighthouse };
    const changed = simulate(s);
    expect(changed.teams.map((t) => t.movingTime)).toEqual(
      original.teams.map((t) => t.movingTime),
    );
  });
  it("baseline compared with identical configuration has zero differences", () => {
    const a = simulate(baseline()),
      b = simulate(structuredClone(baseline()));
    expect(a).toEqual(b);
  });
});
describe("exchange coverage", () => {
  it("rounds staffing boundaries outward across midnight", () => {
    expect(clock(86399, "down")).toBe("Friday 11:59 PM");
    expect(clock(86399, "up")).toBe("Saturday 12:00 AM");
    expect(clock(86400, "up")).toBe("Saturday 12:00 AM");
    expect(clock(null, "down")).toBe("—");
  });
  it("covers every event including early departures, late arrivals, and the gate", () => {
    const s = baseline();
    s.buffers = { before: 600, after: 900 };
    const r = simulate(s);
    expect(r.exchanges).toHaveLength(72);
    r.teams.forEach((t) =>
      t.legs.forEach((l) => {
        const from = r.exchanges[l.leg - 1],
          to = r.exchanges[l.leg];
        expect(from.coverageStart!).toBeLessThanOrEqual(l.departure - 600);
        expect(from.coverageEnd!).toBeGreaterThanOrEqual(l.departure + 900);
        expect(to.coverageStart!).toBeLessThanOrEqual(l.arrival - 600);
        expect(to.coverageEnd!).toBeGreaterThanOrEqual(l.arrival + 900);
      }),
    );
    expect(r.exchanges[0].earliestArrival).toBeNull();
    expect(r.exchanges[71].earliestDeparture).toBeNull();
    expect(r.exchanges[35].name).toContain("Pilgrim Monument");
  });
  it("adds buffers to all 72 occurrences, without merging repeated locations", () => {
    const s = baseline(),
      a = simulate(s);
    s.buffers = { before: 600, after: 900 };
    const b = simulate(s);
    expect(b.exchangeHours - a.exchangeHours).toBeCloseTo(
      (72 * 1500) / 3600,
      8,
    );
    expect(b.exchanges[0].name).toContain("Fairgrounds");
    expect(b.exchanges[71].name).toContain("Fairgrounds");
  });
  it("handles an empty selection without invalid metrics or phantom coverage", () => {
    const s = baseline([]);
    s.buffers = { before: 600, after: 600 };
    const r = simulate(s);
    expect(r.teams).toEqual([]);
    expect(r.lastOffCourse).toBeNull();
    expect(r.exchangeHours).toBe(0);
    expect(r.finishSpread).toBe(0);
    expect(
      r.exchanges.every(
        (e) => e.coverageStart === null && e.coverageEnd === null,
      ),
    ).toBe(true);
  });
});
