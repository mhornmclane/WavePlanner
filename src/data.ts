import courseJson from "./data/course.json" with { type: "json" };
import historicalJson from "./data/historical.json" with { type: "json" };
import type { Course, PaceBin, Profile, Scenario, WorstCaseTeam } from "./model";

export const course: Course = courseJson;
export const profiles: Profile[] = historicalJson.records;
export const bins: PaceBin[] = historicalJson.course.bins;
export const teamId = (p: Profile) => `${p.year}::${p.team}`;
export const profileById = new Map(profiles.map((p) => [teamId(p), p]));
export const ORIGIN = 3600; // Friday 1:00 AM: shared elapsed-chart origin.
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
    schemaVersion: 6,
    fieldYear: "all",
    fastWaveReleases: { enabled: true, fromExchange: 35 },
    timingRules: defaultTimingRules(),
    worstCaseTeams: defaultWorstCaseTeams(),
    sources: { ...sources },
    name: "2026 baseline",
    selectedTeamIds: [...selectedTeamIds],
    waves: [
      { id: "wave-1", name: "Wave 1", color: colors[0], start: ORIGIN },
    ],
    assignments: Object.fromEntries(
      selectedTeamIds.map((id) => [id, "wave-1"]),
    ),
    waveRules: { mode: "pace", boundaries: [] },
    release: { targetFinish: defaultFinishTarget(), pace: 625 },
    challenges: { monument: 960, lighthouse: 1260 },
    buffers: { before: 0, after: 0 },
  };
}
export function initialScenario(): Scenario {
  return {
    ...baseline(fieldIds(2025)),
    fieldYear: 2025,
    name: "My race configuration",
    waveRules: { mode: "pace", boundaries: [] },
  };
}

export const worstCaseIds = { fastest: "synthetic::fastest", slowest: "synthetic::slowest" } as const;
export const worstCaseNames = { fastest: "Worst-case fastest", slowest: "Worst-case slowest" } as const;
export type WorstCaseKind = keyof typeof worstCaseIds;
export const binDistances = Object.fromEntries(bins.map(b => [b.bin_id,
  course.legs.filter(l => l.leg_number >= b.first_leg && l.leg_number <= b.last_leg)
    .reduce((sum, l) => sum + l.distance_miles, 0)]));
export function weightedPace(paces: Record<string, number>): number {
  return bins.reduce((sum, b) => sum + paces[b.bin_id] * binDistances[b.bin_id], 0)
    / Object.values(binDistances).reduce((sum, d) => sum + d, 0);
}
export function worstCaseSource(kind: WorstCaseKind): Profile {
  return profiles.reduce((best, p) => (kind === "fastest"
    ? p.overall_mean_pace_seconds_per_mile < best.overall_mean_pace_seconds_per_mile
    : p.overall_mean_pace_seconds_per_mile > best.overall_mean_pace_seconds_per_mile) ? p : best);
}
export function validTeamPace(p: number): boolean {
  return Number.isFinite(p) && p >= 1 && p <= 5999;
}
export function shiftBinPaces(paces: Record<string, number>, target: number): Record<string, number> {
  const delta = target - weightedPace(paces);
  const next = Object.fromEntries(bins.map(b => [b.bin_id, paces[b.bin_id] + delta]));
  if (!validTeamPace(target) || Object.values(next).some(p => !validTeamPace(p)))
    throw new Error("Every resulting bin pace must be between 0:01 and 99:59 per mile.");
  return next;
}
export function defaultWorstCaseTeam(kind: WorstCaseKind): WorstCaseTeam {
  const source = worstCaseSource(kind);
  const target = source.overall_mean_pace_seconds_per_mile + (kind === "fastest" ? -30 : 30);
  return { mode: "bins", flatPace: target, binPaces: shiftBinPaces(source.bin_mean_pace_seconds_per_mile, target) };
}
export function defaultWorstCaseTeams(): Scenario["worstCaseTeams"] {
  return { fastest: defaultWorstCaseTeam("fastest"), slowest: defaultWorstCaseTeam("slowest") };
}
export function resolveProfile(s: Scenario, id: string): Profile {
  const kind = (Object.keys(worstCaseIds) as WorstCaseKind[]).find(k => worstCaseIds[k] === id);
  if (!kind) {
    const historical = profileById.get(id);
    if (!historical) throw new Error(`Unknown team: ${id}`);
    return historical;
  }
  const definition = s.worstCaseTeams[kind];
  return { team: worstCaseNames[kind], year: "Hypothetical",
    overall_mean_pace_seconds_per_mile: definition.mode === "flat" ? definition.flatPace : weightedPace(definition.binPaces),
    bin_mean_pace_seconds_per_mile: definition.mode === "flat"
      ? Object.fromEntries(bins.map(b => [b.bin_id, definition.flatPace])) : definition.binPaces };
}

export function defaultTimingRules(): Scenario["timingRules"] {
  return [
    { id: "monument-deadline", enabled: true, exchange: 35, type: "clear-by", time: 19 * 3600 },
    { id: "jbcc-opening", enabled: true, exchange: 69, type: "depart-after", time: 86400 + 6 * 3600 },
  ];
}

export function defaultFinishTarget(): number {
  const last = course.legs.at(-1)!;
  const [h, m] = last.release_time.time_24h.split(":").map(Number);
  return (last.release_time.day - 1) * 86400 + h * 3600 + m * 60 + last.distance_miles * 625;
}
export const fieldYears = [...new Set(profiles.map(p => p.year))].sort();
export function fieldIds(year: Scenario["fieldYear"]): string[] {
  return profiles.filter(p => year === "all" || p.year === year).map(teamId);
}
