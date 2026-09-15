import { course } from "./data";
import type { Scenario, Simulation, TimingRule, Wave } from "./model";
import { orderedWaveEntries } from "./waves";

export interface ReleaseRuleWarning {
  wave: Wave;
  rule: TimingRule;
  planned: number;
  difference: number;
  activity: "arrival" | "clearance" | "departure";
}

/** Check the nominal timetable independently of team assignments or historical paces.
 * Openings and fast-wave activation can change actual team departures; these are advisories.
 */
export function releaseRuleWarnings(s: Scenario, result: Pick<Simulation, "releasesByWave">): ReleaseRuleWarning[] {
  const warnings: ReleaseRuleWarning[] = [];
  for (const { w: wave } of orderedWaveEntries(s)) {
    const releases = result.releasesByWave[wave.id];
    for (const rule of s.timingRules.filter(r => r.enabled)) {
      const index = rule.exchange;
      const departure = index === 0 ? wave.start : releases[index];
      const arrival = index > 0
        ? (index === 1 ? wave.start : releases[index - 1]) + course.legs[index - 1].distance_miles * wave.release.pace
        : wave.start;
      const activity = rule.type === "arrive-by" ? "arrival" : rule.type === "clear-by" ? "clearance" : "departure";
      const planned = activity === "arrival" ? arrival : activity === "departure" ? departure
        : Math.max(arrival, departure ?? -Infinity);
      const difference = rule.type === "depart-after" ? rule.time - planned : planned - rule.time;
      if (difference > 1e-6) warnings.push({ wave, rule, planned, difference, activity });
    }
  }
  return warnings;
}
