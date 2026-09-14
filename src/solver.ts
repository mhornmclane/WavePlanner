import { course } from "./data";
import type { Scenario, Wave } from "./model";

export const SOLVER_TOLERANCE = 1e-6;
export const solverModes = ["none", "start", "finish", "pace"] as const;
const validTime = (n: number) => Number.isFinite(n) && n >= -30 * 86400 && n <= 30 * 86400 - 1;
const validPace = (n: number) => Number.isFinite(n) && n >= 1 && n <= 5999;

export function solveWave(s: Pick<Scenario, "challenges">, wave: Wave): Wave {
  const allowance = s.challenges.monument + s.challenges.lighthouse;
  const distance = course.event.total_distance_miles;
  switch (wave.solver) {
    case "start": return { ...wave, start: wave.release.targetFinish - distance * wave.release.pace - allowance };
    case "finish": return { ...wave, release: { ...wave.release, targetFinish: wave.start + distance * wave.release.pace + allowance } };
    case "pace": return { ...wave, release: { ...wave.release, pace: (wave.release.targetFinish - wave.start - allowance) / distance } };
    default: return wave;
  }
}

export function resolveSolvers(s: Scenario): Scenario {
  return { ...s, waves: s.waves.map(w => solveWave(s, w)) };
}

export function solverError(s: Pick<Scenario, "challenges">, wave: Wave): string | null {
  if (wave.solver === "none") return null;
  if ((wave.solver !== "start" && !validTime(wave.start)) ||
      (wave.solver !== "finish" && !validTime(wave.release.targetFinish)) ||
      (wave.solver !== "pace" && !validPace(wave.release.pace)) ||
      Object.values(s.challenges).some(n => !Number.isFinite(n) || n < 0 || n > 86400))
    return `${wave.name}: enter valid inputs and challenge allowances to calculate ${wave.solver}.`;
  const solved = solveWave(s, wave);
  if (!validPace(solved.release.pace)) return `${wave.name}: calculated pace must be between 0:01 and 99:59 per mile. Increase the time available between start and finish, or reduce challenge allowances.`;
  if (!validTime(solved.start) || !validTime(solved.release.targetFinish))
    return `${wave.name}: calculated ${wave.solver} must be within 30 days of event Friday. Adjust the other inputs.`;
  return null;
}
