import { orderedWaveEntries } from "./waves";
import { useEffect, useMemo, useState } from "react";
import { resolveProfile } from "./data";
import { clock, duration } from "./format";
import type { Scenario, Simulation } from "./model";
import { buildReplay } from "./replay";
import "./replay.css";

export function SpreadReplay({
  result,
  scenario,
}: {
  result: Simulation;
  scenario: Scenario;
}) {
  const data = useMemo(() => buildReplay(result), [result]);
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
    setIndex(0);
    setPlaying(false);
    setInspected("");
    setPinned("");
    if (!result.teams.some((t) => t.teamId === selected)) setSelected("");
  }
  const lastIndex = data.frames.length - 1;
  const frame = data.frames[index];
  const empty = !result.teams.length;
  useEffect(() => {
    if (!playing || empty) return;
    if (index === lastIndex && !loop) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(
      () => setIndex(index === lastIndex ? 0 : index + 1),
      interval * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [playing, empty, index, lastIndex, loop, interval, result]);
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
      aria-labelledby="replay-title"
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
          <h2 id="replay-title">Spread replay</h2>
        </div>
        <span className="badge">
          {result.teams.length} teams · Current scenario
        </span>
      </div>
      <p className="replay-caption">
        The last team stays at zero. The leader moves right as the spread grows.
        Each step compares arrivals at one exchange.
      </p>
      <div className="replay-frame-heading" aria-live="polite">
        <div>
          <span className="eyebrow">{frameLabel}</span>
          <h3>{frame.name}</h3>
        </div>
        <dl className="replay-metrics">
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
        </dl>
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
        {orderedWaveEntries(scenario).map(({ w: wave }) => (
          <span key={wave.id}>
            <i style={{ background: wave.color }} />
            {wave.name}
          </span>
        ))}
      </div>
      <div
        className="replay-detail"
        id="replay-detail"
        aria-label="Replay team details"
      >
        {detail && profile ? (
          <>
            <strong>
              {profile.team} · {profile.year}
            </strong>
            <span>{waves.get(detail.waveId)?.name}</span>
            <span>
              {index === 0 ? "Start" : "Arrival"}: {clock(detail.time)}
            </span>
            <span>Ahead of last: {duration(detail.ahead)}</span>
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
            Hover, tap, or focus a dot to inspect a team. Overlapping dots share
            the same line; use team search or Tab to inspect a hidden team.
          </span>
        )}
      </div>
      {empty && (
        <p className="replay-empty" role="status">
          Select historical teams to replay their spread.
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
                  className={`replay-marker${selected === marker.teamId || pinned === marker.teamId ? " is-highlighted" : ""}`}
                  data-team-id={marker.teamId}
                  data-ahead={marker.ahead}
                  style={{
                    left: `${(marker.ahead / data.axisSeconds) * 100}%`,
                    background: wave.color,
                    opacity: selected && selected !== marker.teamId ? 0.3 : 1,
                  }}
                  aria-label={`${p.team}, ${p.year}, ${wave.name}, ${index === 0 ? "start" : "arrival"} ${clock(marker.time)}, ${duration(marker.ahead)} ahead of last`}
                  aria-describedby={
                    detail?.teamId === marker.teamId
                      ? "replay-detail"
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
      <div className="replay-axis-label">Time ahead of last team (hours) →</div>
    </section>
  );
}
