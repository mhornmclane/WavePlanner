import { baseline, colors } from "./data";
import { syncAssignments } from "./waves";
import type { Scenario } from "./model";

export const presets = [
  {
    id: "status-quo",
    name: "Status quo",
    summary: "Everyone starts at 1am.",
    boundaries: [],
    starts: [3600],
  },
  {
    id: "three-waves",
    name: "3 waves · 1–3am",
    summary: "10:15 and slower: 1am · 9:30–under 10:15: 2am · Faster than 9:30: 3am.",
    boundaries: [570, 615],
    starts: [10800, 7200, 3600],
  },
  {
    id: "midnight-waves",
    name: "3 waves · midnight–2am",
    summary: "10:30 and slower: midnight · 9:30–under 10:30: 1am · Faster than 9:30: 2am.",
    boundaries: [570, 630],
    starts: [7200, 3600, 0],
  },
  {
    id: "two-waves",
    name: "2 waves · 1am / 3am",
    summary: "9:15 and slower: 1am · Faster than 9:15: 3am.",
    boundaries: [555],
    starts: [10800, 3600],
  },
] as const;

export type PresetId = (typeof presets)[number]["id"];

export function createPreset(id: PresetId, selectedTeamIds: string[]): Scenario {
  const preset = presets.find((p) => p.id === id)!;
  return syncAssignments({
    ...baseline(selectedTeamIds),
    name: preset.name,
    // Pace ranges are stored fastest first, displayed slowest first.
    waves: preset.starts.map((start, index) => {
      const number = preset.starts.length - index;
      return {
        id: `wave-${number}`,
        name: `Wave ${number}`,
        color: colors[number - 1],
        start,
      };
    }),
    waveRules: { mode: "pace", boundaries: [...preset.boundaries] },
  });
}
