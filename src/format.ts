import { ORIGIN } from "./data";
export function pace(seconds: number): string {
  const n = Math.round(seconds);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}
export function duration(seconds: number): string {
  const minutes = Math.round(Math.abs(seconds) / 60);
  return `${seconds < 0 ? "−" : ""}${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}
export function clock(seconds: number | null, rounding: "nearest" | "down" | "up" = "nearest"): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const round = rounding === "down" ? Math.floor : rounding === "up" ? Math.ceil : Math.round;
  const mins = round(seconds / 60);
  const day = Math.floor(mins / 1440);
  const within = ((mins % 1440) + 1440) % 1440;
  return `${weekday(day)} ${Math.floor(within / 60) % 12 || 12}:${String(within % 60).padStart(2, "0")} ${within < 720 ? "AM" : "PM"}`;
}
export const elapsed = (seconds: number) =>
  `${((seconds - ORIGIN) / 3600).toFixed(1)}h`;
export const delta = (seconds: number) =>
  Math.abs(seconds) < 0.5
    ? "—"
    : `${seconds > 0 ? "+" : "−"}${duration(Math.abs(seconds))}`;
export function parsePace(value: string): number | null {
  if (!/^\d{1,2}:[0-5]\d$/.test(value)) return null;
  const [m, s] = value.split(":").map(Number);
  return m * 60 + s > 0 ? m * 60 + s : null;
}

export function weekday(day: number): string {
  const names = ["Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
  const week = Math.floor((day + 1) / 7);
  return names[((day % 7) + 7) % 7] + (week ? ` (week ${week > 0 ? "+" : ""}${week})` : "");
}
