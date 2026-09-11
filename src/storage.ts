import { profileById, sources, bins, worstCaseIds, defaultWorstCaseTeams, defaultTimingRules, course } from "./data";
import type { Scenario, Simulation } from "./model";
import { clock } from "./format";
import { syncAssignments } from "./waves";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown, min = 0, max = 30 * 86400 - 1): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const label = (v: unknown): v is string =>
  typeof v === "string" && !!v.trim() && v.length <= 120;
export function validateScenario(value: unknown): Scenario {
  if (
    !object(value) ||
    ![1, 2, 3, 4, 5].includes(Number(value.schemaVersion)) ||
    typeof value.schemaVersion !== "number"
  )
    throw new Error(
      "Unsupported configuration version. Expected version 1, 2, 3, 4, or 5.",
    );
  if (value.schemaVersion === 1) {
    value = {
      ...value,
      schemaVersion: 2,
      waveRules: { mode: "manual", boundaries: [] },
      release: object(value.release)
        ? { ...value.release, visualPaces: [625, 625, 625, 625, 625] }
        : value.release,
    };
  }
  if (!object(value)) throw new Error("Invalid configuration.");
  if (value.schemaVersion === 2) {
    value = { ...value, schemaVersion: 3, worstCaseTeams: defaultWorstCaseTeams() };
  }
  if (!object(value)) throw new Error("Invalid configuration.");
  if (value.schemaVersion === 3) {
    value = { ...value, schemaVersion: 4, timingRules: defaultTimingRules() };
  }
  if (!object(value)) throw new Error("Invalid configuration.");
  if (value.schemaVersion === 4) {
    value = { ...value, schemaVersion: 5, fastWaveReleases: { enabled: true, fromExchange: 35 } };
  }
  if (!object(value)) throw new Error("Invalid configuration.");
  const fastReleases = value.fastWaveReleases;
  if (!object(fastReleases) || typeof fastReleases.enabled !== "boolean" ||
      !Number.isInteger(fastReleases.fromExchange) || !finite(fastReleases.fromExchange, 0, course.legs.length - 1))
    throw new Error("Fast-wave releases need an enabled setting and a starting exchange from 0 to 70.");
  const timing = value.timingRules;
  if (!Array.isArray(timing) || timing.some(r => !object(r) || !label(r.id) ||
      typeof r.enabled !== "boolean" || !Number.isInteger(r.exchange) ||
      !finite(r.exchange, 0, course.legs.length) ||
      !["arrive-by", "clear-by", "depart-after"].includes(String(r.type)) ||
      (r.exchange === 0 && r.type !== "depart-after") ||
      (r.exchange === course.legs.length && r.type === "depart-after") ||
      !finite(r.time)) || new Set(timing.map(r => r.id)).size !== timing.length)
    throw new Error("Timing rules need unique IDs, a valid exchange and rule type, and a day/time within Days 1–30.");
  const custom = value.worstCaseTeams;
  if (!object(custom) || Object.keys(custom).length !== 2 ||
      (["fastest", "slowest"] as const).some(kind => {
        const t = custom[kind];
        return !object(t) || !["flat", "bins"].includes(String(t.mode)) ||
          !finite(t.flatPace, 1, 5999) || !object(t.binPaces) ||
          Object.keys(t.binPaces).length !== bins.length ||
          bins.some(b => !finite((t.binPaces as Record<string, unknown>)[b.bin_id], 1, 5999));
      })) throw new Error("Worst-case teams need a valid mode, flat pace, and five bin paces between 0:01 and 99:59.");

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
    ids.some((id) => typeof id !== "string" || (!profileById.has(id) && !Object.values(worstCaseIds).some(v => v === id))) ||
    new Set(ids).size !== ids.length
  )
    throw new Error(
      "Selected teams must be unique historical or configured worst-case teams.",
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
        !finite(w.start, -30 * 86400) ||
        typeof w.color !== "string" ||
        !/^#[0-9a-f]{6}$/i.test(w.color),
    ) ||
    new Set(waves.map((w) => w.id)).size !== waves.length
  )
    throw new Error(
      "Each wave needs a unique ID, name, color, and a valid numeric start offset (within 30 days of Day 1 midnight).",
    );
  const assignments = value.assignments;
  const rules = value.waveRules;
  if (
    !object(rules) ||
    typeof rules.mode !== "string" ||
    !["manual", "pace"].includes(rules.mode) ||
    !Array.isArray(rules.boundaries) ||
    (rules.mode === "pace" && rules.boundaries.length !== waves.length - 1) ||
    (rules.mode === "manual" && rules.boundaries.length !== 0) ||
    rules.boundaries.some(
      (b, i, all) => !finite(b, 1, 5999) || (i > 0 && b <= all[i - 1]),
    )
  )
    throw new Error(
      "Wave pace boundaries must be increasing, shared by adjacent waves, and cover the field.",
    );
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
    typeof r.mode !== "string" ||
    !["published", "generated", "visual"].includes(r.mode) ||
    !Array.isArray(r.segments) ||
    r.segments.some((p) => !object(p)) ||
    !Array.isArray(r.visualPaces)
  )
    throw new Error(
      "The release schedule needs a valid mode and pace setting lists.",
    );
  if (r.mode !== "published" && !finite(r.anchor))
    throw new Error("The release schedule needs a valid time anchor.");
  if (
    r.mode === "visual" &&
    (r.visualPaces.length !== 5 ||
      r.visualPaces.some((p) => !finite(p, 1, 5999)))
  )
    throw new Error(
      "Visual pace needs exactly five positive m:ss pace levels.",
    );
  if (
    r.mode === "generated" &&
    (!r.segments.length ||
      r.segments.length > 71 ||
      r.segments.some(
        (p) =>
          !object(p) ||
          !Number.isInteger(p.startLeg) ||
          !finite(p.startLeg, 1, 71) ||
          !finite(p.pace, 1, 5999),
      ) ||
      !r.segments.some((p) => p.startLeg === 1) ||
      new Set(r.segments.map((p) => p.startLeg)).size !== r.segments.length)
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
  if (result.release.mode === "generated")
    result.release.segments.sort((a, b) => a.startLeg - b.startLeg);
  return syncAssignments(result);
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
      "Latest departure",
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
      clock(e.latestDeparture),
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
