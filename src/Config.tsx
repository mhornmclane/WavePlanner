import { TimingRulesEditor } from "./TimingRuleControls";
import { WorstCaseTeams } from "./WorstCaseTeams";
import { useState } from "react";
import { bins, course, profiles, teamId } from "./data";
import { Waves } from "./WaveControls";
import { VisualPace } from "./VisualPace";
import { orderedWaveEntries, syncAssignments } from "./waves";
import { clock, pace, parsePace } from "./format";
import type { Scenario, Simulation } from "./model";

export function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const valid = Number.isFinite(value);
  const day = valid ? Math.floor(value / 86400) + 1 : "";
  const within = valid ? ((value % 86400) + 86400) % 86400 : 3600;
  const time = valid
    ? `${String(Math.floor(within / 3600)).padStart(2, "0")}:${String(Math.floor((within % 3600) / 60)).padStart(2, "0")}`
    : "";
  return (
    <div className="time-input">
      <span>Day</span>
      <input
        aria-label={`${label} day`}
        type="number"
        min="1"
        max="30"
        step="1"
        value={day}
        onChange={(e) =>
          onChange(
            e.target.value ? (+e.target.value - 1) * 86400 + within : NaN,
          )
        }
      />
      <input
        aria-label={`${label} time`}
        type="time"
        value={time}
        onChange={(e) => {
          const [h, m] = e.target.value.split(":").map(Number);
          onChange(
            e.target.value
              ? ((Number(day) || 1) - 1) * 86400 + h * 3600 + m * 60
              : NaN,
          );
        }}
      />
    </div>
  );
}
export function PaceInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [text, setText] = useState(Number.isFinite(value) ? pace(value) : "");
  const [oldValue, setOldValue] = useState(value);
  if (!Object.is(value, oldValue)) {
    setOldValue(value);
    if (Number.isFinite(value)) setText(pace(value));
  }
  return (
    <input
      className="pace-input"
      aria-label={label}
      aria-invalid={parsePace(text) === null}
      title="Pace in minutes:seconds per mile"
      value={text}
      placeholder="10:25"
      onChange={(e) => {
        setText(e.target.value);
        onChange(parsePace(e.target.value) ?? NaN);
      }}
    />
  );
}
export function MinutesInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="unit-input">
        <input
          aria-label={label}
          type="number"
          min="0"
          max="1440"
          step="1"
          value={Number.isFinite(value) ? value / 60 : ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? NaN : +e.target.value * 60)
          }
        />
        <span>min</span>
      </div>
    </label>
  );
}
interface Props {
  scenario: Scenario;
  setScenario: (updater: (s: Scenario) => Scenario) => void;
  result: Simulation | null;
}
export function Config({ scenario: s, setScenario: setConfig, result }: Props) {
  const update = (fn: (s: Scenario) => Scenario) =>
    setConfig((current) => syncAssignments(fn(current)));
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [tab, setTab] = useState("waves");
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("all");
  const [bulkWave, setBulkWave] = useState("");
  const filtered = profiles.filter(
    (p) =>
      (year === "all" || p.year === +year) &&
      `${p.team} ${p.year}`.toLowerCase().includes(search.toLowerCase()),
  );
  filtered.sort(
    (a, b) =>
      (sort === "asc" ? 1 : -1) *
        (a.overall_mean_pace_seconds_per_mile -
          b.overall_mean_pace_seconds_per_mile) ||
      a.team.localeCompare(b.team) ||
      Number(a.year) - Number(b.year),
  );
  const selected = new Set(s.selectedTeamIds);
  const activeBulk = s.waves.some((w) => w.id === bulkWave)
    ? bulkWave
    : s.waves[0].id;
  function select(ids: string[], include: boolean) {
    update((current) => {
      const next = new Set(current.selectedTeamIds),
        assignments = { ...current.assignments };
      ids.forEach((id) => {
        if (include) {
          next.add(id);
          assignments[id] ??= current.waves[0].id;
        } else {
          next.delete(id);
          delete assignments[id];
        }
      });
      return { ...current, selectedTeamIds: [...next], assignments };
    });
  }
  const tabs = [
    { id: "waves", label: "Starting waves", meta: s.waves.length },
    { id: "teams", label: "Historical field", meta: s.selectedTeamIds.length },
    { id: "release", label: "Release schedule" },
    { id: "timing", label: "Timing rules", meta: s.timingRules.filter(r => r.enabled).length },
    { id: "staffing", label: "Staffing & assumptions" },
  ];
  return (
    <>
      <div
        className="config-tabs"
        role="tablist"
        aria-label="Configuration sections"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const next =
                  tabs[
                    (tabs.findIndex((v) => v.id === tab) +
                      (e.key === "ArrowRight" ? 1 : tabs.length - 1)) %
                      tabs.length
                  ].id;
                setTab(next);
                document.getElementById(`tab-${next}`)?.focus();
              }
            }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.meta !== undefined && <span>{t.meta}</span>}
          </button>
        ))}
      </div>
      <div
        className="config-body"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === "timing" && <TimingRulesEditor scenario={s} result={result} update={update} />}
        {tab === "waves" && <Waves scenario={s} update={update} />}
        {tab === "teams" && (
          <>
            <WorstCaseTeams scenario={s} update={update} select={select} />
            <div className="team-tools">
              <label className="search-field">
                <span className="sr-only">Search teams</span>
                <input
                  type="search"
                  aria-label="Search teams"
                  placeholder="Search team name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <select
                aria-label="Filter historical year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              >
                <option value="all">All years</option>
                {[2024, 2025, 2026].map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
              <button onClick={() => select(profiles.map(teamId), true)}>
                Select all 51
              </button>
              <button
                className="quiet"
                onClick={() => select(profiles.map(teamId), false)}
              >
                Clear all
              </button>
              <span className="muted">
                {profiles.filter(p => selected.has(teamId(p))).length} historical selected / {filtered.length} shown
              </span>
            </div>
            <div className="bulk-tools">
              <button
                className="small"
                onClick={() => select(filtered.map(teamId), true)}
              >
                Select shown
              </button>
              <button
                className="quiet small"
                onClick={() => select(filtered.map(teamId), false)}
              >
                Clear shown
              </button>
              {s.waveRules.mode === "manual" && (
                <>
                  <span className="bulk-divider" />
                  <select
                    aria-label="Bulk assignment wave"
                    value={activeBulk}
                    onChange={(e) => setBulkWave(e.target.value)}
                  >
                    {orderedWaveEntries(s).map(({ w }) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="small"
                    onClick={() =>
                      update((current) => ({
                        ...current,
                        assignments: {
                          ...current.assignments,
                          ...Object.fromEntries(
                            filtered
                              .filter((p) => selected.has(teamId(p)))
                              .map((p) => [teamId(p), activeBulk]),
                          ),
                        },
                      }))
                    }
                  >
                    Assign selected shown
                  </button>
                </>
              )}
            </div>
            <div className="table-scroll team-table">
              <table>
                <thead>
                  <tr>
                    <th>
                      <span className="sr-only">Included</span>
                    </th>
                    <th>Team / year</th>
                    <th aria-sort={sort === "asc" ? "ascending" : "descending"}>
                      <button
                        className="sort-button"
                        onClick={() => setSort(sort === "asc" ? "desc" : "asc")}
                      >
                        Overall {sort === "asc" ? "↑" : "↓"}
                      </button>
                    </th>
                    {bins.map((b) => (
                      <th key={b.bin_id}>
                        Legs {b.first_leg}–{b.last_leg}
                      </th>
                    ))}
                    <th>Starting wave</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const id = teamId(p);
                    return (
                      <tr
                        key={id}
                        className={selected.has(id) ? "" : "unselected"}
                      >
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Include ${p.team} ${p.year}`}
                            checked={selected.has(id)}
                            onChange={(e) => select([id], e.target.checked)}
                          />
                        </td>
                        <th scope="row">
                          <span>{p.team}</span>
                          <small>{p.year}</small>
                        </th>
                        <td className="overall-pace">
                          {pace(p.overall_mean_pace_seconds_per_mile)}
                        </td>
                        {bins.map((b) => (
                          <td
                            key={b.bin_id}
                            className="pace-cell"
                            style={{
                              backgroundColor: `hsl(${Math.max(0, Math.min(140, 140 - (p.bin_mean_pace_seconds_per_mile[b.bin_id] - 500) / 4))} 30% 94%)`,
                            }}
                          >
                            {pace(p.bin_mean_pace_seconds_per_mile[b.bin_id])}
                          </td>
                        ))}
                        <td>
                          {s.waveRules.mode === "pace" ? (
                            <span className="calculated-wave">
                              {selected.has(id)
                                ? s.waves.find(
                                    (w) => w.id === s.assignments[id],
                                  )?.name
                                : "—"}
                            </span>
                          ) : (
                            <select
                              aria-label={`Wave for ${p.team} ${p.year}`}
                              disabled={!selected.has(id)}
                              value={s.assignments[id] ?? s.waves[0].id}
                              onChange={(e) =>
                                update((current) => ({
                                  ...current,
                                  assignments: {
                                    ...current.assignments,
                                    [id]: e.target.value,
                                  },
                                }))
                              }
                            >
                              {orderedWaveEntries(s).map(({ w }) => (
                                <option key={w.id} value={w.id}>
                                  {w.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filtered.length && (
                <div className="empty">
                  No historical teams match this search.
                </div>
              )}
            </div>
            <p className="table-note">
              Paces are min:sec per mile; lower is faster. Each year/team is a
              separate profile. Overall pace is the supplied mean, not an
              average of the five bins.
            </p>
          </>
        )}
        {tab === "release" && (
          <>
            <div className="release-grid">
              <div>
                <h3>One release clock for the course</h3>
                <p className="muted">
                  Waves starting after Day 1, 01:00 ignore releases through leg
                  35. From each team’s monument arrival, the shared timetable
                  resumes, including expired releases.
                </p>
                <div className="radio-stack">
                  <label>
                    <input
                      type="radio"
                      name="release-mode"
                      checked={s.release.mode === "published"}
                      onChange={() =>
                        update((current) => ({
                          ...current,
                          release: { ...current.release, mode: "published" },
                        }))
                      }
                    />
                    <span>
                      <strong>Published 2026 timetable</strong>
                      <small>
                        Exact supplied Day/time releases, including challenge
                        allowances.
                      </small>
                    </span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="release-mode"
                      checked={s.release.mode === "generated"}
                      onChange={() =>
                        update((current) => ({
                          ...current,
                          release: { ...current.release, mode: "generated" },
                        }))
                      }
                    />
                    <span>
                      <strong>Generate from pace</strong>
                      <small>
                        Set a time anchor and change release pace by course
                        segment.
                      </small>
                    </span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="release-mode"
                      checked={s.release.mode === "visual"}
                      onChange={() =>
                        update((current) => ({
                          ...current,
                          release: { ...current.release, mode: "visual" },
                        }))
                      }
                    />
                    <span>
                      <strong>Visual five-section pace</strong>
                      <small>
                        Five fixed course sections with draggable pace levels.
                      </small>
                    </span>
                  </label>
                </div>
                {s.release.mode !== "published" && (
                  <div className="generated-controls">
                    <label className="field">
                      <span>Release time at start of leg 1</span>
                    </label>
                    <TimeInput
                      label="Release anchor"
                      value={s.release.anchor}
                      onChange={(anchor) =>
                        update((current) => ({
                          ...current,
                          release: { ...current.release, anchor },
                        }))
                      }
                    />
                    {s.release.mode === "visual" ? (
                      <VisualPace
                        values={s.release.visualPaces}
                        onChange={(index, value) =>
                          update((current) => ({
                            ...current,
                            release: {
                              ...current.release,
                              visualPaces: current.release.visualPaces.map(
                                (v, i) => (i === index ? value : v),
                              ),
                            },
                          }))
                        }
                      />
                    ) : (
                      <>
                        <div className="segment-head">
                          <span>From leg</span>
                          <span>Pace / mile</span>
                        </div>
                        {s.release.segments.map((seg, i) => (
                          <div className="segment-row" key={i}>
                            <input
                              aria-label={`Segment ${i + 1} starting leg`}
                              type="number"
                              min="1"
                              max="71"
                              disabled={i === 0}
                              value={
                                Number.isFinite(seg.startLeg)
                                  ? seg.startLeg
                                  : ""
                              }
                              onChange={(e) =>
                                update((current) => ({
                                  ...current,
                                  release: {
                                    ...current.release,
                                    segments: current.release.segments.map(
                                      (v, j) =>
                                        i === j
                                          ? {
                                              ...v,
                                              startLeg:
                                                e.target.value === ""
                                                  ? NaN
                                                  : +e.target.value,
                                            }
                                          : v,
                                    ),
                                  },
                                }))
                              }
                            />
                            <PaceInput
                              label={`Segment ${i + 1} pace`}
                              value={seg.pace}
                              onChange={(v) =>
                                update((current) => ({
                                  ...current,
                                  release: {
                                    ...current.release,
                                    segments: current.release.segments.map(
                                      (p, j) =>
                                        i === j ? { ...p, pace: v } : p,
                                    ),
                                  },
                                }))
                              }
                            />
                            <button
                              className="quiet"
                              aria-label={`Remove pace segment ${i + 1}`}
                              disabled={i === 0}
                              onClick={() =>
                                update((current) => ({
                                  ...current,
                                  release: {
                                    ...current.release,
                                    segments: current.release.segments.filter(
                                      (_, j) => i !== j,
                                    ),
                                  },
                                }))
                              }
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          className="small"
                          disabled={s.release.segments.length >= 71}
                          onClick={() =>
                            update((current) => {
                              const used = new Set(
                                current.release.segments.map((p) => p.startLeg),
                              );
                              const next = [
                                15,
                                29,
                                43,
                                57,
                                ...Array.from({ length: 71 }, (_, i) => i + 1),
                              ].find((l) => !used.has(l))!;
                              return {
                                ...current,
                                release: {
                                  ...current.release,
                                  segments: [
                                    ...current.release.segments,
                                    { startLeg: next, pace: 625 },
                                  ],
                                },
                              };
                            })
                          }
                        >
                          + Add pace segment
                        </button>
                      </>
                    )}
                    <p className="table-note">
                      A pace applies to travel starting on that leg, until the
                      next segment. Challenge allowances are added before legs
                      36 and 54.
                    </p>
                  </div>
                )}
              </div>
              <div className="challenge-controls">
                <h3>Challenge durations</h3>
                <p className="muted">
                  Fixed estimates, editable per scenario. A scheduled release
                  can bypass unfinished arrival/challenge time.
                </p>
                <div className="two-fields">
                  <MinutesInput
                    label="Monument · after leg 35"
                    value={s.challenges.monument}
                    onChange={(monument) =>
                      update((current) => ({
                        ...current,
                        challenges: { ...current.challenges, monument },
                      }))
                    }
                  />
                  <MinutesInput
                    label="Lighthouse · after leg 53"
                    value={s.challenges.lighthouse}
                    onChange={(lighthouse) =>
                      update((current) => ({
                        ...current,
                        challenges: { ...current.challenges, lighthouse },
                      }))
                    }
                  />
                </div>
                <div className="gate-note">
                  <strong>Opening times</strong>
                  <p>
                    Configure gate openings in Timing rules. Early outgoing runners
                    wait until opening; moving time is unchanged.
                  </p>
                </div>
                <p className="table-note">
                  Changing challenge durations leaves the published timetable
                  untouched. In generated and visual modes it also changes the
                  schedule’s challenge allowances.
                </p>
              </div>
            </div>
            <details className="release-preview">
              <summary>Inspect all 71 release times</summary>
              <div className="table-scroll schedule-table">
                <table>
                  <thead>
                    <tr>
                      <th>Outbound leg</th>
                      <th>Start location</th>
                      <th>Current release</th>
                      <th>2026 release</th>
                    </tr>
                  </thead>
                  <tbody>
                    {course.legs.map((l, i) => (
                      <tr key={l.leg_number}>
                        <td>{l.leg_number}</td>
                        <th scope="row">{l.start_location}</th>
                        <td>
                          {result
                            ? clock(result.releases[i])
                            : "Invalid configuration"}
                        </td>
                        <td>
                          D{l.release_time.day} {l.release_time.time_24h}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
        {tab === "staffing" && (
          <div className="release-grid">
            <div>
              <h3>Coverage buffers</h3>
              <p className="muted">
                Extend each exchange’s activity window for setup and closeout.
                The same buffers apply to the baseline comparison.
              </p>
              <div className="two-fields">
                <MinutesInput
                  label="Before first activity"
                  value={s.buffers.before}
                  onChange={(before) =>
                    update((current) => ({
                      ...current,
                      buffers: { ...current.buffers, before },
                    }))
                  }
                />
                <MinutesInput
                  label="After last activity"
                  value={s.buffers.after}
                  onChange={(after) =>
                    update((current) => ({
                      ...current,
                      buffers: { ...current.buffers, after },
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <h3>What this model assumes</h3>
              <ul className="assumptions">
                <li>Team pace follows historical or configured hypothetical course segments.</li>
                <li>
                  Outgoing runners are ready; legs can overlap after releases.
                </li>
                <li>
                  No vehicle travel, runner rotation, handoff delays, or
                  unscheduled breaks.
                </li>
                <li>
                  Full-course teams only. No extra HELOS entrants, restart
                  waves, or safety pauses.
                </li>
                <li>
                  Each exchange occurrence is staffed separately. Coverage
                  measures exchange-hours, not volunteer-hours.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
