import { resolveProfile } from "./data";
import type { Scenario } from "./model";

export function resolveAssignments(s: Scenario): Record<string, string> {
  return Object.fromEntries(
    s.selectedTeamIds.map((id) => {
      const pace = resolveProfile(s, id).overall_mean_pace_seconds_per_mile;
      const index = s.waveRules.boundaries.filter(
        (boundary) => pace >= boundary,
      ).length;
      return [id, s.waves[index].id];
    }),
  );
}
export function syncAssignments(s: Scenario): Scenario {
  return {
    ...s,
    waves: s.waves.map((w, i) => ({
      ...w,
      name: /^(Wave \d+|Main start)$/.test(w.name)
        ? `Wave ${s.waves.length - i}`
        : w.name,
    })),
    assignments: resolveAssignments(s),
  };
}
// Store pace ranges in ascending order, with the slowest wave last.
// Present them slowest first, retaining their original indices for boundary edits.
export function orderedWaveEntries(s: Scenario) {
  const entries = s.waves.map((w, i) => ({ w, i }));
  return entries.reverse();
}
export function validBoundary(
  boundaries: number[],
  index: number,
  value: number,
) {
  return (
    Number.isFinite(value) &&
    value >= 1 &&
    value <= 5999 &&
    value > (boundaries[index - 1] ?? 0) &&
    value < (boundaries[index + 1] ?? 6000)
  );
}
export function splitSuggestion(s: Scenario, index: number): number {
  const low = s.waveRules.boundaries[index - 1] ?? 0;
  const high = s.waveRules.boundaries[index] ?? 6000;
  const paces = [
    ...new Set(
      s.selectedTeamIds.map(
        (id) => resolveProfile(s, id).overall_mean_pace_seconds_per_mile,
      ),
    ),
  ]
    .filter((p) => p >= low && p < high)
    .sort((a, b) => a - b);
  const middle = Math.floor(paces.length / 2);
  const candidate =
    paces.length > 1
      ? Math.ceil((paces[middle - 1] + paces[middle]) / 2)
      : paces.length
        ? Math.floor(paces[0]) + 1
        : Math.round((low + high) / 2);
  return Math.max(
    Math.floor(low) + 1,
    Math.min(Math.ceil(high) - 1, candidate),
  );
}
export function removeWave(s: Scenario, index: number): Scenario {
  if (s.waves.length <= 1) return s;
  const removed = s.waves[index].id;
  const waves = s.waves.filter((_, i) => i !== index);
  const boundaryIndex = index === 0 ? 0 : index - 1;
  return syncAssignments({
    ...s,
    waves,
    waveRules: {
      ...s.waveRules,
      boundaries: s.waveRules.boundaries.filter((_, i) => i !== boundaryIndex),
    },
    assignments: Object.fromEntries(
      Object.entries(s.assignments).map(([id, wave]) => [
        id,
        wave === removed ? waves[Math.max(0, index - 1)].id : wave,
      ]),
    ),
  });
}
