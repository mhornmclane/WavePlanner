import { useState } from "react";
import { bins, defaultWorstCaseTeam, shiftBinPaces, validTeamPace, weightedPace,
  worstCaseIds, worstCaseNames, worstCaseSource, type WorstCaseKind } from "./data";
import { pace, parsePace } from "./format";
import type { Scenario, WorstCaseTeam } from "./model";

function TeamPaceInput({ label, value, commit }: {
  label: string; value: number; commit: (value: number) => void;
}) {
  const [text, setText] = useState(pace(value));
  const [previous, setPrevious] = useState(value);
  const [error, setError] = useState("");
  if (value !== previous) {
    setPrevious(value);
    setText(pace(value));
    setError("");
  }
  function apply() {
    if (text === pace(value)) { setError(""); return; }
    const next = parsePace(text);
    try {
      if (next === null || !validTeamPace(next)) throw new Error("Enter a pace from 0:01 to 99:59.");
      commit(next);
      setError("");
    } catch (e) { setError((e as Error).message); }
  }
  return <label className="field"><span>{label}</span>
    <input className="pace-input" aria-label={label} value={text} aria-invalid={!!error}
      onChange={e => { setText(e.target.value); setError(""); }} onBlur={apply}
      onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") { setText(pace(value)); setError(""); } }} />
    {error && <span role="alert">{error} Last valid pace is still in use.</span>}
  </label>;
}
export function WorstCaseTeams({ scenario: s, update, select }: {
  scenario: Scenario; update: (fn: (s: Scenario) => Scenario) => void;
  select: (ids: string[], include: boolean) => void;
}) {
  const [revision, setRevision] = useState({ fastest: 0, slowest: 0 });
  function change(kind: WorstCaseKind, definition: WorstCaseTeam) {
    update(current => ({ ...current, worstCaseTeams: { ...current.worstCaseTeams, [kind]: definition } }));
  }
  return <section className="worst-case-teams" aria-label="Worst-case teams">
    <h3>Worst-case teams</h3>
    <p className="muted">Explore beyond the historical field. Include either team to use its paces in the simulation. Paces are min:sec per mile.</p>
    <div className="worst-case-grid">{(["fastest", "slowest"] as const).map(kind => {
      const t = s.worstCaseTeams[kind], name = worstCaseNames[kind], id = worstCaseIds[kind];
      const source = worstCaseSource(kind);
      const overall = t.mode === "flat" ? t.flatPace : weightedPace(t.binPaces);
      return <fieldset key={kind}><legend>{name}</legend>
        <label><input type="checkbox" aria-label={`Include ${name}`} checked={s.selectedTeamIds.includes(id)}
          onChange={e => select([id], e.target.checked)} /> Include in simulation</label>
        <p className="muted">Historical default: {source.team} · {source.year}, {kind === "fastest" ? "0:30 faster" : "0:30 slower"} per mile overall.</p>
        <label className="field"><span>Pace mode</span><select aria-label={`${name} pace mode`} value={t.mode}
          onChange={e => change(kind, { ...t, mode: e.target.value as WorstCaseTeam["mode"],
            flatPace: e.target.value === "flat" ? overall : t.flatPace })}>
          <option value="bins">Individual bins</option><option value="flat">Flat overall</option>
        </select></label>
        <div key={`${revision[kind]}-${t.mode}`}>
          <TeamPaceInput label={`${name} overall pace`} value={overall} commit={v =>
            change(kind, t.mode === "flat" ? { ...t, flatPace: v } : { ...t, binPaces: shiftBinPaces(t.binPaces, v) })} />
          {t.mode === "bins" && <>
            <p className="muted">Overall is distance-weighted. Changing it shifts every bin equally; changing a bin recalculates overall.</p>
            <div className="worst-case-bins">{bins.map(b => <TeamPaceInput key={b.bin_id}
              label={`${name} legs ${b.first_leg}–${b.last_leg}`} value={t.binPaces[b.bin_id]}
              commit={v => change(kind, { ...t, binPaces: { ...t.binPaces, [b.bin_id]: v } })} />)}</div>
          </>}
        </div>
        {s.selectedTeamIds.includes(id) && s.waveRules.mode === "manual" &&
          <label className="field"><span>Starting wave</span><select aria-label={`Wave for ${name}`}
            value={s.assignments[id]} onChange={e => update(current => ({ ...current,
              assignments: { ...current.assignments, [id]: e.target.value } }))}>
            {s.waves.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select></label>}
        <button onClick={() => { change(kind, defaultWorstCaseTeam(kind));
          setRevision(r => ({ ...r, [kind]: r[kind] + 1 })); }}>Reset {name} to historical defaults</button>
      </fieldset>;
    })}</div>
  </section>;
}
