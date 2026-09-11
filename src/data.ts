import courseJson from "./data/course.json" with { type: "json" };
import historicalJson from "./data/historical.json" with { type: "json" };
import type { Course, PaceBin, Profile, Scenario } from "./model";

export const course: Course = courseJson;
export const profiles: Profile[] = historicalJson.records;
export const bins: PaceBin[] = historicalJson.course.bins;
export const teamId = (p: Profile) => `${p.year}::${p.team}`;
export const profileById = new Map(profiles.map((p) => [teamId(p), p]));
export const ORIGIN = 3600; // Day 1, 01:00, shared by every scenario.
export const sources = {
  course: `course-matrix:${courseJson._meta.version}`,
  historical: `pace-bins:${historicalJson.source.sha256}`,
};
export const colors = [
  "#277b71",
  "#d27b35",
  "#596bbe",
  "#a04e7d",
  "#63833b",
  "#397eab",
];
export function baseline(selectedTeamIds = profiles.map(teamId)): Scenario {
  return {
    schemaVersion: 2,
    sources: { ...sources },
    name: "2026 baseline",
    selectedTeamIds: [...selectedTeamIds],
    waves: [
      { id: "wave-1", name: "Main start", color: colors[0], start: ORIGIN },
    ],
    assignments: Object.fromEntries(
      selectedTeamIds.map((id) => [id, "wave-1"]),
    ),
    waveRules: { mode: "manual", boundaries: [] },
    release: {
      mode: "published",
      anchor: ORIGIN,
      segments: [{ startLeg: 1, pace: 625 }],
      visualPaces: [625, 625, 625, 625, 625],
    },
    challenges: { monument: 960, lighthouse: 1260 },
    buffers: { before: 0, after: 0 },
  };
}
export function initialScenario(): Scenario {
  return {
    ...baseline(),
    name: "My race configuration",
    waveRules: { mode: "pace", boundaries: [] },
  };
}
