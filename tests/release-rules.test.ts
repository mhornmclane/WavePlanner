import { describe, expect, it } from "vitest";
import { baseline, course, worstCaseIds } from "../src/data";
import { simulate } from "../src/engine";
import { createPreset } from "../src/presets";
import { releaseRuleWarnings } from "../src/releaseRules";

describe("release timetable rule checks", () => {
  it("flags a late monument release even when simulated teams clear on time", () => {
    const s=baseline([worstCaseIds.fastest]);
    s.worstCaseTeams.fastest.mode="flat";s.worstCaseTeams.fastest.flatPace=60;
    const planned=simulate(s).releasesByWave['wave-1'][35];
    s.timingRules=[{id:'monument',enabled:true,type:'clear-by',exchange:35,time:planned-600}];
    const result=simulate(s);
    expect(result.timingRules[0].status).toBe('passed');
    const warnings=releaseRuleWarnings(s,result);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({activity:'clearance',planned,difference:600});
  });
  it("includes empty waves and distinguishes arrival from clearance at a challenge", () => {
    const s=createPreset('three-waves',[]),result=simulate(s);
    const w=s.waves[0],releases=result.releasesByWave[w.id];
    const arrival=releases[34]+course.legs[34].distance_miles*w.release.pace;
    s.timingRules=[{id:'arrival',enabled:true,type:'arrive-by',exchange:35,time:arrival},
      {id:'clearance',enabled:true,type:'clear-by',exchange:35,time:arrival}];
    const warnings=releaseRuleWarnings(s,result).filter(r=>r.wave.id===w.id);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].difference).toBeCloseTo(s.challenges.monument,8);
    expect(warnings[0].rule.id).toBe('clearance');
  });
  it("reports departures before opening and ignores disabled rules and numerical noise", () => {
    const s=baseline([]),result=simulate(s),time=result.releasesByWave['wave-1'][69];
    s.timingRules=[{id:'opening',enabled:true,type:'depart-after',exchange:69,time:time+600},
      {id:'disabled',enabled:false,type:'clear-by',exchange:35,time:0},
      {id:'equal',enabled:true,type:'clear-by',exchange:69,time:time-1e-8}];
    expect(releaseRuleWarnings(s,result).map(r=>[r.rule.id,r.difference])).toEqual([['opening',600]]);
    s.timingRules[0].time=time;
    expect(releaseRuleWarnings(s,result)).toHaveLength(0);
  });
  it("handles actual launch, first arrival, and the finish without nonexistent outgoing legs", () => {
    const s=baseline([]);s.waves[0].start+=600;
    const result=simulate(s),finish=s.waves[0].release.targetFinish;
    s.timingRules=[{id:'start',enabled:true,type:'depart-after',exchange:0,time:s.waves[0].start+60},
      {id:'first-arrival',enabled:true,type:'arrive-by',exchange:1,time:s.waves[0].start+course.legs[0].distance_miles*s.waves[0].release.pace-60},
      {id:'finish',enabled:true,type:'clear-by',exchange:71,time:finish-60}];
    const warnings=releaseRuleWarnings(s,result);
    expect(warnings).toHaveLength(3);
    warnings.forEach(w=>expect(w.difference).toBeCloseTo(60,8));
  });
  it("checks fast-wave timetables even when release activation is disabled", () => {
    const s=createPreset('three-waves',[]);s.fastWaveReleases.enabled=false;
    s.timingRules=[{id:'late',enabled:true,type:'clear-by',exchange:35,time:0}];
    expect(releaseRuleWarnings(s,simulate(s))).toHaveLength(3);
  });
});
