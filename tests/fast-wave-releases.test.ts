import { describe, expect, it } from "vitest";
import { baseline, ORIGIN, worstCaseIds } from "../src/data";
import { challengeBefore, simulate } from "../src/engine";
import { orderedWaveEntries, removeWave, syncAssignments } from "../src/waves";
import { buildReplay } from "../src/replay";

function fastWave() {
  const s = baseline([worstCaseIds.fastest]);
  s.worstCaseTeams.fastest.mode="flat";
  s.worstCaseTeams.fastest.flatPace=900;
  s.waves=[{id:"fast",name:"Fast",color:"#123456",start:-3600}, {id:"slow",name:"Slow",color:"#654321",start:7200}];
  s.waveRules.boundaries=[1000];
  return syncAssignments(s);
}
describe("fast-wave release identity",()=>{
  it.each([0,1,10,35,53,70])("activates at exchange %s after physical arrival, even before Friday",fromExchange=>{
    const s=fastWave(); s.fastWaveReleases.fromExchange=fromExchange;
    const legs=simulate(s).teams[0].legs;
    legs.forEach((l,i)=>{
      expect(l.releaseSuppressed).toBe(i<fromExchange);
      if(i>0&&i<fromExchange)expect(l.departure).toBeGreaterThanOrEqual(legs[i-1].arrival+challengeBefore(i+1,s));
      if(fromExchange>0&&i>=fromExchange)expect(l.departure).toBeGreaterThanOrEqual(legs[fromExchange-1].arrival);
    });
  });
  it("disabled fast waves run sequentially with challenges and gates",()=>{
    const s=fastWave();s.fastWaveReleases.enabled=false;
    s.timingRules.push({id:"hold",exchange:2,type:"depart-after",time:50000,enabled:true});
    const result=simulate(s),team=result.teams[0];
    expect(result.releaseCount).toBe(0);expect(team.peakActive).toBe(1);
    const markers = buildReplay(result).frames.flatMap(frame => frame.markers);
    expect(markers.some(marker => marker.late! > 0)).toBe(true);
    expect(markers.every(marker => !marker.overlaps)).toBe(true);
    expect(team.legs[2].departure).toBe(50000);
    team.legs.forEach((l,i)=>{expect(l.releaseSuppressed).toBe(true);if(i)expect(l.departure).toBeGreaterThanOrEqual(team.legs[i-1].arrival+challengeBefore(i+1,s));});
  });
  it.each([-7200,ORIGIN,7200,172800])("the only/slowest wave uses releases at start %s",start=>{
    const s=baseline();s.waves[0].start=start;
    const before=simulate(s);s.fastWaveReleases.enabled=false;
    expect(simulate(s)).toEqual(before);
    expect(before.teams.every(t=>t.legs.every(l=>!l.releaseSuppressed))).toBe(true);
  });
  it("recomputes the slowest wave identity after removal and a split",()=>{
    const s=fastWave();
    const merged=removeWave(s,1);
    expect(simulate(merged).teams[0].legs.every(l=>!l.releaseSuppressed)).toBe(true);
    merged.waves.push({id:"new-slow",name:"New slow",color:"#123456",start:0});
    merged.waveRules.boundaries=[1000];
    const split=syncAssignments(merged);
    expect(orderedWaveEntries(split)[0].w.id).toBe("new-slow");
    expect(simulate(split).teams[0].legs[0].releaseSuppressed).toBe(true);
  });
  it("activation policy leaves moving time and release schedule unchanged",()=>{
    const s=fastWave(),before=simulate(s);s.fastWaveReleases.enabled=false;
    const after=simulate(s);expect(after.teams[0].movingTime).toBe(before.teams[0].movingTime);expect(after.releases).toEqual(before.releases);
  });
});
