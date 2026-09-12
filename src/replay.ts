import type { Simulation } from "./model";

export interface ReplayMarker {
  teamId: string;
  waveId: string;
  time: number;
  ahead: number;
  release?: number;
  late?: number;
  overlaps?: boolean;
}
export interface ReplayFrame {
  index: number;
  name: string;
  first: number | null;
  last: number | null;
  spread: number;
  markers: ReplayMarker[];
  years?: { year: number; first: number; last: number; spread: number }[];
}
export interface SpreadReplayData {
  frames: ReplayFrame[];
  maxSpread: number;
  axisSeconds: number;
}

/** Exchange comparisons, not samples of a shared race clock. */
export function buildReplay(result: Simulation): SpreadReplayData {
  const frames = result.exchanges.map((exchange): ReplayFrame => {
    const times = result.teams.map((team) => ({
      teamId: team.teamId,
      waveId: team.waveId,
      time:
        exchange.index === 0
          ? team.legs[0].departure
          : team.legs[exchange.index - 1].arrival,
    }));
    const first = times.length ? Math.min(...times.map((t) => t.time)) : null;
    const last = times.length ? Math.max(...times.map((t) => t.time)) : null;
    return {
      index: exchange.index,
      name: exchange.name,
      first,
      last,
      spread: first === null || last === null ? 0 : last - first,
      markers: times.map((t) => ({ ...t, ahead: last! - t.time })),
    };
  });
  const maxSpread = Math.max(0, ...frames.map((f) => f.spread));
  return { frames, maxSpread, axisSeconds: maxSpread || 3600 };
}
