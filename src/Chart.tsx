import { arrivalEnvelope } from "./chartComparison";
import { chartTicks, fullViewport, panViewport, regionViewport, zoomViewport, type ChartViewport, type PlotPoint } from "./chartViewport";
import { exchangeName, ruleTypes, ruleStatus } from "./timingRules";
import { orderedWaveEntries } from "./waves";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { bins, course, ORIGIN, resolveProfile } from "./data";
import { clock, pace } from "./format";
import { ExchangePopup, type PopupTarget } from "./ExchangePopup";
import { releasePace } from "./engine";
import type { LegTiming, Scenario, Simulation } from "./model";

interface Props {
  result: Simulation;
  comparison: Simulation;
  scenario: Scenario;
  overlay: boolean;
  setOverlay: (v: boolean) => void;
  active?: boolean;
}
export function Chart({
  result,
  comparison,
  scenario,
  overlay,
  setOverlay,
  active = true,
}: Props) {
  const [axis, setAxis] = useState<"miles" | "exchanges">("miles");
  const [viewport, setViewport] = useState<ChartViewport>(fullViewport);
  const [history, setHistory] = useState<ChartViewport[]>([]);
  const [tool, setTool] = useState<"inspect" | "zoom" | "pan">("inspect");
  const [selection, setSelection] = useState<{ start: PlotPoint; end: PlotPoint } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = useId();
  const [canvasWidth, setCanvasWidth] = useState(1160);
  const gesture = useRef<{ id: number; start: PlotPoint; end: PlotPoint; view: ChartViewport; moved: boolean } | null>(null);
  const zoom = 1 / Math.min(viewport.x1 - viewport.x0, viewport.y1 - viewport.y0);
  const [showRelease, setShowRelease] = useState(true);
  const [selectedId, setSelected] = useState("");
  const [popup, setPopup] = useState<PopupTarget | null>(null);
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
  }, [viewport, axis, selectedId, active, result, tool]);
  useEffect(() => {
    setViewport(fullViewport);
    setHistory([]);
    gesture.current = null;
    setSelection(null);
  }, [axis, result]);
  useEffect(() => {
    gesture.current = null;
    setSelection(null);
  }, [active, tool]);
  function inspectPointer(
    e: React.PointerEvent<SVGLineElement>,
    l: LegTiming,
    pinned = false,
  ) {
    if (tool !== "inspect" || (popup?.pinned && !pinned)) return;
    cancelClose();
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      e.currentTarget.getScreenCTM()!.inverse(),
    );
    const startDistance = Math.hypot(
      point.x - x(l.departure),
      point.y - y(l.leg - 1),
    );
    const endDistance = Math.hypot(point.x - x(l.arrival), point.y - y(l.leg));
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
  const selectedWave = scenario.waves.find(w => 'wave:' + w.id === selectedId)?.id ?? '';
  const highlight = selectedWave ? 'wave:' + selectedWave : selected;
  const emphasized = (t: { teamId: string; waveId: string }) => selectedWave ? t.waveId === selectedWave : t.teamId === selected;
  useEffect(() => {
    if (selectedId && !highlight) setSelected('');
  }, [selectedId, highlight]);
  const envelope = useMemo(() => arrivalEnvelope(comparison), [comparison]);
  const activeRules = scenario.timingRules.filter(r => r.enabled);
  const ruleLabelSpace = activeRules.length * 16;
  const width = canvasWidth,
    height = 550 + ruleLabelSpace,
    left = 68,
    right = width - 28,
    top = 32 + ruleLabelSpace,
    bottom = 484 + ruleLabelSpace;
  const extent = useMemo(() => {
    const all = [...result.teams, ...(overlay ? comparison.teams : [])];
    const times = all.flatMap((t) =>
      t.legs.flatMap((l) => [l.departure, l.arrival]),
    );
    if (showRelease)
      times.push(...result.releases, ...(overlay ? comparison.releases : []));
    const ruleTimes = scenario.timingRules.filter(r => r.enabled).map(r => r.time);
    times.push(...ruleTimes, scenario.release.targetFinish);
    const earliest = Math.min(ORIGIN, ...scenario.waves.map((w) => w.start), ...times);
    return {
      min: Math.floor((earliest - ORIGIN) / 3600),
      max: Math.max(4, Math.ceil((Math.max(ORIGIN, ...times) - ORIGIN) / 3600)),
    };
  }, [result, comparison, scenario.waves, scenario.timingRules, scenario.release.targetFinish, overlay, showRelease]);
  const visibleMin = extent.min + viewport.x0 * (extent.max - extent.min);
  const visibleMax = extent.min + viewport.x1 * (extent.max - extent.min);
  const courseMax = axis === "miles" ? 205.72 : 71;
  const yValue = (value: number) => bottom - ((value / courseMax - viewport.y0) / (viewport.y1 - viewport.y0)) * (bottom - top);
  const x = (seconds: number) =>
    left +
    (((seconds - ORIGIN) / 3600 - visibleMin) / (visibleMax - visibleMin)) *
      (right - left);
  const y = (exchange: number) => yValue(axis === "miles" ? (exchange ? course.legs[exchange - 1].cumulative_distance_miles : 0) : exchange);
  const colors = new Map(scenario.waves.map((w) => [w.id, w.color]));
  const ticks = chartTicks(visibleMin, visibleMax, Math.max(3, Math.floor((right-left)/85)));
  const yTicks = chartTicks(viewport.y0 * courseMax, viewport.y1 * courseMax, 8);
  if (viewport.y1 === 1 && !yTicks.includes(courseMax)) {
    if (courseMax - yTicks.at(-1)! < courseMax * (viewport.y1 - viewport.y0) / 25) yTicks.pop();
    yTicks.push(courseMax);
  }
  function changeView(next: ChartViewport, previous = viewport) {
    if (Object.keys(next).every(k => next[k as keyof ChartViewport] === previous[k as keyof ChartViewport])) return;
    setHistory(values => [...values.slice(-29), previous]);
    setViewport(next);
    setPopup(null);
  }
  function plotPoint(clientX: number, clientY: number): PlotPoint {
    const point = new DOMPoint(clientX, clientY).matrixTransform(svgRef.current!.getScreenCTM()!.inverse());
    return { x: Math.max(0, Math.min(1, (point.x - left) / (right - left))), y: Math.max(0, Math.min(1, (bottom - point.y) / (bottom - top))) };
  }
  function insidePlot(clientX: number, clientY: number) {
    const point = new DOMPoint(clientX, clientY).matrixTransform(svgRef.current!.getScreenCTM()!.inverse());
    return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
  }
  function beginGesture(e: React.PointerEvent<SVGSVGElement>) {
    if (tool === "inspect" || e.button !== 0 || !insidePlot(e.clientX, e.clientY) || gesture.current) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    const start = plotPoint(e.clientX, e.clientY);
    gesture.current = { id: e.pointerId, start, end: start, view: viewport, moved: false };
    setPopup(null);
    if (tool === "zoom") setSelection({ start, end: start });
  }
  function moveGesture(e: React.PointerEvent<SVGSVGElement>) {
    const drag = gesture.current;
    if (!drag || drag.id !== e.pointerId) return;
    e.preventDefault();
    const end = plotPoint(e.clientX, e.clientY);
    drag.end = end;
    drag.moved ||= Math.hypot(end.x - drag.start.x, end.y - drag.start.y) > 0.005;
    if (tool === "zoom") setSelection({ start: drag.start, end });
    else setViewport(panViewport(drag.view, end.x - drag.start.x, end.y - drag.start.y));
  }
  function finishGesture(e: React.PointerEvent<SVGSVGElement>, cancel = false) {
    const drag = gesture.current;
    if (!drag || drag.id !== e.pointerId) return;
    gesture.current = null;
    setSelection(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (cancel) { setViewport(drag.view); return; }
    if (tool === "zoom") {
      if (Math.abs(drag.end.x - drag.start.x) > 0.01 && Math.abs(drag.end.y - drag.start.y) > 0.01)
        changeView(regionViewport(drag.view, drag.start, drag.end), drag.view);
    } else if (drag.moved) changeView(panViewport(drag.view, drag.end.x - drag.start.x, drag.end.y - drag.start.y), drag.view);
  }
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      if (width > 0) setCanvasWidth(Math.max(280, width));
      gesture.current = null;
      setSelection(null);
      setPopup(null);
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [result.teams.length]);
  function chartKey(e: React.KeyboardEvent<SVGSVGElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Escape") {
      if (gesture.current) setViewport(gesture.current.view);
      gesture.current = null;
      setSelection(null);
      setPopup(null);
      return;
    }
    const moves: Record<string, [number, number]> = { ArrowLeft: [0.15, 0], ArrowRight: [-0.15, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] };
    if (moves[e.key]) { e.preventDefault(); changeView(panViewport(viewport, ...moves[e.key])); }
    if (["+", "=", "-", "0", "Home"].includes(e.key)) {
      e.preventDefault();
      changeView(e.key === "0" || e.key === "Home" ? fullViewport : zoomViewport(viewport, e.key === "-" ? 0.5 : 2));
    }
  }
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !active) return;
    function wheel(e: WheelEvent) {
      if ((tool === "inspect" && !e.ctrlKey && !e.metaKey) || gesture.current || !insidePlot(e.clientX, e.clientY)) return;
      e.preventDefault();
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      changeView(zoomViewport(viewport, Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.005), plotPoint(e.clientX, e.clientY)));
    }
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, [viewport, tool, active, result]);
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
            aria-label="Highlight wave or team"
            value={highlight}
            onChange={(e) => {
              setSelected(e.target.value);
            }}
          >
            <option value="">All teams</option>
            <optgroup label="Waves">
              {orderedWaveEntries(scenario).map(({ w }) => <option key={w.id} value={'wave:' + w.id}>{w.name}</option>)}
            </optgroup>
            <optgroup label="Teams">
            {result.teams.map((t) => (
              <option key={t.teamId} value={t.teamId}>
                {resolveProfile(scenario, t.teamId).team} ·{" "}
                {resolveProfile(scenario, t.teamId).year}
              </option>
            ))}
            </optgroup>
          </select>
        </label>
        <div className="chart-navigation" role="group" aria-label="Chart navigation">
          <div className="segmented" role="group" aria-label="Chart interaction">
            <button aria-pressed={tool === "inspect"} onClick={() => setTool("inspect")}>Inspect</button>
            <button aria-pressed={tool === "zoom"} onClick={() => setTool("zoom")}>Zoom region</button>
            <button aria-pressed={tool === "pan"} onClick={() => setTool("pan")}>Pan</button>
          </div>
          <button aria-label="Zoom in" title="Zoom in (+)" disabled={viewport.x1 - viewport.x0 <= 0.01000001 && viewport.y1 - viewport.y0 <= 0.01000001} onClick={() => changeView(zoomViewport(viewport, 2))}>+</button>
          <button aria-label="Zoom out" title="Zoom out (-)" disabled={zoom <= 1 + 1e-7} onClick={() => changeView(zoomViewport(viewport, 0.5))}>−</button>
          <span className="chart-zoom-level">{zoom.toFixed(1)}×</span>
          <button disabled={!history.length} onClick={() => { setViewport(history.at(-1)!); setHistory(values => values.slice(0, -1)); }}>Previous view</button>
          <button onClick={() => changeView(fullViewport)}>Reset view</button>
        </div>
      </div>
      <p className="chart-navigation-hint" id={clipId + "-hint"}>
        {tool === "inspect" ? "Hover or tap a line to inspect. Choose Zoom region to drag a box around an area." : tool === "zoom" ? "Drag a box to zoom into that region. Scroll or trackpad-pinch to zoom at the pointer." : "Drag to pan the chart. Scroll or pinch to zoom at the pointer."}
        {" "}Keyboard: + / − zoom, arrow keys pan, 0 resets, Escape cancels.
      </p>
      {!result.teams.length ? (
        <div className="empty">
          Select at least one team to see its course timeline.
        </div>
      ) : (
        <div
          className="chart-scroll"
          aria-label="Course timeline"
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: "100%", touchAction: tool === "inspect" ? "pan-y" : "none" }}
            className={`chart-canvas tool-${tool}`}
            tabIndex={0}
            aria-describedby={clipId + "-hint"}
            data-viewport={JSON.stringify(viewport)}
            onPointerDownCapture={beginGesture}
            onPointerMove={moveGesture}
            onPointerUp={e => finishGesture(e)}
            onPointerCancel={e => finishGesture(e, true)}
            onLostPointerCapture={e => finishGesture(e, true)}
            onKeyDown={chartKey}
            onDoubleClick={e => { if (tool !== "inspect" && insidePlot(e.clientX, e.clientY)) changeView(zoomViewport(viewport, e.shiftKey ? 0.5 : 2, plotPoint(e.clientX, e.clientY))); }}
            role="group"
            aria-label={`Course timeline for ${result.teams.length} teams. ${result.releaseCount} time releases. Last runner off course ${clock(result.lastOffCourse)}.`}
          >
            <defs><clipPath id={clipId}><rect x={left} y={top} width={right-left} height={bottom-top}/></clipPath></defs>
            <rect
              data-testid="chart-plot"
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
              const pos = yValue(v);
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
              ELAPSED HOURS FROM FRIDAY, 1:00 AM
            </text>
            <g clipPath={`url(#${clipId})`}>
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
            {overlay && envelope.length > 0 && (
              <g className="baseline-envelope" pointerEvents="none" aria-label="2026 baseline arrival spread">
                <path className="baseline-band" fill="#526b91" fillOpacity="0.1"
                  d={'M' + [...envelope.map(p => [x(p.earliest), y(p.index)]), ...[...envelope].reverse().map(p => [x(p.latest), y(p.index)])].map(p => p.join(',')).join('L') + 'Z'} />
                {(['earliest', 'latest'] as const).map(boundary => <path key={boundary}
                  className={'baseline-' + boundary} fill="none" stroke="#526b91" strokeWidth="2" opacity="0.9" strokeDasharray={boundary === 'earliest' ? '8 4' : '3 4'}
                  d={envelope.map((p, i) => (i ? 'L' : 'M') + x(p[boundary]) + ',' + y(p.index)).join('')} />)}
              </g>
            )}
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
                  opacity="0.16"
                  pointerEvents="none"
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
                  Number(emphasized(a)) - Number(emphasized(b)),
              )
              .map((t) => (
                <g
                  key={t.teamId}
                  className="team-trajectory"
                  data-team-id={t.teamId}
                  data-wave-id={t.waveId}
                  opacity={highlight ? (emphasized(t) ? 1 : 0.15) : 0.62}
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
                        strokeWidth={emphasized(t) ? 2.5 : 1.35}
                      />
                      {(!highlight || emphasized(t)) && (
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
                  r={3}
                  fill="#102e45"
                  stroke="white"
                  strokeWidth="1"
                  className="release-point"
                  data-release-leg={i + 1}
                  onPointerMove={(e) => {
                    if (tool !== "inspect" || popup?.pinned) return;
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
                    if (tool !== "inspect") return;
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
            <g className="finish-target-marker">
              <line x1={x(scenario.release.targetFinish)} x2={x(scenario.release.targetFinish)} y1={top} y2={bottom} stroke="#aa6230" strokeDasharray="5 5" />
              <circle cx={x(scenario.release.targetFinish)} cy={y(71)} r="6" fill="#aa6230" stroke="white" tabIndex={0} aria-label={`Target finish ${clock(scenario.release.targetFinish)}`}><title>Target finish {clock(scenario.release.targetFinish)}</title></circle>
            </g>
            {activeRules.map((rule, index) => {
              const evaluation = result.timingRules.find(r => r.ruleId === rule.id);
              const color = evaluation?.status === "failed" ? "#b42318" : rule.type === "depart-after" ? "#285d98" : "#a66b16";
              const label = `${index + 1}. EX ${rule.exchange} · ${exchangeName(rule.exchange)} · ${ruleTypes[rule.type]} ${clock(rule.time)} · ${ruleStatus(rule, evaluation)}`;
              return <g key={rule.id} className="chart-timing-rule" data-rule-id={rule.id}>
                <line x1={x(rule.time)} x2={x(rule.time)} y1={top} y2={bottom} stroke={color}
                  strokeWidth="1.5" strokeDasharray={rule.type === "depart-after" ? "3 5" : "8 4"} pointerEvents="none" />
                <text x={Math.min(x(rule.time), right - 100)} y={top + 14 + index * 16} fill={color} fontSize="11">
                  {index + 1}. {clock(rule.time)}
                </text>
                <circle cx={x(rule.time)} cy={y(rule.exchange)} r="5" fill="white" stroke={color} strokeWidth="2"
                  tabIndex={0} aria-label={label}><title>{label}</title></circle>
                {evaluation?.teams.filter(t => t.lateness > 0).map(t => <circle key={t.teamId}
                  className="deadline-violation" cx={x(t.actual)} cy={y(rule.exchange)} r="4" fill="#b42318"
                  stroke="white" strokeWidth="1" tabIndex={0}
                  aria-label={`${resolveProfile(scenario, t.teamId).team} late at EX ${rule.exchange}, ${clock(t.actual)}`}>
                  <title>{resolveProfile(scenario, t.teamId).team} · {clock(t.actual)} · late at EX {rule.exchange}</title>
                </circle>)}
              </g>;
            })}
            </g>
            {selection && <rect className="zoom-selection" pointerEvents="none"
              x={left + Math.min(selection.start.x, selection.end.x) * (right-left)}
              y={bottom - Math.max(selection.start.y, selection.end.y) * (bottom-top)}
              width={Math.abs(selection.end.x-selection.start.x) * (right-left)}
              height={Math.abs(selection.end.y-selection.start.y) * (bottom-top)}/>}
          </svg>
        </div>
      )}
      {!!activeRules.length && <ul className="timing-chart-legend">{activeRules.map((r, i) => <li key={r.id}>
        {i + 1}. EX {r.exchange} · {exchangeName(r.exchange)} — {ruleTypes[r.type]} {clock(r.time)}
      </li>)}</ul>}
      <div className="legend">
        <span><i style={{background:"#aa6230"}}/>Target finish · {clock(scenario.release.targetFinish)}</span>
        {orderedWaveEntries(scenario).map(({ w }) => (
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
          Opening wait
        </span>
        {overlay && (
          <>
            <span><i className="baseline-swatch"/>2026 baseline arrival spread</span>
            <span><i className="baseline-edge earliest"/>Earliest arrival</span>
            <span><i className="baseline-edge latest"/>Latest arrival</span>
            {showRelease && <span><i style={{ background: "#87918b" }}/>Baseline release schedule (dashed)</span>}
          </>
        )}
      </div>
      {overlay && <p className="baseline-note">Shaded band: earliest to latest arrivals at each exchange across the entire baseline field. Boundary teams may change; Start uses departure times.</p>}
      {popup && active && (
        <ExchangePopup
          scenario={scenario}
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
    </section>
  );
}
