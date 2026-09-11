import { openingTime, evaluateTimingRules } from "./timingRules";
import { bins, course, ORIGIN, resolveProfile } from "./data";
import { resolveAssignments } from "./waves";
import type {
  ClockTime,
  ExchangeSummary,
  LegTiming,
  Profile,
  Scenario,
  Simulation,
  TeamResult,
} from "./model";

export function clockSeconds(t: ClockTime): number {
  const [h, m] = t.time_24h.split(":").map(Number);
  return (t.day - 1) * 86400 + h * 3600 + m * 60;
}
export function legDuration(profile: Profile, legNumber: number): number {
  const bin = bins.find(
    (b) => legNumber >= b.first_leg && legNumber <= b.last_leg,
  );
  if (!bin) throw new Error(`No pace bin for leg ${legNumber}`);
  return (
    course.legs[legNumber - 1].distance_miles *
    profile.bin_mean_pace_seconds_per_mile[bin.bin_id]
  );
}
export function challengeBefore(leg: number, s: Scenario): number {
  return leg === 36
    ? s.challenges.monument
    : leg === 54
      ? s.challenges.lighthouse
      : 0;
}
export function releaseSegments(s: Scenario) {
  return s.release.mode === "visual"
    ? bins.map((b, i) => ({
        startLeg: b.first_leg,
        pace: s.release.visualPaces[i],
      }))
    : s.release.mode === "published"
      ? [{ startLeg: 1, pace: course.event.minimum_pace_seconds_per_mile }]
      : [...s.release.segments];
}
export function releasePace(s: Scenario, leg: number): number {
  return releaseSegments(s)
    .sort((a, b) => a.startLeg - b.startLeg)
    .filter((p) => p.startLeg <= leg)
    .at(-1)!.pace;
}
export function releaseSchedule(s: Scenario): number[] {
  if (s.release.mode === "published")
    return course.legs.map((l) => clockSeconds(l.release_time));
  const segments = releaseSegments(s).sort((a, b) => a.startLeg - b.startLeg);
  const result = [s.release.anchor];
  for (let i = 1; i < course.legs.length; i++) {
    const traversedLeg = i;
    const pace = segments
      .filter((p) => p.startLeg <= traversedLeg)
      .at(-1)!.pace;
    result.push(
      result[i - 1] +
        course.legs[i - 1].distance_miles * pace +
        challengeBefore(i + 1, s),
    );
  }
  return result;
}
export function peakConcurrency(legs: LegTiming[]): number {
  const events = legs.flatMap((l) => [
    { time: l.departure, delta: 1 },
    { time: l.arrival, delta: -1 },
  ]);
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);
  let active = 0,
    peak = 0;
  for (const e of events) {
    active += e.delta;
    peak = Math.max(peak, active);
  }
  return peak;
}
const minOrNull = (v: number[]) => (v.length ? Math.min(...v) : null);
const maxOrNull = (v: number[]) => (v.length ? Math.max(...v) : null);

export function exchangeSummaries(
  teams: TeamResult[],
  buffers: Scenario["buffers"],
): ExchangeSummary[] {
  return Array.from({ length: course.legs.length + 1 }, (_, index) => {
    const arrivals = index ? teams.map((t) => t.legs[index - 1].arrival) : [];
    const departures =
      index < course.legs.length
        ? teams.map((t) => t.legs[index].departure)
        : [];
    const events = [...arrivals, ...departures];
    const first = minOrNull(events),
      last = maxOrNull(events);
    const coverageStart = first === null ? null : first - buffers.before;
    const coverageEnd = last === null ? null : last + buffers.after;
    return {
      index,
      name: index
        ? course.legs[index - 1].end_location
        : course.legs[0].start_location,
      miles: index ? course.legs[index - 1].cumulative_distance_miles : 0,
      earliestArrival: minOrNull(arrivals),
      latestArrival: maxOrNull(arrivals),
      earliestDeparture: minOrNull(departures),
      latestDeparture: maxOrNull(departures),
      latestActivity: last,
      coverageStart,
      coverageEnd,
      coverage:
        coverageStart === null || coverageEnd === null
          ? 0
          : coverageEnd - coverageStart,
    };
  });
}

export function simulate(s: Scenario): Simulation {
  const releases = releaseSchedule(s);
  const assignments = resolveAssignments(s);
  const teams: TeamResult[] = s.selectedTeamIds.map((id) => {
    const profile = resolveProfile(s, id);
    const wave = s.waves.find((w) => w.id === assignments[id])!;
    const lateStart = wave.start > ORIGIN;
    const legs: LegTiming[] = [];
    for (const [index, courseLeg] of course.legs.entries()) {
      const prev = legs[index - 1];
      const challenge = challengeBefore(index + 1, s);
      const ready = prev ? prev.arrival + challenge : wave.start;
      const releaseSuppressed = lateStart && index < 35;
      // Late waves must physically reach the monument before any later leg can start.
      const monumentArrival =
        lateStart && index >= 35 ? legs[34].arrival : -Infinity;
      const eligible = prev
        ? Math.max(
            prev.departure,
            wave.start,
            monumentArrival,
            releaseSuppressed ? ready : Math.min(ready, releases[index]),
          )
        : wave.start;
      const gate = openingTime(s.timingRules, index);
      const departure = Math.max(eligible, gate);
      const duration = legDuration(profile, index + 1);
      legs.push({
        teamId: id,
        leg: index + 1,
        departure,
        arrival: departure + duration,
        duration,
        releaseTime: releases[index],
        releaseSuppressed,
        releaseUsed: !!prev && departure < ready - 1e-7,
        challengeWait: prev
          ? Math.min(challenge, Math.max(0, eligible - prev.arrival))
          : 0,
        gateWait: departure - eligible,
        waitStart: prev ? prev.arrival : wave.start,
      });
    }
    return {
      teamId: id,
      waveId: wave.id,
      legs,
      movingTime: legs.reduce((sum, l) => sum + l.duration, 0),
      finish: legs.at(-1)!.arrival,
      allComplete: Math.max(...legs.map((l) => l.arrival)),
      peakActive: peakConcurrency(legs),
    };
  });
  const exchanges = exchangeSummaries(teams, s.buffers);
  return {
    teams,
    timingRules: evaluateTimingRules(s.timingRules, teams),
    exchanges,
    releases,
    finishSpread: teams.length
      ? Math.max(...teams.map((t) => t.finish)) -
        Math.min(...teams.map((t) => t.finish))
      : 0,
    lastOffCourse: maxOrNull(teams.map((t) => t.allComplete)),
    exchangeHours: exchanges.reduce((sum, e) => sum + e.coverage / 3600, 0),
    releaseCount: teams.reduce(
      (sum, t) => sum + t.legs.filter((l) => l.releaseUsed).length,
      0,
    ),
    peakActive: teams.length ? Math.max(...teams.map((t) => t.peakActive)) : 0,
  };
}
