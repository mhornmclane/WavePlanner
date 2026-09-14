import { resolveSolvers } from "./solver";
import { baseline, colors, course } from "./data";
import { syncAssignments } from "./waves";
import type { Scenario } from "./model";

// Preserve the exact analyzed reference, including fractional seconds.
const referenceFinish = 134401.25;
export const presets = [
  { id: "status-quo", name: "Editable baseline", boundaries: [], starts: [3600],
    targetFinish: referenceFinish, releasePace: 625,
    summary: "One start at 1 AM with generated releases. The exact published timetable remains available in the baseline comparison." },
  { id: "two-waves", name: "Simple two waves", boundaries: [585], starts: [10800, 3600],
    targetFinish: referenceFinish, releasePace: 625,
    summary: "Two starts capture most of the three-wave coverage savings with fewer launches to operate." },
  { id: "three-waves", name: "Efficient three waves", boundaries: [555, 600], starts: [12600, 9000, 3600],
    targetFinish: referenceFinish, releasePace: 625,
    summary: "Separate the fastest teams to reduce exchange coverage. Smaller fields may have very small later waves." },
  { id: "tight-finish", name: "Tighter group finish", boundaries: [555, 600], starts: [14400, 9000, 3600],
    targetFinish: referenceFinish, releasePace: 625,
    summary: "A later fastest-wave start narrows the finish window, with slightly more exchange coverage than efficient three waves." },
  { id: "earlier-finish", name: "Earlier group finish", boundaries: [555, 600], starts: [12600, 7200, 3600],
    targetFinish: referenceFinish - 3600, releasePace: 600,
    summary: "Target 12:20 PM with less exchange coverage and more release-assisted departures." },
  { id: "eleven-am", name: "11 AM finish target", boundaries: [555, 600], starts: [12600, 7200, 3600],
    targetFinish: 35 * 3600, releasePace: 580,
    summary: "Target 11 AM with greater release dependence. Each wave’s release pace is adjusted to accommodate its launch time." },
  { id: "earlier-launch", name: "Earlier launch, fewer releases", boundaries: [585, 630], starts: [7200, 0, -3600],
    targetFinish: referenceFinish, releasePace: 660,
    summary: "Start the slowest wave Thursday at 11 PM to use fewer releases, with a wider finish window." },
] as const;
export type PresetId = (typeof presets)[number]["id"];

export function applyPreset(id: PresetId, currentScenario: Scenario): Scenario {
  const preset = presets.find(p => p.id === id)!;
  const defaults = baseline(currentScenario.selectedTeamIds);
  return syncAssignments(resolveSolvers({
    ...structuredClone(currentScenario),
    name: preset.name,
    timingRules: defaults.timingRules,
    challenges: defaults.challenges,
    fastWaveReleases: defaults.fastWaveReleases,
    // Pace ranges are stored fastest first, displayed slowest first.
    waves: preset.starts.map((start, index) => {
      const number = preset.starts.length - index;
      // Round down to a whole second/mile so the latest-start estimate never precedes launch.
      const available = preset.targetFinish - start - defaults.challenges.monument - defaults.challenges.lighthouse;
      const pace = Math.min(preset.releasePace, Math.floor(available / course.event.total_distance_miles));
      return { id: `wave-${number}`, name: `Wave ${number}`, color: colors[number - 1], start, solver: "finish", release: { targetFinish: preset.targetFinish, pace } };
    }),
    waveRules: { mode: "pace", boundaries: [...preset.boundaries] },
  }));
}
export function createPreset(id: PresetId, selectedTeamIds: string[], worstCaseTeams?: Scenario["worstCaseTeams"]): Scenario {
  return applyPreset(id, { ...baseline(selectedTeamIds), ...(worstCaseTeams ? { worstCaseTeams } : {}) });
}
