import { describe, expect, it } from "vitest";
import { baseline, course, worstCaseIds } from "../src/data";
import { simulate } from "../src/engine";
import { evaluateTimingRules, openingTime, supportsRule } from "../src/timingRules";
import { validateScenario, serializeScenario, parseScenario } from "../src/storage";
import { applyPreset } from "../src/presets";
import type { TimingRule } from "../src/model";

const rule = (patch: Partial<TimingRule> = {}): TimingRule => ({ id: "test", enabled: true, exchange: 35, type: "clear-by", time: 68400, ...patch });
function fastScenario() {
  const s = baseline([worstCaseIds.fastest]);
  s.worstCaseTeams.fastest.mode = "flat";
  s.worstCaseTeams.fastest.flatPace = 300;
  return s;
}
describe("timing rules", () => {
  it("defaults to the monument deadline and JBCC opening", () => {
    const s = baseline();
    expect(s.timingRules.map(r => [r.exchange, r.type, r.time])).toEqual([[35, "clear-by", 68400], [69, "depart-after", 108000]]);
    const result = simulate(fastScenario());
    expect(result.teams[0].legs[69].departure).toBe(108000);
    expect(result.teams[0].legs[69].gateWait).toBeGreaterThan(0);
  });
  it("passes exactly at a deadline and flags fractional lateness without altering the race", () => {
    const s = fastScenario(), original = simulate(s);
    const time = original.teams[0].legs[34].arrival;
    s.timingRules.push(rule({ type: "arrive-by", time }));
    expect(simulate(s).timingRules.at(-1)?.status).toBe("passed");
    s.timingRules.at(-1)!.time -= 0.5;
    const next = simulate(s);
    expect(next.timingRules.at(-1)?.teams[0].lateness).toBe(0.5);
    expect(next.teams).toEqual(original.teams);
  });
  it("clearance catches incoming runners arriving after outgoing runners were released", () => {
    const s = baseline([worstCaseIds.slowest]);
    const team = simulate(s).teams[0];
    const exchange = team.legs.findIndex((l, i) => i > 0 && l.departure < team.legs[i - 1].arrival);
    expect(exchange).toBeGreaterThan(0);
    const deadline = (team.legs[exchange].departure + team.legs[exchange - 1].arrival) / 2;
    const result = evaluateTimingRules([rule({ exchange, time: deadline })], [team])[0];
    expect(result.status).toBe("failed");
    expect(result.teams[0].actual).toBe(team.legs[exchange - 1].arrival);
  });
  it("uses the later opening, propagates holds, and permits removing the fixed JBCC hold", () => {
    const s = fastScenario(), original = simulate(s);
    s.timingRules.push(rule({ type: "depart-after", exchange: 69, time: 120000 }));
    const delayed = simulate(s);
    expect(delayed.teams[0].legs[69].departure).toBe(120000);
    expect(delayed.teams[0].legs[70].departure).toBeGreaterThan(original.teams[0].legs[70].departure);
    expect(delayed.teams[0].movingTime).toBe(original.teams[0].movingTime);
    s.timingRules = [];
    expect(simulate(s).teams[0].legs[69].departure).toBeLessThan(108000);
    s.timingRules = [rule({ type: "depart-after", exchange: 69, time: 120000, enabled: false })];
    expect(simulate(s).teams[0].legs[69].gateWait).toBe(0);
    expect(simulate(s).timingRules).toEqual([]);
  });
  it("attributes waiting to each opening only when it requires a hold", () => {
    const s = fastScenario();
    s.timingRules = [rule({ type: "depart-after", exchange: 0, time: 7200 }), rule({ id: "later", type: "depart-after", exchange: 0, time: 10800 })];
    const result = simulate(s);
    expect(result.teams[0].legs[0].departure).toBe(10800);
    expect(result.timingRules.map(r => r.teams[0].wait)).toEqual([3600, 7200]);
    expect(openingTime(s.timingRules, 1)).toBe(-Infinity);
  });
  it("uses occurrence IDs and supports finish arrival and clearance", () => {
    const s = fastScenario();
    const result = simulate(s);
    const time = result.teams[0].finish;
    const rules = [rule({ exchange: 71, type: "arrive-by", time }), rule({ id: "clear", exchange: 71, time })];
    expect(evaluateTimingRules(rules, result.teams).map(r => r.status)).toEqual(["passed", "passed"]);
    expect(supportsRule(0, "clear-by")).toBe(false);
    expect(supportsRule(71, "depart-after")).toBe(false);
    expect(openingTime([rule({ exchange: 35, type: "depart-after", time: 80000 })], 36)).toBe(-Infinity);
  });
  it("reports an empty field as not evaluated", () => {
    expect(simulate(baseline([])).timingRules.every(r => r.status === "not-evaluated")).toBe(true);
  });
  it("round trips custom rules and restores independent standard rules through presets", () => {
    const s = baseline();
    s.timingRules = [rule({ exchange: 10, time: 40000 })];
    expect(parseScenario(serializeScenario(s))).toEqual(s);
    const preset = applyPreset("three-waves", s);
    expect(preset.timingRules).toEqual(baseline().timingRules);
    preset.timingRules[0].time++;
    expect(s.timingRules[0].time).toBe(40000);
  });
  it.each([{ exchange: 0 }, { exchange: 71, type: "depart-after" }, { exchange: 72 }, { exchange: 1.5 }, { time: NaN }, { time: -30 * 86400 - 1 }, { time: 30 * 86400 }, { type: "unknown" }])("rejects malformed rules %j", patch => {
    expect(() => validateScenario({ ...baseline(), timingRules: [{ ...rule(), ...patch }] })).toThrow("Timing rules");
  });
  it("rejects duplicate IDs", () => {
    expect(() => validateScenario({ ...baseline(), timingRules: [rule(), rule()] })).toThrow("Timing rules");
  });
});
