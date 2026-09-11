import { useState } from "react";
import { colors, ORIGIN, profileById } from "./data";
import { clock, pace, parsePace } from "./format";
import {
  conversionPreview,
  removeWave,
  splitSuggestion,
  syncAssignments,
  validBoundary,
} from "./waves";
import type { Scenario } from "./model";

function WaveStartOffset({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (start: number) => void;
}) {
  const hours = (start: number) =>
    Number.isFinite(start) ? String((start - ORIGIN) / 3600) : "";
  const [text, setText] = useState(hours(value));
  const [previous, setPrevious] = useState(value);
  if (!Object.is(value, previous)) {
    setPrevious(value);
    setText(hours(value));
  }
  return (
    <label className="wave-start-offset">
      <span>Start offset · hours</span>
      <input
        aria-label={label}
        type="text"
        inputMode="decimal"
        value={text}
        aria-invalid={
          !Number.isFinite(value) ||
          value < -30 * 86400 ||
          value > 30 * 86400 - 1
        }
        onChange={(e) => {
          const raw = e.target.value;
          const offset = /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw.trim())
            ? Number(raw)
            : NaN;
          const start = ORIGIN + offset * 3600;
          setText(raw);
          setPrevious(start);
          onChange(start);
        }}
      />
      <output>
        {Number.isFinite(value)
          ? `${clock(value).replace(/^D/, "Day ")}${value < 0 && value >= -86400 ? " (previous day)" : ""}`
          : "Enter an hour offset"}
      </output>
    </label>
  );
}

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
  const [preview, setPreview] = useState(false);
  const automatic = s.waveRules.mode === "pace";
  const proposed = preview ? conversionPreview(s) : null;
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
      .map((id) => profileById.get(id)!)
      .sort(
        (a, b) =>
          a.overall_mean_pace_seconds_per_mile -
            b.overall_mean_pace_seconds_per_mile ||
          a.team.localeCompare(b.team) ||
          a.year - b.year,
      );
  return (
    <>
      <div className="subsection-head">
        <div>
          <h3>Set the field in motion</h3>
          <p className="muted">
            {automatic
              ? "Waves are ordered fastest to slowest. Start times remain independent."
              : "This saved configuration uses manual assignments. Convert to linked pace ranges when ready."}
          </p>
        </div>
        {automatic ? (
          <button
            disabled={s.waves.length >= 51}
            onClick={() => beginSplit(s.waves.length - 1)}
          >
            + Add wave
          </button>
        ) : (
          <button onClick={() => setPreview(true)}>Preview pace ranges</button>
        )}
      </div>
      <p className="table-note">
        Start offsets are relative to Day 1, 01:00. Use negative hours for
        earlier starts or positive hours for later starts; decimals are allowed.
        −3 = Day 0, 22:00; +3 = Day 1, 04:00. Waves starting after 01:00 run
        sequentially to the monument (after leg 35). Releases resume when each
        team arrives there.
      </p>
      {proposed && (
        <div className="range-preview">
          <h3>Preview automatic assignment</h3>
          <p>
            Wave order stays as listed. Applying these ranges replaces manual
            assignments.
          </p>
          {proposed.waves.map((w, i) => (
            <details key={w.id}>
              <summary>
                {w.name}:{" "}
                {i
                  ? pace(proposed.waveRules.boundaries[i - 1])
                  : "Any faster pace"}{" "}
                to{" "}
                {i < proposed.waves.length - 1
                  ? `< ${pace(proposed.waveRules.boundaries[i])}`
                  : "any slower pace"}{" "}
                · {roster(proposed, w.id).length} teams
              </summary>
              <ul className="wave-roster">
                {roster(proposed, w.id).map((p) => (
                  <li key={`${p.year}-${p.team}`}>
                    {p.team} · {p.year}{" "}
                    <strong>
                      {pace(p.overall_mean_pace_seconds_per_mile)}
                    </strong>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          <button
            onClick={() => {
              update(() => proposed);
              setPreview(false);
            }}
          >
            Apply pace ranges
          </button>{" "}
          <button className="quiet" onClick={() => setPreview(false)}>
            Cancel conversion
          </button>
        </div>
      )}
      <div className="wave-list">
        {s.waves.map((w, i) => (
          <div className="wave-card" key={w.id}>
            <div className="wave-row">
              <span className="wave-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <label className="wave-name">
                <span className="sr-only">Wave {i + 1} name</span>
                <input
                  aria-label={`Wave ${i + 1} name`}
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
                aria-label={`Wave ${i + 1} color`}
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
              <WaveStartOffset
                label={`Wave ${i + 1} start offset (hours)`}
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
              <span className="wave-count">{roster(s, w.id).length} teams</span>
              <button
                className="quiet"
                aria-label={`Remove wave ${i + 1}`}
                disabled={s.waves.length === 1}
                onClick={() => {
                  setSplit(null);
                  update((c) => removeWave(c, i));
                }}
              >
                Remove
              </button>
            </div>
            {automatic && (
              <div className="wave-range">
                {i === 0 ? (
                  <span>No lower pace limit</span>
                ) : (
                  <Boundary
                    label={`Wave ${i + 1} minimum pace (inclusive)`}
                    value={s.waveRules.boundaries[i - 1]}
                    valid={(v) =>
                      validBoundary(s.waveRules.boundaries, i - 1, v)
                    }
                    commit={(v) => boundary(i - 1, v)}
                  />
                )}
                {i === s.waves.length - 1 ? (
                  <span>No upper pace limit</span>
                ) : (
                  <Boundary
                    label={`Wave ${i + 1} maximum pace (exclusive)`}
                    value={s.waveRules.boundaries[i]}
                    valid={(v) => validBoundary(s.waveRules.boundaries, i, v)}
                    commit={(v) => boundary(i, v)}
                  />
                )}
                <button
                  className="small quiet"
                  disabled={s.waves.length >= 51}
                  onClick={() => beginSplit(i)}
                >
                  Split this range
                </button>
              </div>
            )}
            <details className="wave-members">
              <summary>View {roster(s, w.id).length} included teams</summary>
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
            </details>
          </div>
        ))}
      </div>
      {split && (
        <div
          className="range-preview"
          role="group"
          aria-label="Split wave range"
        >
          <h3>Split {s.waves[split.index]?.name}</h3>
          <label className="field">
            New shared pace boundary
            <input
              aria-label="New shared pace boundary"
              className="pace-input"
              value={split.text}
              onChange={(e) => setSplit({ ...split, text: e.target.value })}
            />
          </label>
          <p className="muted">
            The new wave receives teams at or slower than this boundary within
            the original range.
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
                waves.splice(split.index + 1, 0, {
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
      <p className="table-note">
        {automatic
          ? "Pace is min:sec per mile; lower is faster. Ranges share boundaries with no gaps. An exact-boundary team belongs to the slower range. Press Enter or leave a field to apply. Removing a wave merges into the previous range (or the next for the first wave)."
          : "Assign teams in Historical field. Your saved assignment remains unchanged until conversion."}
      </p>
    </>
  );
}
