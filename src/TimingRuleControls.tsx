import { course, resolveProfile } from "./data";
import { clock, duration } from "./format";
import { exchangeName, ruleStatus, ruleTypes, supportsRule } from "./timingRules";
import type { Scenario, Simulation, TimingRule, TimingRuleType } from "./model";

export function TimingRulesEditor({ scenario, result, update }: {
  scenario: Scenario; result: Simulation | null; update: (fn: (s: Scenario) => Scenario) => void;
}) {
  function change(id: string, patch: Partial<TimingRule>) {
    update(s => ({ ...s, timingRules: s.timingRules.map(r => r.id === id ? { ...r, ...patch } : r) }));
  }
  return <section aria-label="Timing rules editor">
    <fieldset className="timing-rule-editor fast-wave-releases">
      <legend>Fast-wave releases</legend>
      <p className="muted">Applies to waves starting after Day 1, 01:00. Before the selected exchange, each outgoing runner waits for the incoming runner and any challenge. Releases can apply once the team reaches that exchange.</p>
      <label><input type="checkbox" aria-label="Enable releases for fast waves" checked={scenario.fastWaveReleases.enabled}
        onChange={e => update(s => ({ ...s, fastWaveReleases: { ...s.fastWaveReleases, enabled: e.target.checked } }))} /> Apply release times to fast waves</label>
      <label className="field"><span>Apply releases starting at exchange</span>
        <select aria-label="Fast-wave release starting exchange" disabled={!scenario.fastWaveReleases.enabled}
          value={scenario.fastWaveReleases.fromExchange}
          onChange={e => update(s => ({ ...s, fastWaveReleases: { ...s.fastWaveReleases, fromExchange: +e.target.value } }))}>
          {Array.from({ length: course.legs.length }, (_, i) => <option key={i} value={i}>
            {i === 0 ? "Start" : `EX ${i}`} · {exchangeName(i)} · start of leg {i + 1}
          </option>)}
        </select>
      </label>
      <p className="rule-status" role="status">{scenario.fastWaveReleases.enabled
        ? `Releases apply from ${scenario.fastWaveReleases.fromExchange === 0 ? "the start" : `EX ${scenario.fastWaveReleases.fromExchange}`} onward.`
        : "Releases are off for fast waves: all legs run sequentially, including challenges."} Opening-time rules still apply.</p>
    </fieldset>
    <h3>Exchange deadlines and openings</h3>
    <p className="muted">Deadlines flag late teams. Opening times hold outgoing runners until the location opens. Clearance checks the later of incoming arrival and outgoing departure.</p>
    <div className="timing-rule-list">{scenario.timingRules.map((r, index) => {
      const evaluation = result?.timingRules.find(v => v.ruleId === r.id);
      const day = Number.isFinite(r.time) ? Math.floor(r.time / 86400) + 1 : 1;
      const time = Number.isFinite(r.time) ? clock(r.time).split(" ")[1] : "";
      return <fieldset key={r.id} className="timing-rule-editor"><legend>Rule {index + 1}</legend>
        <label><input type="checkbox" aria-label={`Enable timing rule ${index + 1}`} checked={r.enabled}
          onChange={e => change(r.id, { enabled: e.target.checked })} /> Enabled</label>
        <label className="field"><span>Exchange</span><select aria-label={`Rule ${index + 1} exchange`} value={r.exchange}
          onChange={e => { const exchange = +e.target.value; change(r.id, { exchange,
            type: supportsRule(exchange, r.type) ? r.type : exchange === 0 ? "depart-after" : "clear-by" }); }}>
          {Array.from({ length: course.legs.length + 1 }, (_, i) => <option key={i} value={i}>
            {i === 0 ? "Start" : i === course.legs.length ? "Finish" : `EX ${i}`} · {exchangeName(i)}
          </option>)}
        </select></label>
        <label className="field"><span>Rule</span><select aria-label={`Rule ${index + 1} type`} value={r.type}
          onChange={e => change(r.id, { type: e.target.value as TimingRuleType })}>
          {(Object.keys(ruleTypes) as TimingRuleType[]).filter(t => supportsRule(r.exchange, t)).map(t =>
            <option key={t} value={t}>{ruleTypes[t]}</option>)}
        </select></label>
        <div className="timing-rule-clock">
          <label className="field"><span>Day</span><input aria-label={`Rule ${index + 1} day`} type="number" min="1" max="30" step="1" value={day}
            onChange={e => change(r.id, { time: e.target.value && Number.isInteger(+e.target.value) ? (+e.target.value - 1) * 86400 + (Number.isFinite(r.time) ? r.time % 86400 : 0) : NaN })} /></label>
          <label className="field"><span>Time</span><input aria-label={`Rule ${index + 1} time`} type="time" value={time}
            onChange={e => { const [h, m] = e.target.value.split(":").map(Number);
              change(r.id, { time: e.target.value ? (day - 1) * 86400 + h * 3600 + m * 60 : NaN }); }} /></label>
        </div>
        <p className={evaluation?.status === "failed" ? "rule-failed" : "rule-status"} role="status">{ruleStatus(r, evaluation)}</p>
        <button className="quiet" aria-label={`Remove timing rule ${index + 1}`} onClick={() => update(s => ({ ...s,
          timingRules: s.timingRules.filter(v => v.id !== r.id) }))}>Remove rule</button>
      </fieldset>;
    })}</div>
    <button onClick={() => update(s => ({ ...s, timingRules: [...s.timingRules,
      { id: crypto.randomUUID(), enabled: true, exchange: 35, type: "clear-by", time: 19 * 3600 }] }))}>+ Add timing rule</button>
  </section>;
}

export function TimingRuleSummary({ scenario, result }: { scenario: Scenario; result: Simulation }) {
  const failed = result.timingRules.filter(r => r.status === "failed");
  const lateTeams = new Set(failed.flatMap(r => r.teams.filter(t => t.lateness > 0).map(t => t.teamId))).size;
  const heldTeams = new Set(result.timingRules.flatMap(r => r.teams.filter(t => t.wait > 0).map(t => t.teamId))).size;
  const headline = !result.timingRules.length ? "No active timing rules" : !result.teams.length ? "Timing rules: Not evaluated"
    : failed.length ? `Timing rules: ${failed.length} violated · ${lateTeams} late ${lateTeams === 1 ? "team" : "teams"}`
    : `Timing rules: All deadlines met · ${heldTeams} ${heldTeams === 1 ? "team" : "teams"} held at openings`;
  return <details className={`timing-rule-summary ${failed.length ? "has-violations" : ""}`}>
    <summary>{headline}</summary>
    {result.timingRules.map(evaluation => {
      const rule = scenario.timingRules.find(r => r.id === evaluation.ruleId)!;
      const affected = evaluation.teams.filter(t => t.lateness > 0 || t.wait > 0);
      return <section key={rule.id}>
        <h3>EX {rule.exchange} · {exchangeName(rule.exchange)} — {ruleTypes[rule.type]} {clock(rule.time)}</h3>
        <p className={evaluation.status === "failed" ? "rule-failed" : "rule-status"}>{ruleStatus(rule, evaluation)}</p>
        {!!affected.length && <div className="rule-table-scroll"><table className="rule-results"><thead><tr>
          <th>Team</th><th>Wave</th><th>Actual time</th><th>{rule.type === "depart-after" ? "Opening" : "Deadline"}</th>
          <th>{rule.type === "depart-after" ? "Gate wait" : "Late by"}</th>
        </tr></thead><tbody>{affected.map(t => <tr key={t.teamId}>
          <td>{resolveProfile(scenario, t.teamId).team} · {resolveProfile(scenario, t.teamId).year}</td>
          <td>{scenario.waves.find(w => w.id === t.waveId)?.name}</td><td>{clock(t.actual)}</td><td>{clock(rule.time)}</td>
          <td>{(t.lateness || t.wait) < 60 ? "<1 min" : duration(t.lateness || t.wait)}</td>
        </tr>)}</tbody></table></div>}
      </section>;
    })}
  </details>;
}
