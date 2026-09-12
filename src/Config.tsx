import { TimingRulesEditor } from "./TimingRuleControls";
import { WorstCaseTeams } from "./WorstCaseTeams";
import { fieldIds, fieldYears } from "./data";
import { Waves } from "./WaveControls";
import { MinutesInput } from "./Inputs";
import { syncAssignments } from "./waves";
import type { Scenario, Simulation } from "./model";
export { TimeInput, PaceInput, MinutesInput } from "./Inputs";
export function Config({scenario:s, setScenario, result}: {
  scenario: Scenario; setScenario: (fn:(s:Scenario)=>Scenario)=>void; result:Simulation|null;
}) {
  const update = (fn:(s:Scenario)=>Scenario) => setScenario(c=>syncAssignments(fn(c)));
  return <div className="simulation-controls">
    <label className="field"><span>Simulation field</span>
      <select aria-label="Simulation field" value={s.fieldYear} onChange={e=>update(c=>{
        const fieldYear=e.target.value === "all" ? "all" : +e.target.value;
        return {...c, fieldYear, selectedTeamIds:[...fieldIds(fieldYear), ...c.selectedTeamIds.filter(id=>id.startsWith("synthetic::"))]};
      })}><option value="all">All years</option>{fieldYears.map(y=><option key={y} value={y}>{y}</option>)}</select>
    </label>
    <p className="muted">{s.selectedTeamIds.length} profiles · Each team-year is a separate performance.</p>
    <Waves scenario={s} update={update}/>
    <details className="secondary-control"><summary>Timing rules & fast-wave releases</summary><TimingRulesEditor scenario={s} result={result} update={update}/></details>
    <details className="secondary-control"><summary>Challenge allowances</summary>
      <MinutesInput label="Monument challenge" value={s.challenges.monument} onChange={monument=>update(c=>({...c,challenges:{...c.challenges,monument}}))}/>
      <MinutesInput label="Lighthouse challenge" value={s.challenges.lighthouse} onChange={lighthouse=>update(c=>({...c,challenges:{...c.challenges,lighthouse}}))}/>
      <p className="muted">Included in the latest-start estimate and release timetable.</p>
    </details>
    <details className="secondary-control"><summary>Staffing buffers</summary>
      <MinutesInput label="Before first activity" value={s.buffers.before} onChange={before=>update(c=>({...c,buffers:{...c.buffers,before}}))}/>
      <MinutesInput label="After last activity" value={s.buffers.after} onChange={after=>update(c=>({...c,buffers:{...c.buffers,after}}))}/>
    </details>
    <details className="secondary-control"><summary>Hypothetical teams</summary><WorstCaseTeams scenario={s} update={update} select={(ids,include)=>update(c=>({...c,selectedTeamIds: include ? [...new Set([...c.selectedTeamIds,...ids])] : c.selectedTeamIds.filter(id=>!ids.includes(id))}))}/></details>
  </div>;
}
