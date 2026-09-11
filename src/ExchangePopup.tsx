import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { profileById } from "./data";
import { exchangeSummaries, releasePace } from "./engine";
import { clock, delta, duration, pace } from "./format";
import type { ExchangeSummary, Scenario, Simulation } from "./model";

export interface PopupTarget {
  teamId?: string;
  leg: number;
  index: number;
  x: number;
  y: number;
  pinned: boolean;
  release?: boolean;
}
const spread = (first: number | null, last: number | null) =>
  first === null || last === null ? "—" : duration(last - first);
export function ExchangePopup({
  target,
  scenario,
  result,
  comparison,
  overlay,
  close,
  pin,
  enter,
  leave,
}: {
  target: PopupTarget;
  scenario: Scenario;
  result: Simulation;
  comparison: Simulation;
  overlay: boolean;
  close: () => void;
  pin: () => void;
  enter: () => void;
  leave: () => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({
    left: target.x + 14,
    top: target.y + 14,
  });
  const team = result.teams.find((t) => t.teamId === target.teamId);
  const wave = scenario.waves.find((w) => w.id === team?.waveId);
  const field = result.exchanges[target.index];
  const waveTeams = result.teams.filter((t) => t.waveId === team?.waveId);
  const waveSummary = wave
    ? exchangeSummaries(waveTeams, scenario.buffers)[target.index]
    : null;
  const incoming = target.index ? team?.legs[target.index - 1] : undefined;
  const outgoing = team?.legs[target.index];
  const profile = target.teamId ? profileById.get(target.teamId) : undefined;
  useLayoutEffect(() => {
    const rect = element.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      left: Math.max(
        8,
        Math.min(target.x + 14, window.innerWidth - rect.width - 8),
      ),
      top: Math.max(
        8,
        Math.min(target.y + 14, window.innerHeight - rect.height - 8),
      ),
    });
  }, [target, result, overlay]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    function outside(e: PointerEvent) {
      if (target.pinned && !element.current?.contains(e.target as Node))
        close();
    }
    function scroll(e: Event) {
      if (!target.pinned && !element.current?.contains(e.target as Node))
        close();
    }
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", close);
    };
  }, [close, target.pinned]);
  if (!field || (target.teamId && !team)) return null;
  const rows: [string, (s: ExchangeSummary) => string][] = [
    ["First arrival", (s) => clock(s.earliestArrival)],
    ["Last arrival", (s) => clock(s.latestArrival)],
    ["Arrival spread", (s) => spread(s.earliestArrival, s.latestArrival)],
    ["First departure", (s) => clock(s.earliestDeparture)],
    ["Last departure", (s) => clock(s.latestDeparture)],
    ["Departure spread", (s) => spread(s.earliestDeparture, s.latestDeparture)],
    ["Coverage begins", (s) => clock(s.coverageStart, "down")],
    ["Coverage ends", (s) => clock(s.coverageEnd, "up")],
    [
      "Coverage duration",
      (s) => (s.coverageStart === null ? "—" : duration(s.coverage)),
    ],
  ];
  const base = comparison.exchanges[target.index];
  const baseWave = wave
    ? exchangeSummaries(
        comparison.teams.filter((t) =>
          waveTeams.some((w) => w.teamId === t.teamId),
        ),
        scenario.buffers,
      )[target.index]
    : null;
  const difference = (current: number | null, previous: number | null) =>
    current === null || previous === null ? "—" : delta(current - previous);
  return createPortal(
    <div
      ref={element}
      className="exchange-popup"
      style={position}
      role={target.pinned ? "dialog" : "tooltip"}
      aria-label={`Exchange ${field.index} details`}
      onPointerEnter={enter}
      onPointerLeave={leave}
    >
      <div className="popup-heading">
        <strong>
          {field.index === 0
            ? "START"
            : field.index === 71
              ? "FINISH"
              : `EX ${field.index}`}{" "}
          · {field.miles.toFixed(2)} mi
        </strong>
        <div>
          {!target.pinned && (
            <button className="small quiet" onClick={pin}>
              Pin
            </button>
          )}
          <button
            className="small quiet"
            aria-label="Close exchange details"
            onClick={close}
          >
            ×
          </button>
        </div>
      </div>
      <h3>{field.name}</h3>
      <p className="muted">
        {target.release
          ? `Release point · outbound leg ${target.leg}`
          : `${target.index === target.leg ? "Destination" : "Start exchange"} of leg ${target.leg}`}
      </p>
      {profile && (
        <p className="popup-team">
          <strong>
            {profile.team} · {profile.year}
          </strong>
          <br />
          {wave?.name}
          <br />
          Arrive {clock(incoming?.arrival ?? null)} · depart{" "}
          {clock(outgoing?.departure ?? null)}
          <br />
          {outgoing
            ? `Release ${clock(outgoing.releaseTime)}${outgoing.releaseUsed ? " (used)" : " (not used)"} · challenge ${duration(outgoing.challengeWait)} · gate ${duration(outgoing.gateWait)}`
            : "Finish — no outgoing runner"}
        </p>
      )}
      {target.release && (
        <p className="popup-team">
          Scheduled {clock(result.releases[target.index])}
          <br />
          {scenario.release.mode === "published"
            ? "Nominal "
            : "Section "}pace {pace(releasePace(scenario, target.leg))} / mi
          {scenario.release.mode === "published" && (
            <small>
              {" "}
              Exact minute timetable includes challenge allowances.
            </small>
          )}
        </p>
      )}
      <table>
        <thead>
          <tr>
            <th>Exchange window</th>
            <th>Field ({result.teams.length})</th>
            {waveSummary && <th>Wave ({waveTeams.length})</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, format]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{format(field)}</td>
              {waveSummary && <td>{format(waveSummary)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {overlay && (
        <div className="popup-baseline">
          <strong>Change from 2026 baseline</strong>
          <table>
            <thead>
              <tr>
                <th>Coverage</th>
                <th>Field</th>
                {baseWave && <th>Same wave teams</th>}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Begins</th>
                <td>{difference(field.coverageStart, base.coverageStart)}</td>
                {baseWave && waveSummary && (
                  <td>
                    {difference(
                      waveSummary.coverageStart,
                      baseWave.coverageStart,
                    )}
                  </td>
                )}
              </tr>
              <tr>
                <th>Ends</th>
                <td>{difference(field.coverageEnd, base.coverageEnd)}</td>
                {baseWave && waveSummary && (
                  <td>
                    {difference(waveSummary.coverageEnd, baseWave.coverageEnd)}
                  </td>
                )}
              </tr>
              <tr>
                <th>Duration</th>
                <td>{delta(field.coverage - base.coverage)}</td>
                {baseWave && waveSummary && (
                  <td>{delta(waveSummary.coverage - baseWave.coverage)}</td>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <small className="muted">
        {target.pinned
          ? "Pinned · Escape or click outside to close."
          : "Click a line or Pin to keep these details open."}
      </small>
    </div>,
    document.body,
  );
}
