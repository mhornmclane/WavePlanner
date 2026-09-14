import { describe,expect,it } from "vitest";
import { baseline,course,defaultFinishTarget,fieldIds,profiles,worstCaseIds } from "../src/data";
import { latestStart,releaseSchedule,simulate,clockSeconds } from "../src/engine";
import { clock } from "../src/format";
import { historicalCsv,teamResultsCsv,validateScenario,serializeScenario,parseScenario,STORAGE_KEY,readSaves } from "../src/storage";
import { syncAssignments } from "../src/waves";

describe("finish target",()=>{
  it("works backward across all 71 legs and both challenges without rounding",()=>{
    const s=baseline();s.waves[0].release={targetFinish:140000.5,pace:637};
    const start=140000.5-205.72*637-960-1260;
    expect(latestStart(s, s.waves[0])).toBeCloseTo(start,8);
    const schedule=releaseSchedule(s, s.waves[0]);
    expect(schedule).toHaveLength(71);expect(schedule[0]).toBeCloseTo(start,8);
    expect(schedule[35]-schedule[34]).toBeCloseTo(course.legs[34].distance_miles*637+960,8);
    expect(schedule[53]-schedule[52]).toBeCloseTo(course.legs[52].distance_miles*637+1260,8);
    expect(schedule[70]+course.legs[70].distance_miles*637).toBeCloseTo(140000.5,8);
  });
  it("challenge changes move the estimate earlier while keeping the finish fixed",()=>{
    const s=baseline(),oldStart=latestStart(s, s.waves[0]),waveStart=s.waves[0].start;
    s.challenges.monument+=600;
    expect(latestStart(s, s.waves[0])).toBeCloseTo(oldStart-600,8);
    expect(s.waves[0].start).toBe(waveStart);
    expect(releaseSchedule(s, s.waves[0])[70]+course.legs[70].distance_miles*s.waves[0].release.pace).toBeCloseTo(s.waves[0].release.targetFinish,8);
  });
  it("initial target follows the published last release plus final-leg travel",()=>{
    expect(defaultFinishTarget()).toBe(clockSeconds(course.legs[70].release_time)+course.legs[70].distance_miles*625);
    const comparison=simulate(baseline(),true);
    expect(comparison.releasesByWave["wave-1"]).toEqual(course.legs.map(l=>clockSeconds(l.release_time)));
    expect(comparison.releaseCount).toBe(1024);
    expect(comparison.exchangeHours.toFixed(1)).toBe("274.6");
  });
  it.each([0,-1,6000,NaN,Infinity])("rejects invalid pace %s",pace=>{
    const s=baseline();s.waves[0].release.pace=pace;expect(()=>validateScenario(s)).toThrow("release pace");
  });
  it("preserves independently selected starts even when later than guidance",()=>{
    const s=baseline();s.waves[0].release.targetFinish=100000;s.waves[0].start=110000;
    expect(latestStart(s, s.waves[0])).toBeLessThan(s.waves[0].start);
    expect(simulate(s).teams.every(t=>t.finish>s.waves[0].release.targetFinish)).toBe(true);
    expect(s.waves[0].start).toBe(110000);
  });
});
describe("weekday labels and new configuration contract",()=>{
  it.each([[-7200,"Thursday 10:00 PM"],[0,"Friday 12:00 AM"],[3600,"Friday 1:00 AM"],[86400,"Saturday 12:00 AM"],[7*86400,"Friday (week +1) 12:00 AM"],[-7*86400,"Friday (week -1) 12:00 AM"]])("labels %s as %s",(seconds,label)=>expect(clock(seconds)).toBe(label));
  it.each([1,2,3,4,5,9])("rejects schema %s without migration",schemaVersion=>expect(()=>validateScenario({...baseline(),schemaVersion})).toThrow("version"));
  it("ignores old browser storage",()=>{
    expect(STORAGE_KEY).toBe("ruck4hit-scenarios-v8");expect(readSaves({getItem:key=>key==="ruck4hit-scenarios-v1"?"broken":null})).toEqual([]);
  });
  it("round-trips year and hypothetical inclusion independently",()=>{
    const s=baseline();s.fieldYear=2025;s.selectedTeamIds=[...fieldIds(2025),worstCaseIds.slowest];
    const next=syncAssignments(s),loaded=parseScenario(serializeScenario(next));
    expect(loaded).toEqual(next);expect(loaded.selectedTeamIds.length).toBe(fieldIds(2025).length+1);
    expect(()=>validateScenario({...next,fieldYear:2024})).toThrow("field year");
  });
  it("exports historical values exactly and separates all-year profiles",()=>{
    expect(fieldIds("all")).toHaveLength(51);
    const rows=profiles.filter(p=>p.year===2025),csv=historicalCsv(rows);
    expect(csv.split("\r\n")).toHaveLength(rows.length+1);
    expect(csv).toContain(String(rows[0].overall_mean_pace_seconds_per_mile));
    expect(csv).toContain("legs_01_14 seconds/mile");
  });
  it("exports final-leg finishes, all-complete times and target overruns",()=>{
    const s=baseline(),csv=teamResultsCsv(s,simulate(s));
    expect(csv.split("\r\n")).toHaveLength(52);expect(csv).toContain('"All legs complete"');expect(csv).toContain("Saturday");
  });
});
