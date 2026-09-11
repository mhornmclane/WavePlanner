import { useEffect, useMemo, useRef, useState } from "react";
import { baseline, initialScenario } from "./data";
import { simulate } from "./engine";
import { clock, delta, duration } from "./format";
import { Chart } from "./Chart";
import { SpreadReplay } from "./SpreadReplay";
import { Config } from "./Config";
import { Staffing } from "./Staffing";
import {
  download,
  parseScenario,
  readSaves,
  serializeScenario,
  validateScenario,
  writeSaves,
  type SavedScenario,
} from "./storage";
import type { Scenario } from "./model";

export default function App() {
  const [scenario, setScenario] = useState(initialScenario);
  const [overlay, setOverlay] = useState(false);
  const [visualizer, setVisualizer] = useState<"chart" | "replay">("chart");
  const [saves, setSaves] = useState<SavedScenario[]>([]);
  const [loadedId, setLoadedId] = useState("");
  const [savedText, setSavedText] = useState("");
  const [notice, setNotice] = useState("");
  const [fileError, setFileError] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      setSaves(readSaves(localStorage));
    } catch (e) {
      setFileError(
        `Browser saves could not be read. ${e instanceof Error ? e.message : "Use JSON files instead."}`,
      );
    }
  }, []);
  const checked = useMemo(() => {
    try {
      return { scenario: validateScenario(scenario), error: "" };
    } catch (e) {
      return { scenario: null, error: (e as Error).message };
    }
  }, [scenario]);
  const result = useMemo(
    () => (checked.scenario ? simulate(checked.scenario) : null),
    [checked],
  );
  // Same staffing buffers on both results; baseline race rules remain immutable.
  const comparison = useMemo(() => {
    const b = baseline(scenario.selectedTeamIds);
    b.buffers = { ...scenario.buffers };
    return checked.scenario ? simulate(b) : null;
  }, [scenario.selectedTeamIds, scenario.buffers, checked.scenario]);
  const dirty = JSON.stringify(scenario) !== savedText;
  function replace(s: Scenario, id = "") {
    setScenario(s);
    setLoadedId(id);
    setSavedText(id ? JSON.stringify(s) : "");
    setFileError("");
  }
  function persist(next: SavedScenario[]) {
    writeSaves(localStorage, next);
    setSaves(next);
  }
  function save(copy = false) {
    try {
      const value = validateScenario(
        copy
          ? { ...scenario, name: `${scenario.name.slice(0, 110)} copy` }
          : scenario,
      );
      const id = copy || !loadedId ? crypto.randomUUID() : loadedId;
      const entry = {
        id,
        updatedAt: new Date().toISOString(),
        scenario: value,
      };
      persist([...saves.filter((s) => s.id !== id), entry]);
      replace(value, id);
      setNotice(
        `${copy ? "Copy saved" : "Saved"}: ${value.name}. Stored in this browser.`,
      );
    } catch (e) {
      setFileError(
        `Could not save. ${(e as Error).message} You can export a valid configuration to JSON.`,
      );
    }
  }
  function load(id: string) {
    if (id === "baseline") {
      replace({
        ...baseline(scenario.selectedTeamIds),
        name: "2026 baseline copy",
      });
      setNotice(
        "Loaded a working copy of the baseline for the selected field. The baseline comparison stays unchanged.",
      );
      return;
    }
    const saved = saves.find((s) => s.id === id);
    if (saved) {
      replace(structuredClone(saved.scenario), id);
      setNotice(`Loaded ${saved.scenario.name}.`);
    }
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 1_000_000)
        throw new Error("Maximum configuration size is 1 MB.");
      const value = parseScenario(await file.text());
      replace(value);
      setNotice(`Imported ${value.name}. Save it to keep it in this browser.`);
    } catch (e) {
      setFileError(
        `Import rejected: ${(e as Error).message} Your current configuration is unchanged.`,
      );
    }
  }
  return (
    <>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">R4H</span>
          <span>
            RUCK4HIT <span className="brand-divider">/</span>{" "}
            <span className="brand-sub">PACE PLANNER</span>
          </span>
        </div>
        <span className="header-meta">CAPE COD · 71 LEGS · 205.72 MI</span>
      </header>
      <main>
        <div className="page-heading">
          <h1>Ruck4HIT Wave Planner</h1>
        </div>
        <section className="panel" aria-labelledby="configure-title">
          <div className="section-head">
            <div>
              <div className="eyebrow">01 / CONFIGURE</div>
              <h2 id="configure-title">Race configuration</h2>
            </div>
            <span className="config-status">
              <i className={dirty ? "unsaved-dot" : "saved-dot"} />
              {dirty ? "Unsaved configuration" : "Saved in this browser"}
            </span>
          </div>
          <div className="save-toolbar">
            <label className="scenario-name">
              <span className="sr-only">Configuration name</span>
              <input
                aria-label="Configuration name"
                maxLength={120}
                value={scenario.name}
                onChange={(e) =>
                  setScenario((s) => ({ ...s, name: e.target.value }))
                }
              />
            </label>
            <button
              className="primary"
              disabled={!checked.scenario}
              onClick={() => save()}
            >
              Save configuration
            </button>
            <select
              aria-label="Load configuration"
              value=""
              onChange={(e) => load(e.target.value)}
            >
              <option value="" disabled>
                Load configuration…
              </option>
              <option value="baseline">2026 baseline · use a copy</option>
              {saves.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.scenario.name}
                </option>
              ))}
            </select>
            <button disabled={!checked.scenario} onClick={() => save(true)}>
              Duplicate
            </button>
            <button
              disabled={!loadedId}
              className="quiet"
              onClick={() => {
                try {
                  const old = saves.find((s) => s.id === loadedId);
                  persist(saves.filter((s) => s.id !== loadedId));
                  setLoadedId("");
                  setSavedText("");
                  setNotice(
                    `Deleted saved copy of ${old?.scenario.name}. The current configuration is still open and can be saved again.`,
                  );
                } catch (e) {
                  setFileError(`Could not delete: ${(e as Error).message}`);
                }
              }}
            >
              Delete saved
            </button>
            <div className="file-actions">
              <button
                className="quiet"
                disabled={!checked.scenario}
                onClick={() => {
                  try {
                    download(
                      `${scenario.name.replace(/[^a-z0-9_-]/gi, "-").slice(0, 80)}.json`,
                      serializeScenario(scenario),
                      "application/json",
                    );
                    setNotice("Configuration exported as JSON.");
                  } catch (e) {
                    setFileError((e as Error).message);
                  }
                }}
              >
                ↓ JSON
              </button>
              <button
                className="quiet"
                onClick={() => importInput.current?.click()}
              >
                ↑ Import
              </button>
              <input
                ref={importInput}
                type="file"
                accept=".json,application/json"
                aria-label="Import configuration JSON"
                className="sr-only"
                onChange={(e) => {
                  void importFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          <Config
            scenario={scenario}
            setScenario={setScenario}
            result={result}
          />
        </section>
        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button
              className="quiet"
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        )}
        {fileError && (
          <div className="error-message" role="alert">
            <span>{fileError}</span>
            <button
              className="quiet"
              aria-label="Dismiss file error"
              onClick={() => setFileError("")}
            >
              ×
            </button>
          </div>
        )}
        {checked.error && (
          <div className="error-message" role="alert">
            <strong>Check your configuration</strong>
            <span>{checked.error} Results will resume when corrected.</span>
          </div>
        )}
        {result && comparison && (
          <>
            <div className="results-label">
              <span>
                {result.teams.length} HISTORICAL TEAMS · {scenario.waves.length}{" "}
                STARTING {scenario.waves.length === 1 ? "WAVE" : "WAVES"}
              </span>
              <span>Updates as you configure</span>
            </div>
            <div className="metrics">
              <article>
                <span>Finish spread</span>
                <strong>
                  {result.teams.length ? duration(result.finishSpread) : "—"}
                </strong>
                <small className="metric-delta">
                  {overlay
                    ? `${delta(result.finishSpread - comparison.finishSpread)} vs 2026`
                    : "First to last final-leg arrival"}
                </small>
              </article>
              <article>
                <span>Last runner off course</span>
                <strong>{clock(result.lastOffCourse)}</strong>
                <small className="metric-delta">
                  {overlay &&
                  result.lastOffCourse !== null &&
                  comparison.lastOffCourse !== null
                    ? `${delta(result.lastOffCourse - comparison.lastOffCourse)} vs 2026`
                    : "All outstanding legs complete"}
                </small>
              </article>
              <article>
                <span>Exchange coverage</span>
                <strong>
                  {result.exchangeHours.toFixed(1)} <small>hrs</small>
                </strong>
                <small className="metric-delta">
                  {overlay
                    ? `${delta((result.exchangeHours - comparison.exchangeHours) * 3600)} vs 2026`
                    : "Sum of exchange coverage windows"}
                </small>
              </article>
              <article>
                <span>Time releases</span>
                <strong>{result.releaseCount}</strong>
                <small className="metric-delta">
                  {overlay
                    ? `${result.releaseCount - comparison.releaseCount >= 0 ? "+" : ""}${result.releaseCount - comparison.releaseCount} vs 2026`
                    : "Departures before arrival + challenge"}
                </small>
              </article>
              <article>
                <span>Peak active / team</span>
                <strong>
                  {result.peakActive} <small>runners</small>
                </strong>
                <small className="metric-delta">
                  {overlay
                    ? `${result.peakActive - comparison.peakActive >= 0 ? "+" : ""}${result.peakActive - comparison.peakActive} vs 2026`
                    : "Maximum simultaneous active legs"}
                </small>
              </article>
            </div>
            <div
              className="visualizer-switch"
              role="group"
              aria-label="Visualizer view"
            >
              <button
                aria-pressed={visualizer === "chart"}
                onClick={() => setVisualizer("chart")}
              >
                Time / course chart
              </button>
              <button
                aria-pressed={visualizer === "replay"}
                onClick={() => setVisualizer("replay")}
              >
                Spread replay
              </button>
            </div>
            {visualizer === "chart" ? (
              <Chart
                result={result}
                comparison={comparison}
                scenario={scenario}
                overlay={overlay}
                setOverlay={setOverlay}
              />
            ) : (
              <SpreadReplay result={result} scenario={scenario} />
            )}
            <Staffing
              result={result}
              comparison={comparison}
              overlay={overlay}
            />
          </>
        )}
        <footer>
          <strong>Planning estimates, not an exact replay.</strong> Travel uses
          fixed historical segment-average paces. Baseline: all selected teams
          start Day 1 at 01:00, with the published 2026 releases, assumed
          16/21-minute challenges, and the fixed JBCC gate. Moving time excludes
          challenge and gate waits. Times use event Day/time, independent of
          calendar dates.
          <br />
          Configurations are saved only in this browser. Export JSON to share or
          keep a portable copy. No data leaves this app.
        </footer>
      </main>
    </>
  );
}
