import { buildHistoricalReplay, yearColors } from "./historicalReplayData";
import { orderedWaveEntries } from "./waves";
import { useEffect, useId, useMemo, useState } from "react";
import { resolveProfile } from "./data";
import { clock, duration } from "./format";
import type { Scenario, Simulation } from "./model";
import { buildReplay } from "./replay";
import "./replay.css";

export function SpreadReplay({
  result,
  scenario,
  active = true,
  historical = false,
}: {
  result: Simulation;
  scenario: Scenario;
  active?: boolean;
  historical?: boolean;
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const detailId = `${id}-detail`;
  const data = useMemo(() => historical ? buildHistoricalReplay(result) : buildReplay(result), [result, historical]);
  const [source, setSource] = useState(result);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [interval, setIntervalSeconds] = useState(1);
  const [loop, setLoop] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [inspected, setInspected] = useState("");
  const [pinned, setPinned] = useState("");
  // Reset before rendering new simulation data, including while a timer is active.
  if (source !== result) {
    setSource(result);
    if (!historical) setIndex(0);
    setPlaying(false);
    setInspected("");
    setPinned("");
    if (!result.teams.some((t) => t.teamId === selected)) setSelected("");
  }
  const lastIndex = data.frames.length - 1;
  const frame = data.frames[index];
  const empty = !result.teams.length;
  useEffect(() => { if (!active) setPlaying(false); }, [active]);
  useEffect(() => {
    if (!active || !playing || empty) return;
    if (index === lastIndex && !loop) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(
      () => setIndex(index === lastIndex ? 0 : index + 1),
      interval * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [active, playing, empty, index, lastIndex, loop, interval, result]);
  const waves = new Map(scenario.waves.map((wave) => [wave.id, wave]));
  const detail = frame.markers.find(
    (m) => m.teamId === (inspected || pinned || selected),
  );
  const profile = detail ? resolveProfile(scenario, detail.teamId) : undefined;
  const options = result.teams.filter((t) => {
    const p = resolveProfile(scenario, t.teamId);
    return (
      t.teamId === selected ||
      `${p.team} ${p.year}`.toLowerCase().includes(query.toLowerCase())
    );
  });
  const frameLabel =
    index === 0
      ? "Start"
      : index === lastIndex
        ? `Finish · Exchange ${index}`
        : `Exchange ${index}`;
  function jump(next: number) {
    setPlaying(false);
    setIndex(next);
  }
  return (
    <section
      className="panel spread-replay"
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setPinned("");
          setInspected("");
          setSelected("");
        }
      }}
    >
      <div className="section-head">
        <div>
          <div className="eyebrow">02 / VISUALIZE</div>
          <h2 id={titleId}>{historical ? "Historical replay" : "Spread replay"}</h2>
        </div>
        <span className="badge">
          {result.teams.length} teams · {historical ? "Published baseline" : "Current scenario"}
        </span>
      </div>
      <p className="replay-caption">
        {historical ? "Recorded leg paces replayed using published baseline rules. Each year’s last team stays at zero." : "The last team stays at zero."} The leader moves right as the spread grows.
        Each step compares arrivals at one exchange.
      </p>
      <div className="replay-frame-heading" aria-live="polite">
        <div>
          <span className="eyebrow">{frameLabel}</span>
          <h3>{frame.name}</h3>
        </div>
        {historical ? <div className="replay-year-metrics">{frame.years?.map(y => <div key={y.year} data-year={y.year}>
          <strong style={{ color: yearColors[y.year] }}>{y.year}</strong>
          <dl className="replay-metrics">
            <div><dt>{index === 0 ? "First start" : "First arrival"}</dt><dd>{clock(y.first)}</dd></div>
            <div><dt>{index === 0 ? "Last start" : "Last arrival"}</dt><dd>{clock(y.last)}</dd></div>
            <div><dt>Spread</dt><dd>{duration(y.spread)}</dd></div>
          </dl>
        </div>)}</div> : <dl className="replay-metrics">
          <div>
            <dt>{index === 0 ? "First start" : "First arrival"}</dt>
            <dd data-testid="replay-first">{clock(frame.first)}</dd>
          </div>
          <div>
            <dt>{index === 0 ? "Last start" : "Last arrival"}</dt>
            <dd data-testid="replay-last">{clock(frame.last)}</dd>
          </div>
          <div>
            <dt>Total spread</dt>
            <dd data-testid="replay-spread">
              {empty ? "—" : duration(frame.spread)}
            </dd>
          </div>
        </dl>}
      </div>
      <div className="replay-controls">
        <div className="replay-buttons">
          <button
            disabled={empty || index === 0}
            onClick={() => jump(index - 1)}
          >
            Previous
          </button>
          <button
            className="primary"
            disabled={empty}
            onClick={() => {
              if (!playing && index === lastIndex) setIndex(0);
              setPlaying(!playing);
            }}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button
            disabled={empty || index === lastIndex}
            onClick={() => jump(index + 1)}
          >
            Next
          </button>
          <button disabled={empty} onClick={() => jump(0)}>
            Reset
          </button>
        </div>
        <label>
          Seconds per exchange
          <select
            aria-label="Seconds per exchange"
            value={interval}
            onChange={(e) => setIntervalSeconds(Number(e.target.value))}
          >
            {[0.25, 0.5, 1, 2, 3, 5].map((v) => (
              <option key={v} value={v}>
                {v} sec
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => setLoop(e.target.checked)}
          />
          Loop
        </label>
      </div>
      <label className="replay-scrubber">
        Exchange{" "}
        <output>
          {index} / {lastIndex}
        </output>
        <input
          aria-label="Replay exchange"
          aria-valuetext={`${frameLabel}: ${frame.name}`}
          type="range"
          min={0}
          max={lastIndex}
          step={1}
          value={index}
          disabled={empty}
          onChange={(e) => jump(Number(e.target.value))}
        />
      </label>
      <div className="replay-team-controls">
        <label>
          Find a team
          <input
            type="search"
            placeholder="Team or year"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Highlight replay team
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setPinned("");
              setInspected("");
            }}
          >
            <option value="">
              All teams{query ? ` · ${options.length} matches` : ""}
            </option>
            {options.map((t) => {
              const p = resolveProfile(scenario, t.teamId);
              return (
                <option key={t.teamId} value={t.teamId}>
                  {p.team} · {p.year}
                </option>
              );
            })}
          </select>
        </label>
      </div>
      <div className="replay-legend">
        {historical ? frame.years?.map(y => <span key={y.year}><i style={{ background: yearColors[y.year] }}/>{y.year}</span>) : orderedWaveEntries(scenario).map(({ w: wave }) => (
          <span key={wave.id}>
            <i style={{ background: wave.color }} />
            {wave.name}
          </span>
        ))}
      </div>
      {historical && <p className="replay-shape-legend">● Circle: arrival at or before release · ◆ Diamond: arrival after release. Start and Finish use circles.</p>}
      <div
        className="replay-detail"
        id={detailId}
        aria-label="Replay team details"
      >
        {detail && profile ? (
          <>
            <strong>
              {profile.team} · {profile.year}
            </strong>
            {!historical && <span>{waves.get(detail.waveId)?.name}</span>}
            <span>
              {index === 0 ? "Start" : "Arrival"}: {clock(detail.time)}
            </span>
            <span>Ahead of {historical ? "year’s last" : "last"}: {duration(detail.ahead)}</span>
            {historical && detail.release !== undefined && <>
              <span>Published release: {clock(detail.release)}</span>
              <span>Time late: {duration(detail.late!)}</span>
              <span>Another runner departed before arrival: {detail.overlaps ? "Yes" : "No"}</span>
            </>}
            <button
              className="quiet"
              aria-label="Clear replay inspection"
              onClick={() => {
                setPinned("");
                setInspected("");
                setSelected("");
              }}
            >
              ×
            </button>
          </>
        ) : (
          <span>
            Hover, tap, or focus a marker to inspect a team. Overlapping markers share
            the same line; use team search or Tab to inspect a hidden team.
          </span>
        )}
      </div>
      {empty && (
        <p className="replay-empty" role="status">
          {historical ? "Select one or more years to replay their spread." : "Select historical teams to replay their spread."}
        </p>
      )}
      <div className="replay-scroll" tabIndex={0} aria-label="Team spread plot">
        <div className="replay-canvas">
          <div className="replay-track">
            <div className="replay-baseline" aria-hidden="true" />
            {Array.from({ length: 6 }, (_, n) => (
              <div
                aria-hidden="true"
                key={n}
                className="replay-gridline"
                style={{ left: `${n * 20}%` }}
              />
            ))}
            {frame.markers.map((marker) => {
              const p = resolveProfile(scenario, marker.teamId);
              const wave = waves.get(marker.waveId)!;
              return (
                <button
                  key={marker.teamId}
                  className={`replay-marker${historical && marker.late! > 0 ? " is-diamond" : ""}${selected === marker.teamId || pinned === marker.teamId ? " is-highlighted" : ""}`}
                  data-team-id={marker.teamId}
                  data-ahead={marker.ahead}
                  style={{
                    left: `${(marker.ahead / data.axisSeconds) * 100}%`,
                    background: historical ? yearColors[Number(p.year)] : wave.color,
                    opacity: selected && selected !== marker.teamId ? 0.3 : 1,
                  }}
                  aria-label={`${p.team}, ${p.year}, ${historical ? (marker.late! > 0 ? "diamond, arrival after release" : "circle") : wave.name}, ${index === 0 ? "start" : "arrival"} ${clock(marker.time)}, ${duration(marker.ahead)} ahead of ${historical ? "year’s last team" : "last"}`}
                  aria-describedby={
                    detail?.teamId === marker.teamId
                      ? detailId
                      : undefined
                  }
                  aria-pressed={pinned === marker.teamId}
                  onPointerEnter={() => setInspected(marker.teamId)}
                  onPointerLeave={() => setInspected("")}
                  onFocus={() => setInspected(marker.teamId)}
                  onBlur={() => setInspected("")}
                  onClick={() =>
                    setPinned(pinned === marker.teamId ? "" : marker.teamId)
                  }
                ></button>
              );
            })}
          </div>
          <div className="replay-axis" data-axis-seconds={data.axisSeconds}>
            {Array.from({ length: 6 }, (_, n) => (
              <span key={n} style={{ left: `${n * 20}%` }}>
                {Number((((n / 5) * data.axisSeconds) / 3600).toPrecision(3))}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="replay-axis-label">Time ahead of {historical ? "each year’s last team" : "last team"} (hours) →</div>
    </section>
  );
}
