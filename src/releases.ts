import type { Scenario, Simulation, Wave } from "./model";
import { orderedWaveEntries } from "./waves";
import { clock } from "./format";

/** Stable display order; identical guides share a single inspectable marker. */
export function releaseGroups(scenario: Scenario, result: Simulation) {
  const groups = new Map<string, { waves: Wave[]; releases: number[] }>();
  for (const { w } of orderedWaveEntries(scenario)) {
    const releases = result.releasesByWave[w.id];
    const key = JSON.stringify(releases);
    const group = groups.get(key);
    if (group) group.waves.push(w);
    else groups.set(key, { waves: [w], releases });
  }
  return [...groups.values()];
}

export function targetGroups(scenario: Scenario) {
  const groups = new Map<number, Wave[]>();
  for (const { w } of orderedWaveEntries(scenario)) {
    const group = groups.get(w.release.targetFinish);
    if (group) group.push(w);
    else groups.set(w.release.targetFinish, [w]);
  }
  return [...groups].map(([time, waves]) => ({ time, waves }));
}

export function finishTargetLabel(scenario: Scenario) {
  const targets = scenario.waves.map(w => w.release.targetFinish);
  const first = Math.min(...targets), last = Math.max(...targets);
  return first === last ? `Target: ${clock(first)}` : `Wave targets: ${clock(first)} – ${clock(last)}`;
}
