import { course } from "./data";
import type { TeamResult, TimingRule, TimingRuleResult, TimingRuleType } from "./model";

export const ruleTypes: Record<TimingRuleType, string> = {
  "arrive-by": "Arrive by",
  "clear-by": "Clear exchange by",
  "depart-after": "Depart no earlier than",
};
export function exchangeName(index: number): string {
  return index === 0 ? course.legs[0].start_location : course.legs[index - 1].end_location;
}
export function supportsRule(exchange: number, type: TimingRuleType): boolean {
  return exchange === 0 ? type === "depart-after" : exchange === course.legs.length ? type !== "depart-after" : true;
}
export function openingTime(rules: TimingRule[], exchange: number): number {
  return Math.max(-Infinity, ...rules.filter(r => r.enabled && r.type === "depart-after" && r.exchange === exchange).map(r => r.time));
}
export function evaluateTimingRules(rules: TimingRule[], teams: TeamResult[]): TimingRuleResult[] {
  return rules.filter(r => r.enabled).map(rule => {
    const values = teams.map(team => {
      const incoming = team.legs[rule.exchange - 1];
      const outgoing = team.legs[rule.exchange];
      const actual = rule.type === "arrive-by" ? incoming.arrival
        : rule.type === "depart-after" ? outgoing.departure
        : Math.max(incoming.arrival, outgoing?.departure ?? -Infinity);
      // Attribute only the hold required by this opening, even when another rule opens later.
      const wait = rule.type === "depart-after"
        ? Math.max(0, Math.min(rule.time, actual) - (actual - outgoing.gateWait)) : 0;
      return { teamId: team.teamId, waveId: team.waveId, actual,
        lateness: rule.type === "depart-after" ? 0 : Math.max(0, actual - rule.time), wait };
    });
    return { ruleId: rule.id, status: !values.length ? "not-evaluated"
      : values.some(v => v.lateness > 0) ? "failed" : "passed", teams: values };
  });
}
export function ruleStatus(rule: TimingRule, result?: TimingRuleResult): string {
  if (!rule.enabled) return "Disabled";
  if (!result || result.status === "not-evaluated") return "Not evaluated";
  const late = result.teams.filter(t => t.lateness > 0).length;
  if (late) return `${late} ${late === 1 ? "team" : "teams"} late`;
  if (rule.type === "depart-after") {
    const held = result.teams.filter(t => t.wait > 0).length;
    return `${held} ${held === 1 ? "team" : "teams"} held until opening`;
  }
  return "All teams on time";
}
