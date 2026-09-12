import { latestStart } from "./engine";
import { TimeInput, PaceInput } from "./Inputs";
import { useState } from "react";
import { colors, resolveProfile } from "./data";
import { clock, pace, parsePace } from "./format";
import {
  orderedWaveEntries,
  removeWave,
  splitSuggestion,
  syncAssignments,
  validBoundary,
} from "./waves";
import type { Scenario } from "./model";

function Boundary({
  value,
  label,
  valid,
  commit,
}: {
  value: number;
  label: string;
  valid: (n: number) => boolean;
  commit: (n: number) => void;
}) {
  const [text, setText] = useState(pace(value));
  const [previous, setPrevious] = useState(value);
  const [error, setError] = useState(false);
  if (previous !== value) {
    setPrevious(value);
    setText(pace(value));
    setError(false);
  }
  function apply() {
    const n = parsePace(text);
    if (n === null || !valid(n)) {
      setError(true);
      return;
    }
    setError(false);
    commit(n);
  }
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="pace-input"
        aria-label={label}
        value={text}
        aria-invalid={error}
        onChange={(e) => {
          setText(e.target.value);
          setError(false);
        }}
        onBlur={apply}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply();
          if (e.key === "Escape") {
            setText(pace(value));
            setError(false);
          }
        }}
      />
      {error && (
        <small role="alert">Use m:ss between the neighboring boundaries.</small>
      )}
    </label>
  );
}
export function Waves({
  scenario: s,
  update,
}: {
  scenario: Scenario;
  update: (fn: (s: Scenario) => Scenario) => void;
}) {
  const [split, setSplit] = useState<{ index: number; text: string } | null>(
    null,
  );
  const [openRoster, setOpenRoster] = useState<string | null>(null);
  const firstSplit = s.waves.length === 1;
  const splitValue = split ? parsePace(split.text) : null;
  const splitValid =
    !!split &&
    splitValue !== null &&
    splitValue > (s.waveRules.boundaries[split.index - 1] ?? 0) &&
    splitValue < (s.waveRules.boundaries[split.index] ?? 6000);
  function beginSplit(index: number) {
    setSplit({ index, text: pace(splitSuggestion(s, index)) });
  }
  function boundary(index: number, value: number) {
    update((c) =>
      syncAssignments({
        ...c,
        waveRules: {
          ...c.waveRules,
          boundaries: c.waveRules.boundaries.map((v, i) =>
            i === index ? value : v,
          ),
        },
      }),
    );
  }
  const roster = (scenario: Scenario, waveId: string) =>
    scenario.selectedTeamIds
      .filter((id) => scenario.assignments[id] === waveId)
      .map((id) => resolveProfile(scenario, id))
      .sort(
        (a, b) =>
          a.overall_mean_pace_seconds_per_mile -
            b.overall_mean_pace_seconds_per_mile ||
          a.team.localeCompare(b.team) ||
          Number(a.year) - Number(b.year),
      );
  return (
    <>
      <div className="subsection-head"><h3>Starting waves</h3><button disabled={s.waves.length >= 51} onClick={() => beginSplit(s.waves.length - 1)}>+ Add wave</button></div>
      <div className="wave-column-headings" aria-hidden="true"><span>Wave</span><span>Pace range · / mi</span><span>Start</span><span>Teams</span><span></span></div>
      <div className="wave-list">
        {orderedWaveEntries(s).map(({ w, i }, displayIndex) => (
          <div className="wave-card" key={w.id}>
            <div className="wave-row">
              <span className="wave-number">
                {String(displayIndex + 1).padStart(2, "0")}
              </span>
              <label className="wave-name">
                <span className="sr-only">Wave {displayIndex + 1} name</span>
                <input
                  aria-label={`Wave ${displayIndex + 1} name`}
                  value={w.name}
                  maxLength={120}
                  onChange={(e) =>
                    update((c) => ({
                      ...c,
                      waves: c.waves.map((v) =>
                        v.id === w.id ? { ...v, name: e.target.value } : v,
                      ),
                    }))
                  }
                />
              </label>
              <input
                type="color"
                aria-label={`Wave ${displayIndex + 1} color`}
                value={w.color}
                onChange={(e) =>
                  update((c) => ({
                    ...c,
                    waves: c.waves.map((v) =>
                      v.id === w.id ? { ...v, color: e.target.value } : v,
                    ),
                  }))
                }
              />
              <div className="wave-range">
                {i === 0 ? (
                  s.waves.length === 1 ? <span>All paces</span> : null
                ) : (
                  <><span aria-hidden="true">≥</span><Boundary
                    label={`Wave ${displayIndex + 1} minimum pace (inclusive)`}
                    value={s.waveRules.boundaries[i - 1]}
                    valid={(v) =>
                      validBoundary(s.waveRules.boundaries, i - 1, v)
                    }
                    commit={(v) => boundary(i - 1, v)}
                  /></>
                )}
                {i === s.waves.length - 1 ? (
                  null
                ) : (
                  <><span aria-hidden="true">&lt;</span><Boundary
                    label={`Wave ${displayIndex + 1} maximum pace (exclusive)`}
                    value={s.waveRules.boundaries[i]}
                    valid={(v) => validBoundary(s.waveRules.boundaries, i, v)}
                    commit={(v) => boundary(i, v)}
                  /></>
                )}
              </div>
              <TimeInput
                label={`Wave ${displayIndex + 1} start`}
                value={w.start}
                onChange={(start) =>
                  update((c) => ({
                    ...c,
                    waves: c.waves.map((v) =>
                      v.id === w.id ? { ...v, start } : v,
                    ),
                  }))
                }
              />
              <button className="wave-count quiet" aria-label={`View ${roster(s, w.id).length} included teams for wave ${displayIndex + 1}`} aria-expanded={openRoster === w.id} aria-controls={`roster-${w.id}`} onClick={()=>setOpenRoster(openRoster === w.id ? null : w.id)}>{roster(s, w.id).length} teams <span aria-hidden="true">{openRoster === w.id ? "⌃" : "⌄"}</span></button>
              <button
                className="quiet"
                aria-label={`Remove wave ${displayIndex + 1}`}
                disabled={s.waves.length === 1}
                onClick={() => {
                  setSplit(null);
                  update((c) => removeWave(c, i));
                }}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className="wave-members" id={`roster-${w.id}`} hidden={openRoster !== w.id}>
              <button className="small quiet" disabled={s.waves.length >= 51} onClick={() => beginSplit(i)}>Split this range</button>
              <ul className="wave-roster">
                {roster(s, w.id).map((p) => (
                  <li key={`${p.year}-${p.team}`}>
                    {p.team} · {p.year}
                    <strong>
                      {pace(p.overall_mean_pace_seconds_per_mile)} / mi
                    </strong>
                  </li>
                ))}
              </ul>
              {!roster(s, w.id).length && (
                <p className="muted">No selected teams in this wave.</p>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="table-note">Waves run slowest to fastest. Exact-boundary teams join the slower wave. Select a team count for its roster and range actions.</p>
      <div className="finish-target">
              <div className="field"><span>Target finish</span><TimeInput label="Target finish" value={s.release.targetFinish} onChange={targetFinish=>update(c=>({...c,release:{...c.release,targetFinish}}))}/></div>
              <label className="field"><span>Release pace · min:sec/mile</span><PaceInput label="Release pace" value={s.release.pace} onChange={pace=>update(c=>({...c,release:{...c.release,pace}}))}/></label>
              <div className="finish-guidance"><span className="field-label">Latest Wave 1 start</span><p className="start-guidance" role="status">{Number.isFinite(latestStart(s)) ? clock(latestStart(s), "down") : "Enter a valid finish target, pace, and challenge allowances."}</p><span className="muted">Includes challenge allowances</span></div>
              {orderedWaveEntries(s)[0].w.start > latestStart(s) && <p className="rule-failed">Wave 1 starts after the calculated latest start.</p>}
              <small>Planning estimate only. Gate openings and historical paces may produce later finishes. Your chosen start stays unchanged.</small>
      </div>
      {split && (
        <div
          className="range-preview"
          role="group"
          aria-label="Split wave range"
        >
          <h3>Split {s.waves[split.index]?.name}</h3>
          <label className="field">
            {firstSplit ? "Split teams faster than" : "New shared pace boundary"}
            <input
              aria-label={firstSplit ? "Split teams faster than" : "New shared pace boundary"}
              className="pace-input"
              value={split.text}
              onChange={(e) => setSplit({ ...split, text: e.target.value })}
            />
          </label>
          <p className="muted">
            {firstSplit
              ? "Teams faster than this pace move to the new wave. Teams at or slower than this pace stay in Wave 1 with its current start time."
              : "The new wave receives teams at or slower than this boundary within the original range."}
          </p>
          {!splitValid && (
            <p role="alert">
              Choose a positive m:ss pace strictly inside this range.
            </p>
          )}
          <button
            disabled={!splitValid}
            onClick={() => {
              if (!splitValid || splitValue === null) return;
              update((c) => {
                const waves = [...c.waves];
                waves.splice(c.waves.length === 1 ? split.index : split.index + 1, 0, {
                  id: crypto.randomUUID(),
                  name: `Wave ${c.waves.length + 1}`,
                  color: colors[c.waves.length % colors.length],
                  start: c.waves[split.index].start + 1800,
                });
                const boundaries = [...c.waveRules.boundaries];
                boundaries.splice(split.index, 0, splitValue);
                return syncAssignments({
                  ...c,
                  waves,
                  waveRules: { mode: "pace", boundaries },
                });
              });
              setSplit(null);
            }}
          >
            Confirm split
          </button>{" "}
          <button className="quiet" onClick={() => setSplit(null)}>
            Cancel split
          </button>
        </div>
      )}
    </>
  );
}
