import { TimingRulesEditor } from "./TimingRuleControls";
import { WorstCaseTeams } from "./WorstCaseTeams";
import { Waves } from "./WaveControls";
import { MinutesInput } from "./Inputs";
import { syncAssignments } from "./waves";
import { worstCaseIds } from "./data";
import type { Scenario, Simulation } from "./model";
export { TimeInput, PaceInput, MinutesInput } from "./Inputs";
export function Config({scenario:s, setScenario, result}: {
  scenario: Scenario; setScenario: (fn:(s:Scenario)=>Scenario)=>void; result:Simulation|null;
}) {
  const update = (fn:(s:Scenario)=>Scenario) => setScenario(c=>syncAssignments(fn(c)));
  const minutes = (n:number) => Number.isFinite(n) ? `${n / 60}` : "—";
  const hypotheticalCount = Object.values(worstCaseIds).filter(id=>s.selectedTeamIds.includes(id)).length;
  return <div className="simulation-controls">
    <Waves scenario={s} update={update}/>
    <div className="compact-settings">
    <details name="configuration-settings" className="secondary-control"><summary><span>Timing rules & fast-wave releases</span><small>{s.timingRules.filter(r=>r.enabled).length} active rules · {s.fastWaveReleases.enabled ? `releases at EX ${s.fastWaveReleases.fromExchange}` : "fast-wave releases off"}</small></summary><div className="settings-content"><TimingRulesEditor scenario={s} result={result} update={update}/></div></details>
    <details name="configuration-settings" className="secondary-control"><summary><span>Challenge allowances</span><small>{minutes(s.challenges.monument)} + {minutes(s.challenges.lighthouse)} min</small></summary><div className="settings-content">
      <MinutesInput label="Monument challenge" value={s.challenges.monument} onChange={monument=>update(c=>({...c,challenges:{...c.challenges,monument}}))}/>
      <MinutesInput label="Lighthouse challenge" value={s.challenges.lighthouse} onChange={lighthouse=>update(c=>({...c,challenges:{...c.challenges,lighthouse}}))}/>
      <p className="muted">Included in the latest-start estimate and release timetable.</p>
    </div></details>
    <details name="configuration-settings" className="secondary-control"><summary><span>Staffing buffers</span><small>{s.buffers.before === 0 && s.buffers.after === 0 ? "No buffers" : `${minutes(s.buffers.before)} min before · ${minutes(s.buffers.after)} after`}</small></summary><div className="settings-content">
      <MinutesInput label="Before first activity" value={s.buffers.before} onChange={before=>update(c=>({...c,buffers:{...c.buffers,before}}))}/>
      <MinutesInput label="After last activity" value={s.buffers.after} onChange={after=>update(c=>({...c,buffers:{...c.buffers,after}}))}/>
    </div></details>
    <details name="configuration-settings" className="secondary-control"><summary><span>Hypothetical teams</span><small>{hypotheticalCount ? `${hypotheticalCount} included` : "None included"}</small></summary><div className="settings-content"><WorstCaseTeams scenario={s} update={update} select={(ids,include)=>update(c=>({...c,selectedTeamIds: include ? [...new Set([...c.selectedTeamIds,...ids])] : c.selectedTeamIds.filter(id=>!ids.includes(id))}))}/></div></details>
    </div>
  </div>;
}
