import { profileById, sources } from "./data";
import type { Scenario, Simulation } from "./model";
import { clock } from "./format";

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown, min = 0, max = 30 * 86400 - 1): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const label = (v: unknown): v is string =>
  typeof v === "string" && !!v.trim() && v.length <= 120;

export function validateScenario(value: unknown): Scenario {
  if (!object(value) || value.schemaVersion !== 1)
    throw new Error("Unsupported configuration version. Expected version 1.");
  if (
    !object(value.sources) ||
    value.sources.course !== sources.course ||
    value.sources.historical !== sources.historical
  )
    throw new Error(
      "This configuration uses different course or historical data.",
    );
  if (!label(value.name))
    throw new Error("Enter a configuration name (1–120 characters).");
  const ids = value.selectedTeamIds;
  if (
    !Array.isArray(ids) ||
    ids.some((id) => typeof id !== "string" || !profileById.has(id)) ||
    new Set(ids).size !== ids.length
  )
    throw new Error(
      "Selected teams must be unique records from the supplied historical field.",
    );
  const waves = value.waves;
  if (
    !Array.isArray(waves) ||
    !waves.length ||
    waves.length > 51 ||
    waves.some(
      (w) =>
        !object(w) ||
        !label(w.id) ||
        !label(w.name) ||
        !finite(w.start) ||
        typeof w.color !== "string" ||
        !/^#[0-9a-f]{6}$/i.test(w.color),
    ) ||
    new Set(waves.map((w) => w.id)).size !== waves.length
  )
    throw new Error(
      "Each wave needs a unique ID, name, color, and a valid Day/time start.",
    );
  const assignments = value.assignments;
  if (
    !object(assignments) ||
    ids.some(
      (id) =>
        !Object.hasOwn(assignments, id) ||
        !waves.some((w) => w.id === assignments[id]),
    ) ||
    Object.keys(assignments).some((id) => !ids.includes(id))
  )
    throw new Error("Assign every selected team to exactly one existing wave.");
  const r = value.release;
  if (
    !object(r) ||
    !["published", "generated"].includes(String(r.mode)) ||
    !finite(r.anchor) ||
    !Array.isArray(r.segments) ||
    !r.segments.length ||
    r.segments.length > 71
  )
    throw new Error(
      "The release schedule needs a valid mode, anchor, and pace segments.",
    );
  if (
    r.segments.some(
      (p) =>
        !object(p) ||
        !Number.isInteger(p.startLeg) ||
        !finite(p.startLeg, 1, 71) ||
        !finite(p.pace, 1, 5999),
    ) ||
    !r.segments.some((p) => p.startLeg === 1) ||
    new Set(r.segments.map((p) => p.startLeg)).size !== r.segments.length
  )
    throw new Error(
      "Pace segments must have unique starting legs 1–71, include leg 1, and use a positive m:ss pace.",
    );
  if (
    !object(value.challenges) ||
    !finite(value.challenges.monument, 0, 86400) ||
    !finite(value.challenges.lighthouse, 0, 86400)
  )
    throw new Error("Challenge durations must be between 0 and 1,440 minutes.");
  if (
    !object(value.buffers) ||
    !finite(value.buffers.before, 0, 86400) ||
    !finite(value.buffers.after, 0, 86400)
  )
    throw new Error("Staffing buffers must be between 0 and 1,440 minutes.");
  const result = structuredClone(value) as unknown as Scenario;
  result.release.segments.sort((a, b) => a.startLeg - b.startLeg);
  return result;
}
export function serializeScenario(s: Scenario): string {
  return JSON.stringify(validateScenario(s), null, 2);
}
export function parseScenario(text: string): Scenario {
  if (text.length > 1_000_000)
    throw new Error("Configuration file is too large (maximum 1 MB).");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  return validateScenario(value);
}
export interface SavedScenario {
  id: string;
  updatedAt: string;
  scenario: Scenario;
}
export const STORAGE_KEY = "ruck4hit-scenarios-v1";
export function readSaves(storage: Pick<Storage, "getItem">): SavedScenario[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const values: unknown = JSON.parse(raw);
  if (!Array.isArray(values))
    throw new Error(
      "Saved configurations are not readable. Export your current configuration as a backup.",
    );
  return values.map((v) => {
    if (!object(v) || !label(v.id) || typeof v.updatedAt !== "string")
      throw new Error("A saved configuration has invalid metadata.");
    return {
      id: v.id,
      updatedAt: v.updatedAt,
      scenario: validateScenario(v.scenario),
    };
  });
}
export function writeSaves(
  storage: Pick<Storage, "setItem">,
  saves: SavedScenario[],
): void {
  for (const save of saves) validateScenario(save.scenario);
  storage.setItem(STORAGE_KEY, JSON.stringify(saves));
}
export function download(name: string, body: string, type: string): void {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function staffingCsv(
  result: Simulation,
  comparison: Simulation,
): string {
  const rows: (string | number | null)[][] = [
    [
      "Exchange occurrence",
      "Location",
      "Mile",
      "Earliest arrival",
      "Latest arrival",
      "Earliest departure",
      "Latest activity",
      "Coverage begins",
      "Coverage ends",
      "Coverage hours",
      "Baseline coverage begins",
      "Baseline coverage ends",
      "Baseline coverage hours",
      "Coverage difference hours",
    ],
  ];
  result.exchanges.forEach((e, i) =>
    rows.push([
      e.index,
      e.name,
      e.miles,
      clock(e.earliestArrival),
      clock(e.latestArrival),
      clock(e.earliestDeparture),
      clock(e.latestActivity),
      clock(e.coverageStart, "down"),
      clock(e.coverageEnd, "up"),
      (e.coverage / 3600).toFixed(4),
      clock(comparison.exchanges[i].coverageStart, "down"),
      clock(comparison.exchanges[i].coverageEnd, "up"),
      (comparison.exchanges[i].coverage / 3600).toFixed(4),
      ((e.coverage - comparison.exchanges[i].coverage) / 3600).toFixed(4),
    ]),
  );
  return rows
    .map((row) =>
      row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","),
    )
    .join("\r\n");
}
