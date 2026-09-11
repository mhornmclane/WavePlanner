export interface ClockTime {
  day: number;
  time_24h: string;
}
export interface CourseLeg {
  leg_number: number;
  distance_miles: number;
  start_location: string;
  end_location: string;
  cumulative_distance_miles: number;
  release_time: ClockTime;
  controlled_start_time?: ClockTime;
  notes: { challenge: number | null };
}
export interface Course {
  event: {
    total_legs: number;
    total_distance_miles: number;
    minimum_pace_seconds_per_mile: number;
  };
  legs: CourseLeg[];
}
export interface Profile {
  year: number;
  team: string;
  overall_mean_pace_seconds_per_mile: number;
  bin_mean_pace_seconds_per_mile: Record<string, number>;
}
export interface PaceBin {
  bin_id: string;
  first_leg: number;
  last_leg: number;
}
export interface Wave {
  id: string;
  name: string;
  color: string;
  start: number;
}
export interface PaceSegment {
  startLeg: number;
  pace: number;
}
export interface Scenario {
  schemaVersion: 1;
  sources: { course: string; historical: string };
  name: string;
  selectedTeamIds: string[];
  waves: Wave[];
  assignments: Record<string, string>;
  release: {
    mode: "published" | "generated";
    anchor: number;
    segments: PaceSegment[];
  };
  challenges: { monument: number; lighthouse: number };
  buffers: { before: number; after: number };
}
export interface LegTiming {
  teamId: string;
  leg: number;
  departure: number;
  arrival: number;
  duration: number;
  releaseTime: number;
  releaseUsed: boolean;
  challengeWait: number;
  gateWait: number;
  waitStart: number;
}
export interface TeamResult {
  teamId: string;
  waveId: string;
  legs: LegTiming[];
  movingTime: number;
  finish: number;
  allComplete: number;
  peakActive: number;
}
export interface ExchangeSummary {
  index: number;
  name: string;
  miles: number;
  earliestArrival: number | null;
  latestArrival: number | null;
  earliestDeparture: number | null;
  latestActivity: number | null;
  coverageStart: number | null;
  coverageEnd: number | null;
  coverage: number;
}
export interface Simulation {
  teams: TeamResult[];
  exchanges: ExchangeSummary[];
  releases: number[];
  finishSpread: number;
  lastOffCourse: number | null;
  exchangeHours: number;
  releaseCount: number;
  peakActive: number;
}
