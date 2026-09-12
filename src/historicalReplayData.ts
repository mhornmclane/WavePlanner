import raw from "./data/Ruck4HIT_replay_paces.json";
import { baseline, course, profileById } from "./data";
import { simulate } from "./engine";
import type { Simulation } from "./model";
import { buildReplay, type SpreadReplayData } from "./replay";

export interface HistoricalReplayRecord {
  year: number;
  team: string;
  legs: Record<string, number>;
}
export function validateReplayRecords(input: unknown): HistoricalReplayRecord[] {
  const data = input as { pace_unit?: unknown; records?: HistoricalReplayRecord[] } | null;
  if (data?.pace_unit !== "seconds_per_mile" || !Array.isArray(data.records) || !data.records.length)
    throw new Error("Historical replay requires records in seconds per mile.");
  const seen = new Set<string>();
  for (const record of data.records) {
    const id = `${record?.year}::${record?.team}`;
    if (!record || !Number.isInteger(record.year) || typeof record.team !== "string" || !profileById.has(id) || seen.has(id))
      throw new Error(`Invalid or duplicate historical replay team: ${id}.`);
    seen.add(id);
    if (!record.legs || Object.keys(record.legs).length !== course.legs.length || course.legs.some(leg =>
      !Number.isFinite(record.legs[leg.leg_number]) || record.legs[leg.leg_number] <= 0))
      throw new Error(`Historical replay requires all 71 positive leg paces for ${id}.`);
  }
  return data.records;
}
export const replayRecords = validateReplayRecords(raw);
export const replayYears = [...new Set(replayRecords.map(r => r.year))].sort();
export const yearColors: Record<number, string> = { 2024: "#277b71", 2025: "#d27b35", 2026: "#596bbe" };
const paceByTeam = new Map(replayRecords.map(r => [`${r.year}::${r.team}`, r.legs]));
export const historicalScenario = baseline([...paceByTeam.keys()]);
// Independent immutable baseline: never derived from editable simulation state.
export const historicalResult = simulate(historicalScenario, true, (id, leg) => paceByTeam.get(id)![leg]);

export function buildHistoricalReplay(result: Simulation): SpreadReplayData {
  const data = buildReplay(result);
  const teamById = new Map(result.teams.map(t => [t.teamId, t]));
  for (const frame of data.frames) {
    const years = [...new Set(frame.markers.map(m => Number(m.teamId.split("::")[0])))].sort();
    frame.years = years.map(year => {
      const markers = frame.markers.filter(m => Number(m.teamId.split("::")[0]) === year);
      const first = Math.min(...markers.map(m => m.time));
      const last = Math.max(...markers.map(m => m.time));
      for (const marker of markers) {
        marker.ahead = last - marker.time;
        if (frame.index > 0 && frame.index < result.releases.length) {
          marker.release = result.releases[frame.index];
          marker.late = Math.max(0, marker.time - marker.release);
          marker.overlaps = teamById.get(marker.teamId)!.legs[frame.index].departure < marker.time;
        }
      }
      return { year, first, last, spread: last - first };
    });
    frame.spread = Math.max(0, ...frame.years.map(y => y.spread));
  }
  data.maxSpread = Math.max(0, ...data.frames.map(f => f.spread));
  data.axisSeconds = data.maxSpread || 3600;
  return data;
}
