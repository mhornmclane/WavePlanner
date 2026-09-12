import { HistoricalReplay } from "./HistoricalReplay";
import { syncAssignments } from "./waves";
import { TimingRuleSummary } from "./TimingRuleControls";
import { useEffect, useMemo, useRef, useState } from "react";
import { baseline, initialScenario, fieldIds, fieldYears } from "./data";
import { simulate } from "./engine";
import { HistoricalData, ResultsView, Summary } from "./Views";
import { Chart } from "./Chart";
import { SpreadReplay } from "./SpreadReplay";
import { Config } from "./Config";

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
import { applyPreset, presets, type PresetId } from "./presets";

export default function App() {
  const [section, setSection] = useState<"history" | "historical-replay" | "simulation" | "results">("simulation");
  const [scenario, setScenario] = useState(initialScenario);
  const [presetId, setPresetId] = useState<PresetId | "custom">("custom");
  const [configRevision, setConfigRevision] = useState(0);
  const activePreset = presets.find((p) => p.id === presetId);
  function editScenario(updater: (s: Scenario) => Scenario) {
    const next = updater(scenario);
    if (JSON.stringify(next) === JSON.stringify(scenario)) return;
    setPresetId("custom");
    setScenario(next);
  }
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
    b.worstCaseTeams = structuredClone(scenario.worstCaseTeams);
    b.buffers = { ...scenario.buffers };
    return checked.scenario ? simulate(b, true) : null;
  }, [scenario.selectedTeamIds, scenario.buffers, scenario.worstCaseTeams, checked.scenario]);
  const dirty = JSON.stringify(scenario) !== savedText;
  function replace(s: Scenario, id = "") {
    setScenario(s);
    setPresetId("custom");
    setConfigRevision((revision) => revision + 1);
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
    const saved = saves.find((s) => s.id === id);
    if (saved) {
      replace(structuredClone(saved.scenario), id);
      setNotice(`Loaded ${saved.scenario.name}.`);
    }
  }
  function loadPreset(id: PresetId | "custom") {
    if (id === "custom") {
      setPresetId("custom");
      return;
    }
    const next = applyPreset(id, scenario);
    replace(next);
    setPresetId(id);
    setNotice(`Loaded ${next.name}. Strategy and standard race rules applied. Your field, hypothetical paces, and staffing buffers are retained.`);
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
  return <>
    <header className="app-header"><div className="brand"><span className="brand-mark">R4H</span><span>RUCK4HIT / PACE PLANNER</span></div><span className="header-meta">CAPE COD · 71 LEGS · 205.72 MI</span></header>
    <main>
      <div className="page-heading"><div><div className="eyebrow">PLAN THE FIELD. BRING EVERYONE TOGETHER.</div><h1>Ruck4HIT Wave Planner</h1></div></div>
      <nav className="section-nav" aria-label="Planner sections">{([
        ["history", "Historical data"], ["historical-replay", "Historical replay"], ["simulation", "Simulation"], ["results", "Results"]
      ] as const).map(([id,label])=><button key={id} aria-current={section===id ? "page" : undefined} onClick={()=>setSection(id)}>{label}</button>)}</nav>
      {notice && <div className="notice" role="status"><span>{notice}</span><button className="quiet" aria-label="Dismiss notification" onClick={()=>setNotice("")}>×</button></div>}
      {fileError && <div className="error-message" role="alert"><span>{fileError}</span><button className="quiet" aria-label="Dismiss file error" onClick={()=>setFileError("")}>×</button></div>}
      <div hidden={section!=="history"}><HistoricalData/></div>
      <div hidden={section!=="historical-replay"}><HistoricalReplay active={section==="historical-replay"}/></div>
      <div hidden={section!=="simulation"}>
        <div className="workspace-heading"><div><h2>Shape the race</h2><p className="muted">Choose your field and waves. Watch the course respond.</p></div></div>
        <details className="configuration-files"><summary>Configuration files · {scenario.name} · {dirty ? "Unsaved" : "Saved"}</summary>
          <div className="save-toolbar">
            <label className="scenario-name">
              <span className="sr-only">Configuration name</span>
              <input
                aria-label="Configuration name"
                maxLength={120}
                value={scenario.name}
                onChange={(e) =>
                  editScenario((s) => ({ ...s, name: e.target.value }))
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

        </details>
        {checked.error && <div className="error-message" role="alert">{checked.error} Results will resume when corrected.</div>}
        <div className="simulation-workspace">
          <section className="panel configuration-panel" aria-label="Simulation configuration">
            <div className="configuration-heading"><h3>Configuration</h3><label className="field"><span>Strategy preset</span><select aria-label="Strategy preset" value={presetId} onChange={e=>loadPreset(e.target.value as PresetId | "custom")}><option value="custom">Custom</option>{presets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><span className="muted">{scenario.selectedTeamIds.length} profiles</span></div>
            <div className="preset-description">
              {activePreset && <p>{activePreset.summary}</p>}
              <p className="muted">Presets restore standard race rules. Finish targets guide the release schedule; they do not guarantee all teams finish by that time.</p>
            </div>
            <Config key={configRevision} scenario={scenario} setScenario={editScenario} result={result}/>
          </section>
          <div className="configuration-results-action"><button className="primary" onClick={()=>setSection("results")}>Tabular results</button></div>
          <section className="simulation-visual" aria-label="Live simulation">
            {result && comparison ? <>
              <div className="viewer-controls"><label className="inline-label">Teams
                <select aria-label="Simulation field" value={scenario.fieldYear} onChange={e=>{
                  const fieldYear=e.target.value === "all" ? "all" : +e.target.value;
                  editScenario(s=>syncAssignments({...s,fieldYear,selectedTeamIds:[...fieldIds(fieldYear),...s.selectedTeamIds.filter(id=>id.startsWith("synthetic::"))]}));
                }}><option value="all">All years</option>{fieldYears.map(year=><option key={year} value={year}>{year} teams</option>)}</select>
              </label><div className="visualizer-switch" role="group" aria-label="Visualizer view"><button aria-pressed={visualizer==="chart"} onClick={()=>setVisualizer("chart")}>Time / course chart</button><button aria-pressed={visualizer==="replay"} onClick={()=>setVisualizer("replay")}>Spread replay</button></div></div>
              {visualizer==="chart" ? <Chart result={result} comparison={comparison} scenario={scenario} overlay={overlay} setOverlay={setOverlay} active={section==="simulation"}/> : <SpreadReplay result={result} scenario={scenario} active={section==="simulation"}/>}
              <Summary result={result} scenario={scenario}/>
              <TimingRuleSummary scenario={scenario} result={result}/>
            </> : <div className="panel empty-state">Correct the configuration to resume the live simulation.</div>}
          </section>
        </div>
      </div>
      <div hidden={section!=="results"}>
        <div className="workspace-heading"><div><h2>Results</h2><p className="muted">Always current with your simulation configuration.</p></div><button onClick={()=>setSection("simulation")}>← Adjust simulation</button></div>
        {result && comparison ? <ResultsView scenario={scenario} result={result} comparison={comparison} overlay={overlay}/> : <div className="error-message" role="alert">{checked.error} Correct the configuration before viewing or exporting results.</div>}
      </div>
      <footer><strong>Planning estimates.</strong> Historical segment paces determine travel. Released legs may overlap; final-leg finish and all runners off course are separate measures. Times are relative to event Friday, independent of calendar dates. Configurations stay in this browser; export JSON to share or back up.</footer>
    </main>
  </>;
}
