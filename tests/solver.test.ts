import { describe, expect, it } from "vitest";
import { baseline, course, fieldIds } from "../src/data";
import { createPreset } from "../src/presets";
import { latestStart, simulate } from "../src/engine";
import { preciseClock, precisePace } from "../src/format";
import { resolveSolvers, solverError, SOLVER_TOLERANCE } from "../src/solver";
import { parseScenario, serializeScenario, readSaves, writeSaves, STORAGE_KEY, validateScenario } from "../src/storage";
import { removeWave } from "../src/waves";

describe("live solver", () => {
  it.each(["start", "finish", "pace"] as const)("solves %s without rounding and keeps other waves independent", mode => {
    const s = createPreset("three-waves", fieldIds("all"));
    const before = structuredClone(s);
    s.waves[1].solver = mode;
    const solved = resolveSolvers(s), w = solved.waves[1];
    const allowance = s.challenges.monument + s.challenges.lighthouse;
    expect(w.release.targetFinish).toBeCloseTo(w.start + course.event.total_distance_miles * w.release.pace + allowance, 8);
    expect(w.start).toBeLessThanOrEqual(latestStart(solved, w) + SOLVER_TOLERANCE);
    expect(solved.waves[0]).toEqual(before.waves[0]);
    expect(solved.waves[2]).toEqual(before.waves[2]);
    expect(s.waves[1].start).toBe(before.waves[1].start);
    const original = simulate(before), after = simulate(solved);
    expect(after.teams.filter(t=>t.waveId!==w.id)).toEqual(original.teams.filter(t=>t.waveId!==w.id));
    expect(solverError(solved, w)).toBeNull();
  });
  it("updates each selected variable when shared challenges change", () => {
    const s = createPreset("three-waves", []);
    s.waves.forEach((w,i)=>w.solver=(["start","finish","pace"] as const)[i]);
    const original = resolveSolvers(s);
    const changed = resolveSolvers({...original,challenges:{...s.challenges,monument:s.challenges.monument+600}});
    expect(changed.waves[0].start).toBeCloseTo(original.waves[0].start-600,8);
    expect(changed.waves[1].release.targetFinish).toBeCloseTo(original.waves[1].release.targetFinish+600,8);
    expect(changed.waves[2].release.pace).toBeCloseTo(original.waves[2].release.pace-600/course.event.total_distance_miles,8);
  });
  it("None retains computed values, presets reset modes, and removal retains the receiving mode", () => {
    let s = createPreset("three-waves", []);
    s.waves[0].solver="pace";
    s=resolveSolvers(s);
    s.waves[0].solver="none";
    expect(resolveSolvers(s)).toEqual(s);
    s.waves[0].solver="finish";
    expect(removeWave(s,1).waves[0].solver).toBe("finish");
    expect(createPreset("three-waves", []).waves.every(w=>w.solver==="finish")).toBe(true);
  });
  it.each([NaN, -100, 0, 6000])("rejects impossible calculated pace %s without clamping", pace => {
    const s=baseline(); s.waves[0].solver="pace";
    s.waves[0].release.targetFinish=s.waves[0].start+course.event.total_distance_miles*pace+s.challenges.monument+s.challenges.lighthouse;
    const solved=resolveSolvers(s);
    expect(solverError(solved,solved.waves[0])).toContain("Wave 1");
    expect(()=>validateScenario(solved)).toThrow();
    if(Number.isFinite(pace))expect(solved.waves[0].release.pace).toBeCloseTo(pace,8);
  });
  it("detects out-of-range times and recovers from incomplete inputs", () => {
    const s=baseline(); s.waves[0].solver="start";s.waves[0].release.pace=5999;
    s.waves[0].release.targetFinish=-29*86400;
    expect(solverError(s,s.waves[0])).toContain("within 30 days");
    s.waves[0].release.pace=NaN;
    expect(solverError(s,s.waves[0])).toContain("valid inputs");
    s.waves[0].release=baseline().waves[0].release;
    expect(solverError(s,s.waves[0])).toBeNull();
  });
  it("formats fractional seconds and midnight rollovers without losing stored precision", () => {
    expect(preciseClock(-0.25)).toBe("Thursday 11:59:59.75 PM");
    expect(preciseClock(86399.999)).toBe("Saturday 12:00:00 AM");
    expect(precisePace(599.999)).toBe("10:00");
    const s=baseline();s.waves[0].solver="pace";
    const solved=resolveSolvers(s);
    expect(solved.waves[0].release.pace).not.toBe(Math.round(solved.waves[0].release.pace));
    expect(parseScenario(serializeScenario(solved))).toEqual(solved);
  });
});

describe("solver persistence", () => {
  it("migrates v7 to None and retains v7 browser data when saving v8", () => {
    const current=baseline();
    const legacy={...current,schemaVersion:7,waves:current.waves.map(({solver:_solver,...w})=>w)};
    const data=new Map([["ruck4hit-scenarios-v7",JSON.stringify([{id:"old",updatedAt:"today",scenario:legacy}])]]);
    const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
    const old=data.get("ruck4hit-scenarios-v7");
    const saves=readSaves(storage);
    expect(saves[0].scenario).toEqual(current);
    saves[0].scenario.waves[0].solver="finish";
    writeSaves(storage,saves);
    expect(data.get("ruck4hit-scenarios-v7")).toBe(old);
    expect(data.has(STORAGE_KEY)).toBe(true);
    expect(readSaves(storage)[0].scenario.waves[0].solver).toBe("finish");
  });
  it("recalculates stale stored solved values on load and rejects unknown modes", () => {
    const s=baseline();s.waves[0].solver="start";s.waves[0].start=12345;
    expect(parseScenario(JSON.stringify(s)).waves[0].start).toBe(latestStart(s,s.waves[0]));
    const invalid=structuredClone(s) as any;invalid.waves[0].solver="all";
    expect(()=>validateScenario(invalid)).toThrow();
  });
});
