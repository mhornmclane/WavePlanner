import type { Simulation } from "./model";

/** Arrival ranges by exchange, independent of chart focus and staffing buffers. */
export function arrivalEnvelope(result: Simulation) {
  if (!result.teams.length) return [];
  return Array.from({ length: result.teams[0].legs.length + 1 }, (_, index) => {
    const times = result.teams.map(t => index === 0 ? t.legs[0].departure : t.legs[index - 1].arrival);
    return { index, earliest: Math.min(...times), latest: Math.max(...times) };
  });
}
