import { useState } from "react";
import { bins, course, profiles, teamId, fieldYears, resolveProfile } from "./data";
import { clock, duration, pace } from "./format";
import { download, historicalCsv, teamResultsCsv } from "./storage";
import { Staffing } from "./Staffing";
import { TimingRuleSummary } from "./TimingRuleControls";
import type { Scenario, Simulation } from "./model";

export function HistoricalData() {
  const [year,setYear]=useState("all"), [search,setSearch]=useState(""), [sort,setSort]=useState<"asc"|"desc">("asc");
  const rows=profiles.filter(p=>(year==="all" || String(p.year)===year) && p.team.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>(sort==="asc" ? 1 : -1)*(a.overall_mean_pace_seconds_per_mile-b.overall_mean_pace_seconds_per_mile) || a.team.localeCompare(b.team) || Number(a.year)-Number(b.year));
  return <section className="panel history-panel" aria-label="Historical data">
    <div className="section-head"><div><div className="eyebrow">PAST PERFORMANCE</div><h2>Historical data</h2><p className="muted">Explore team performances independently of your simulation.</p></div><div className="export-actions">
      <button disabled={!rows.length} onClick={()=>download("historical-filtered.csv",historicalCsv(rows),"text/csv;charset=utf-8")}>Export filtered CSV</button>
      <button onClick={()=>download("historical-all.csv",historicalCsv(profiles),"text/csv;charset=utf-8")}>Export all CSV</button>
    </div></div>
    <div className="history-filters"><label className="field">Year<select aria-label="Historical year" value={year} onChange={e=>setYear(e.target.value)}><option value="all">All years</option>{fieldYears.map(y=><option key={y} value={y}>{y}</option>)}</select></label><label className="field">Team<input type="search" aria-label="Find historical team" placeholder="Find a team…" value={search} onChange={e=>setSearch(e.target.value)}/></label><span>{rows.length} records</span></div>
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Historical team paces"><table><thead><tr><th>Team</th><th>Year</th><th aria-sort={sort==="asc" ? "ascending":"descending"}><button className="sort-button" onClick={()=>setSort(sort==="asc"?"desc":"asc")}>Overall {sort==="asc"?"↑":"↓"}</button></th>{bins.map(b=><th key={b.bin_id}>Legs {b.first_leg}–{b.last_leg}</th>)}</tr></thead><tbody>{rows.map(p=><tr key={teamId(p)}><th scope="row">{p.team}</th><td>{p.year}</td><td>{pace(p.overall_mean_pace_seconds_per_mile)}</td>{bins.map(b=><td key={b.bin_id}>{pace(p.bin_mean_pace_seconds_per_mile[b.bin_id])}</td>)}</tr>)}</tbody></table></div>
    {!rows.length && <p className="empty-state" role="status">No historical records match these filters.</p>}<p className="table-note panel-note">Pace is min:sec per mile. Exports include the original numeric seconds/mile values.</p>
  </section>;
}

export function Summary({result,scenario}:{result:Simulation;scenario:Scenario}) {
  const late=result.teams.filter(t=>t.finish>scenario.release.targetFinish+1e-7);
  const lastFinish=result.teams.length ? Math.max(...result.teams.map(t=>t.finish)) : null;
  const gates=scenario.timingRules.filter(r=>r.enabled && r.type==="depart-after" && r.time>result.releases[r.exchange]);
  return <div className="live-summary">
    <div className="metrics">
      <article><span>Last final-leg finish</span><strong>{clock(lastFinish)}</strong><small>Target: {clock(scenario.release.targetFinish)}</small></article>
      <article><span>Finish spread</span><strong>{result.teams.length ? duration(result.finishSpread):"—"}</strong><small>{result.teams.length} profiles · {scenario.waves.length} waves</small></article>
      <article><span>Last runner off course</span><strong>{clock(result.lastOffCourse)}</strong><small>All outstanding legs complete</small></article>
      <article><span>Exchange coverage</span><strong>{result.exchangeHours.toFixed(1)} hrs</strong><small>{result.releaseCount} releases · peak {result.peakActive} active/team</small></article>
    </div>
    <p role="status" className={late.length ? "finish-feedback rule-failed":"finish-feedback"}>{!result.teams.length ? "Finish target: Not evaluated" : late.length ? `${late.length} profiles finish after the target · latest overrun ${duration(Math.max(...late.map(t=>t.finish))-scenario.release.targetFinish)}` : "All simulated final-leg finishes meet the target."}</p>
    {!!gates.length && <p className="gate-feedback">{gates.length} gate opening{gates.length===1?"":"s"} later than the planned release time. See timing rules for actual holds.</p>}
  </div>;
}

export function ResultsView({scenario,result,comparison,overlay}:{scenario:Scenario;result:Simulation;comparison:Simulation;overlay:boolean}) {
  return <>
    <Summary scenario={scenario} result={result}/><TimingRuleSummary scenario={scenario} result={result}/>
    <section className="panel"><div className="section-head"><h2>Team finishes</h2><button onClick={()=>download("team-results.csv",teamResultsCsv(scenario,result),"text/csv;charset=utf-8")}>Export team results CSV</button></div>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Team finishes"><table><thead><tr><th>Team</th><th>Year</th><th>Wave</th><th>Start</th><th>Final-leg finish</th><th>All legs complete</th><th>Target overrun</th></tr></thead><tbody>{result.teams.map(t=>{const p=resolveProfile(scenario,t.teamId);return <tr key={t.teamId}><th scope="row">{p.team}</th><td>{p.year}</td><td>{scenario.waves.find(w=>w.id===t.waveId)?.name}</td><td>{clock(t.legs[0].departure)}</td><td>{clock(t.finish)}</td><td>{clock(t.allComplete)}</td><td>{t.finish>scenario.release.targetFinish ? duration(t.finish-scenario.release.targetFinish):"—"}</td></tr>;})}</tbody></table></div>
    </section>
    <Staffing result={result} comparison={comparison} overlay={overlay}/>
    <section className="panel"><div className="section-head"><div><h2>Release timetable</h2><p className="muted">{pace(scenario.release.pace)}/mile · Target final-leg finish {clock(scenario.release.targetFinish)}</p></div></div><div className="table-scroll" tabIndex={0} role="region" aria-label="Release timetable"><table><thead><tr><th>Outbound leg</th><th>Start location</th><th>Release time</th></tr></thead><tbody>{course.legs.map((l,i)=><tr key={l.leg_number}><td>{l.leg_number}</td><th scope="row">{l.start_location}</th><td>{clock(result.releases[i])}</td></tr>)}</tbody></table></div></section>
  </>;
}
