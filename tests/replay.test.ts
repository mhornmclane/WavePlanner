import { describe, expect, it } from "vitest";
import { baseline, profiles, teamId } from "../src/data";
import { simulate } from "../src/engine";
import { buildReplay } from "../src/replay";

describe("exchange spread replay", () => {
  it("matches all 72 exchange arrival summaries for the full field", () => {
    const result = simulate(baseline());
    const data = buildReplay(result);
    expect(data.frames).toHaveLength(72);
    for (const frame of data.frames) {
      const summary = result.exchanges[frame.index];
      expect(frame.first).toBe(
        frame.index ? summary.earliestArrival : summary.earliestDeparture,
      );
      expect(frame.last).toBe(
        frame.index ? summary.latestArrival : summary.latestDeparture,
      );
      expect(frame.markers).toHaveLength(51);
      expect(Math.min(...frame.markers.map((m) => m.ahead))).toBe(0);
      expect(Math.max(...frame.markers.map((m) => m.ahead))).toBe(frame.spread);
    }
    expect(data.maxSpread).toBe(Math.max(...data.frames.map((f) => f.spread)));
    expect(data.axisSeconds).toBe(data.maxSpread);
  });
  it("positions the example arrivals at one hour, forty minutes and zero", () => {
    const result = simulate(baseline(profiles.slice(0, 3).map(teamId)));
    [36000, 37200, 39600].forEach(
      (arrival, i) => (result.teams[i].legs[0].arrival = arrival),
    );
    expect(buildReplay(result).frames[1].markers.map((m) => m.ahead)).toEqual([
      3600, 2400, 0,
    ]);
  });
  it("retains fractional precision, cross-midnight times, growing and shrinking gaps", () => {
    const result = simulate(baseline(profiles.slice(0, 2).map(teamId)));
    [
      [86399.123, 90000.456],
      [100000, 107200],
      [120000, 120600],
    ].forEach(([a, b], i) => {
      result.teams[0].legs[i].arrival = a;
      result.teams[1].legs[i].arrival = b;
    });
    const frames = buildReplay(result).frames;
    expect(frames[1].spread).toBeCloseTo(3601.333, 8);
    expect(frames[2].spread).toBe(7200);
    expect(frames[3].spread).toBe(600);
  });
  it("shows staggered starts and identical travel paces as a starting gap", () => {
    const result = simulate(baseline(profiles.slice(0, 2).map(teamId)));
    const shift = 10800;
    result.teams[1].legs = result.teams[0].legs.map((leg) => ({
      ...leg,
      departure: leg.departure + shift,
      arrival: leg.arrival + shift,
    }));
    for (const frame of buildReplay(result).frames) {
      expect(frame.markers[0].ahead).toBeCloseTo(shift, 8);
      expect(frame.markers[1].ahead).toBe(0);
    }
  });
  it("identical timings collapse to zero, with a usable one-hour axis", () => {
    const result = simulate(baseline(profiles.slice(0, 2).map(teamId)));
    result.teams[1].legs = structuredClone(result.teams[0].legs);
    const data = buildReplay(result);
    expect(data.axisSeconds).toBe(3600);
    expect(
      data.frames.every(
        (f) => f.spread === 0 && f.markers.every((m) => m.ahead === 0),
      ),
    ).toBe(true);
  });
  it("one team always has zero spread; empty fields have unavailable times", () => {
    expect(
      buildReplay(simulate(baseline([teamId(profiles[0])]))).frames.every(
        (f) => f.spread === 0,
      ),
    ).toBe(true);
    const empty = buildReplay(simulate(baseline([])));
    expect(empty.axisSeconds).toBe(3600);
    expect(
      empty.frames.every(
        (f) => f.first === null && f.last === null && f.markers.length === 0,
      ),
    ).toBe(true);
  });
  it("ignores staffing buffers and uses late incoming arrivals after releases", () => {
    const s = baseline();
    const result = simulate(s);
    const expected = buildReplay(result);
    const late = result.teams
      .flatMap((t) =>
        t.legs.slice(1).map((l, i) => ({ l, incoming: t.legs[i] })),
      )
      .find(({ l, incoming }) => l.departure < incoming.arrival)!;
    expect(late).toBeDefined();
    const marker = expected.frames[late.l.leg - 1].markers.find(
      (m) => m.teamId === late.l.teamId,
    )!;
    expect(marker.time).toBe(late.incoming.arrival);
    expect(marker.release).toBe(result.releases[late.l.leg - 1]);
    expect(marker.late).toBeGreaterThan(0);
    expect(marker.overlaps).toBe(true);
    s.buffers = { before: 7200, after: 3600 };
    expect(buildReplay(simulate(s))).toEqual(expected);
  });
  it("uses scenario releases and keeps start and finish free of release indicators", () => {
    const result = simulate(baseline(profiles.slice(0, 3).map(teamId)));
    const release = result.releases[1] + 600;
    result.releases[1] = release;
    [-60, 0, 60].forEach((offset, i) => {
      result.teams[i].legs[0].arrival = release + offset;
      result.teams[i].legs[1].departure = release;
    });
    const { frames } = buildReplay(result);
    expect(frames[1].markers.map(m => [m.release, m.late, m.overlaps])).toEqual([
      [release, 0, false], [release, 0, false], [release, 60, true],
    ]);
    for (const frame of [frames[0], frames[71]]) {
      expect(frame.markers.every(m => m.release === undefined && m.late === undefined && m.overlaps === undefined)).toBe(true);
    }
  });
  it("keeps exchange order when arrivals occur out of chronological order", () => {
    const result = simulate(baseline([teamId(profiles[0])]));
    result.teams[0].legs[0].arrival = 100000;
    result.teams[0].legs[1].arrival = 90000;
    const frames = buildReplay(result).frames;
    expect(frames[1].first).toBe(100000);
    expect(frames[2].first).toBe(90000);
    expect(frames.map((f) => f.index)).toEqual(
      Array.from({ length: 72 }, (_, i) => i),
    );
  });
});
