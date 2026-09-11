import { useEffect, useMemo, useRef, useState } from "react";
import { bins, course, ORIGIN, profileById } from "./data";
import { clock, duration, elapsed, pace } from "./format";
import { ExchangePopup, type PopupTarget } from "./ExchangePopup";
import { releasePace } from "./engine";
import type { LegTiming, Scenario, Simulation } from "./model";

interface Props {
  result: Simulation;
  comparison: Simulation;
  scenario: Scenario;
  overlay: boolean;
  setOverlay: (v: boolean) => void;
}
export function Chart({
  result,
  comparison,
  scenario,
  overlay,
  setOverlay,
}: Props) {
  const [axis, setAxis] = useState<"miles" | "exchanges">("miles");
  const [zoom, setZoom] = useState(1);
  const [showRelease, setShowRelease] = useState(true);
  const [selectedId, setSelected] = useState("");
  const [inspectLeg, setInspectLeg] = useState(1);
  const [hover, setHover] = useState<LegTiming | null>(null);
  const [popup, setPopup] = useState<PopupTarget | null>(null);
  const [inspectExchange, setInspectExchange] = useState(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }
  function leavePopup() {
    cancelClose();
    closeTimer.current = setTimeout(
      () => setPopup((v) => (v?.pinned ? v : null)),
      180,
    );
  }
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );
  useEffect(() => {
    setPopup(null);
  }, [zoom, axis, selectedId]);
  function inspectPointer(
    e: React.PointerEvent<SVGLineElement>,
    l: LegTiming,
    pinned = false,
  ) {
    if (popup?.pinned && !pinned) return;
    cancelClose();
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      e.currentTarget.getScreenCTM()!.inverse(),
    );
    const startDistance = Math.hypot(
      point.x - x(l.departure),
      point.y - y(l.leg - 1),
    );
    const endDistance = Math.hypot(point.x - x(l.arrival), point.y - y(l.leg));
    setHover(l);
    setPopup({
      teamId: l.teamId,
      leg: l.leg,
      index: startDistance <= endDistance ? l.leg - 1 : l.leg,
      x: e.clientX,
      y: e.clientY,
      pinned,
    });
  }

  const selected = result.teams.some((t) => t.teamId === selectedId)
    ? selectedId
    : "";
  const selectedTeam = result.teams.find((t) => t.teamId === selected);
  const hoveredLeg = hover
    ? result.teams.find((t) => t.teamId === hover.teamId)?.legs[hover.leg - 1]
    : undefined;
  const detail = hoveredLeg ?? selectedTeam?.legs[inspectLeg - 1];
  const width = 1160 * zoom,
    height = 550,
    left = 68,
    right = width - 28,
    top = 32,
    bottom = 484;
  const extent = useMemo(() => {
    const all = [...result.teams, ...(overlay ? comparison.teams : [])];
    const times = all.flatMap((t) =>
      t.legs.flatMap((l) => [l.departure, l.arrival]),
    );
    if (showRelease)
      times.push(...result.releases, ...(overlay ? comparison.releases : []));
    const earliest = Math.min(ORIGIN, ...scenario.waves.map((w) => w.start));
    return {
      min: Math.floor((earliest - ORIGIN) / 3600),
      max: Math.max(4, Math.ceil((Math.max(ORIGIN, ...times) - ORIGIN) / 3600)),
    };
  }, [result, comparison, scenario.waves, overlay, showRelease]);
  const x = (seconds: number) =>
    left +
    (((seconds - ORIGIN) / 3600 - extent.min) / (extent.max - extent.min)) *
      (right - left);
  const y = (exchange: number) =>
    bottom -
    (axis === "miles"
      ? (exchange ? course.legs[exchange - 1].cumulative_distance_miles : 0) /
        205.72
      : exchange / 71) *
      (bottom - top);
  const colors = new Map(scenario.waves.map((w) => [w.id, w.color]));
  const step = Math.max(1, Math.ceil((extent.max - extent.min) / (12 * zoom)));
  const ticks: number[] = [];
  for (let h = Math.ceil(extent.min / step) * step; h <= extent.max; h += step)
    ticks.push(h);
  if (ticks[0] !== extent.min) ticks.unshift(extent.min);
  const yTicks =
    axis === "miles"
      ? [0, 25, 50, 75, 100, 125, 150, 175, 200, 205.72]
      : [0, 10, 20, 30, 40, 50, 60, 71];
  return (
    <section className="panel trajectory" aria-labelledby="trajectory-title">
      <div className="section-head">
        <div>
          <div className="eyebrow">02 / VISUALIZE</div>
          <h2 id="trajectory-title">The field, over time</h2>
        </div>
        <div className="inline-controls">
          <label className="check">
            <input
              type="checkbox"
              checked={overlay}
              onChange={(e) => setOverlay(e.target.checked)}
            />
            2026 baseline
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={showRelease}
              onChange={(e) => setShowRelease(e.target.checked)}
            />
            Release schedule
          </label>
        </div>
      </div>
      <div className="chart-toolbar">
        <div className="segmented" aria-label="Vertical axis">
          <button
            aria-pressed={axis === "miles"}
            onClick={() => setAxis("miles")}
          >
            Distance
          </button>
          <button
            aria-pressed={axis === "exchanges"}
            onClick={() => setAxis("exchanges")}
          >
            Exchanges
          </button>
        </div>
        <label className="inline-label">
          Highlight
          <select
            aria-label="Highlight team"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setHover(null);
            }}
          >
            <option value="">All selected teams</option>
            {result.teams.map((t) => (
              <option key={t.teamId} value={t.teamId}>
                {profileById.get(t.teamId)!.team} ·{" "}
                {profileById.get(t.teamId)!.year}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-label zoom">
          Zoom
          <input
            aria-label="Chart zoom"
            type="range"
            min="1"
            max="4"
            step="0.5"
            value={zoom}
            onChange={(e) => setZoom(+e.target.value)}
          />
          <span>{zoom}×</span>
        </label>
        <button
          className="quiet"
          onClick={() => {
            setZoom(1);
            setSelected("");
            setHover(null);
          }}
        >
          Reset view
        </button>
      </div>
      {!result.teams.length ? (
        <div className="empty">
          Select at least one team to see its course timeline.
        </div>
      ) : (
        <div
          className="chart-scroll"
          tabIndex={0}
          aria-label="Course timeline. Scroll horizontally when zoomed. Use Highlight team and Inspect leg for keyboard timing details."
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: `${zoom * 100}%`, minWidth: 800 }}
            role="group"
            aria-label={`Course timeline for ${result.teams.length} teams. ${result.releaseCount} time releases. Last runner off course ${clock(result.lastOffCourse)}.`}
          >
            <rect
              x={left}
              y={top}
              width={right - left}
              height={bottom - top}
              fill="#fafbf8"
            />
            {ticks.map((h) => (
              <g key={h}>
                <line
                  x1={x(ORIGIN + h * 3600)}
                  x2={x(ORIGIN + h * 3600)}
                  y1={top}
                  y2={bottom}
                  stroke="#e3e8e2"
                />
                <text
                  x={x(ORIGIN + h * 3600)}
                  y={bottom + 26}
                  textAnchor="middle"
                  className="chart-tick"
                >
                  {h}h
                </text>
              </g>
            ))}
            {yTicks.map((v) => {
              const pos =
                bottom -
                (v / (axis === "miles" ? 205.72 : 71)) * (bottom - top);
              return (
                <g key={v}>
                  <line
                    x1={left}
                    x2={right}
                    y1={pos}
                    y2={pos}
                    stroke="#e3e8e2"
                  />
                  <text
                    x={left - 12}
                    y={pos + 4}
                    textAnchor="end"
                    className="chart-tick"
                  >
                    {v === 205.72 ? "Finish" : v}
                  </text>
                </g>
              );
            })}
            <text x={left} y={16} className="chart-caption">
              {axis === "miles" ? "MILES" : "EXCHANGE"}
            </text>
            <text
              x={(left + right) / 2}
              y={height - 13}
              textAnchor="middle"
              className="chart-caption"
            >
              ELAPSED HOURS FROM DAY 1, 01:00
            </text>
            {bins.slice(1).map((bin) => (
              <g key={bin.bin_id} pointerEvents="none">
                <line
                  x1={left}
                  x2={right}
                  y1={y(bin.first_leg - 1)}
                  y2={y(bin.first_leg - 1)}
                  stroke="#b4c4db"
                  strokeDasharray="2 5"
                />
                <text
                  x={left + 5}
                  y={y(bin.first_leg - 1) - 5}
                  className="chart-annotation"
                >
                  PACE BIN · LEG {bin.first_leg}
                </text>
              </g>
            ))}
            {[35, 53, 69].map((index) => (
              <g key={index}>
                <line
                  x1={left}
                  x2={right}
                  y1={y(index)}
                  y2={y(index)}
                  stroke="#a6b6ab"
                  strokeDasharray="3 5"
                />
                <text
                  x={right - 5}
                  y={y(index) - 5}
                  textAnchor="end"
                  className="chart-annotation"
                >
                  {index === 35
                    ? "MONUMENT"
                    : index === 53
                      ? "LIGHTHOUSE"
                      : "JBCC GATE"}
                </text>
              </g>
            ))}
            {overlay &&
              comparison.teams.map((t) => (
                <path
                  key={t.teamId}
                  d={t.legs
                    .map(
                      (l) =>
                        `M${x(l.departure)},${y(l.leg - 1)}L${x(l.arrival)},${y(l.leg)}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke="#87918b"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity={
                    selected ? (t.teamId === selected ? 0.85 : 0.08) : 0.22
                  }
                />
              ))}
            {showRelease && overlay && (
              <path
                d={comparison.releases
                  .map((r, i) => `${i ? "L" : "M"}${x(r)},${y(i)}`)
                  .join(" ")}
                fill="none"
                stroke="#87918b"
                strokeDasharray="6 4"
                strokeWidth="2"
              />
            )}
            {showRelease && (
              <path
                d={result.releases
                  .map((r, i) => `${i ? "L" : "M"}${x(r)},${y(i)}`)
                  .join(" ")}
                fill="none"
                stroke="#102e45"
                strokeDasharray="8 3"
                strokeWidth="3"
              />
            )}
            {[...result.teams]
              .sort(
                (a, b) =>
                  Number(a.teamId === selected) - Number(b.teamId === selected),
              )
              .map((t) => (
                <g
                  key={t.teamId}
                  opacity={selected ? (t.teamId === selected ? 1 : 0.1) : 0.62}
                >
                  {t.legs.map((l) => (
                    <g key={l.leg}>
                      {l.challengeWait > 0 && (
                        <line
                          x1={x(l.waitStart)}
                          x2={x(l.waitStart + l.challengeWait)}
                          y1={y(l.leg - 1)}
                          y2={y(l.leg - 1)}
                          stroke="#d27b35"
                          strokeWidth="3"
                        />
                      )}
                      {l.gateWait > 0 && (
                        <line
                          x1={x(l.departure - l.gateWait)}
                          x2={x(l.departure)}
                          y1={y(l.leg - 1)}
                          y2={y(l.leg - 1)}
                          stroke="#a04e7d"
                          strokeWidth="3"
                        />
                      )}
                      <line
                        x1={x(l.departure)}
                        x2={x(l.arrival)}
                        y1={y(l.leg - 1)}
                        y2={y(l.leg)}
                        stroke={colors.get(t.waveId)}
                        strokeWidth={t.teamId === selected ? 2.5 : 1.35}
                      />
                      {(!selected || t.teamId === selected) && (
                        <line
                          x1={x(l.departure)}
                          x2={x(l.arrival)}
                          y1={y(l.leg - 1)}
                          y2={y(l.leg)}
                          stroke="transparent"
                          strokeWidth="7"
                          className="hit-line"
                          data-team-id={t.teamId}
                          data-leg={l.leg}
                          onPointerMove={(e) => inspectPointer(e, l)}
                          onPointerLeave={leavePopup}
                          onPointerDown={(e) => inspectPointer(e, l, true)}
                        />
                      )}
                    </g>
                  ))}
                </g>
              ))}
            {showRelease &&
              result.releases.map((r, i) => (
                <circle
                  key={`release-${i}`}
                  cx={x(r)}
                  cy={y(i)}
                  r={
                    scenario.release.mode === "visual" &&
                    bins.some((b) => b.first_leg === i + 1)
                      ? 5
                      : 3
                  }
                  fill="#102e45"
                  stroke="white"
                  strokeWidth="1"
                  className="release-point"
                  data-release-leg={i + 1}
                  onPointerMove={(e) => {
                    if (popup?.pinned) return;
                    cancelClose();
                    setPopup({
                      index: i,
                      leg: i + 1,
                      x: e.clientX,
                      y: e.clientY,
                      pinned: false,
                      release: true,
                    });
                  }}
                  onPointerLeave={leavePopup}
                  onPointerDown={(e) => {
                    cancelClose();
                    setPopup({
                      index: i,
                      leg: i + 1,
                      x: e.clientX,
                      y: e.clientY,
                      pinned: true,
                      release: true,
                    });
                  }}
                />
              ))}
            {showRelease &&
              scenario.release.mode === "visual" &&
              bins.map((b) => (
                <text
                  key={`pace-${b.bin_id}`}
                  x={Math.min(
                    right - 55,
                    x(result.releases[b.first_leg - 1]) + 8,
                  )}
                  y={y(b.first_leg - 1) - 8}
                  className="release-pace-label"
                  pointerEvents="none"
                >
                  {pace(releasePace(scenario, b.first_leg))}/mi
                </text>
              ))}
          </svg>
        </div>
      )}
      <div className="legend">
        {scenario.waves.map((w) => (
          <span key={w.id}>
            <i style={{ background: w.color }} />
            {w.name}
          </span>
        ))}
        <span>
          <i className="dashed" />
          Release schedule
        </span>
        <span>
          <i style={{ background: "#d27b35" }} />
          Challenge wait
        </span>
        <span>
          <i style={{ background: "#a04e7d" }} />
          JBCC wait
        </span>
        {overlay && (
          <span>
            <i style={{ background: "#87918b" }} />
            2026 baseline (dashed)
          </span>
        )}
      </div>
      <p className="chart-explanation">
        Historical pace is constant within each of five leg bins: distance/time
        sections are straight until pace, a release, or a wait changes the
        trajectory. Exchange view gives unequal-distance legs equal height,
        making slopes more varied. Each segment remains one runner’s travel.
      </p>
      <div className="exchange-inspector">
        <label className="inline-label">
          Inspect exchange
          <select
            aria-label="Inspect exchange"
            value={inspectExchange}
            onChange={(e) => {
              setInspectExchange(+e.target.value);
              setPopup(null);
            }}
          >
            {result.exchanges.map((e) => (
              <option key={e.index} value={e.index}>
                {e.index} · {e.name}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!result.teams.length}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setPopup({
              index: inspectExchange,
              leg: inspectExchange === 71 ? 71 : inspectExchange + 1,
              teamId: selected || result.teams[0]?.teamId,
              x: rect.left,
              y: rect.top,
              pinned: true,
            });
          }}
        >
          Show exchange details
        </button>
        <small className="muted">
          Shows the spread across all selected teams.
        </small>
      </div>
      {popup && (
        <ExchangePopup
          target={popup}
          result={result}
          close={() => {
            cancelClose();
            setPopup(null);
          }}
          pin={() => setPopup({ ...popup, pinned: true })}
          enter={cancelClose}
          leave={leavePopup}
        />
      )}
      <div className="inspection">
        <label className="inline-label">
          Inspect leg
          <select
            aria-label="Inspect leg"
            value={inspectLeg}
            onChange={(e) => {
              setInspectLeg(+e.target.value);
              setHover(null);
            }}
          >
            {course.legs.map((l) => (
              <option key={l.leg_number} value={l.leg_number}>
                {l.leg_number} · {l.start_location}
              </option>
            ))}
          </select>
        </label>
        {detail ? (
          <div className="timing-detail">
            <strong>
              {profileById.get(detail.teamId)!.team} ·{" "}
              {profileById.get(detail.teamId)!.year} / Leg {detail.leg}
            </strong>
            <span>
              Depart {clock(detail.departure)} ({elapsed(detail.departure)}) →
              arrive {clock(detail.arrival)} ({elapsed(detail.arrival)})
            </span>
            <span>
              Moving {duration(detail.duration)} · release{" "}
              {clock(detail.releaseTime)}
              {detail.releaseSuppressed
                ? " (suppressed until monument arrival)"
                : detail.releaseUsed
                  ? " (used)"
                  : ""}{" "}
              · challenge {duration(detail.challengeWait)} · gate{" "}
              {duration(detail.gateWait)}
            </span>
            {selectedTeam && (
              <span>
                Team moving {duration(selectedTeam.movingTime)} · final leg{" "}
                {clock(selectedTeam.finish)} · all legs complete{" "}
                {clock(selectedTeam.allComplete)}
              </span>
            )}
          </div>
        ) : (
          <p className="muted">
            Hover a leg for timings, or highlight a team and choose a leg. Each
            line is one runner’s travel; overlapping legs remain visible.
          </p>
        )}
      </div>
    </section>
  );
}
