import { useMemo, useState } from "react";
import { historicalResult, historicalScenario, replayYears, yearColors } from "./historicalReplayData";
import { SpreadReplay } from "./SpreadReplay";

export function HistoricalReplay({ active }: { active: boolean }) {
  const [years, setYears] = useState<number[]>([2025]);
  const result = useMemo(() => ({ ...historicalResult,
    teams: historicalResult.teams.filter(t => years.includes(Number(t.teamId.split("::")[0]))) }), [years]);
  return <div>
    <fieldset className="historical-replay-years">
      <legend>Replay years</legend>
      {replayYears.map(year => <label key={year} className="check">
        <input type="checkbox" checked={years.includes(year)} onChange={e => setYears(current =>
          e.target.checked ? [...current, year].sort() : current.filter(y => y !== year))}/>
        <i style={{ background: yearColors[year] }}/>{year}
      </label>)}
    </fieldset>
    <SpreadReplay result={result} scenario={historicalScenario} active={active} historical/>
  </div>;
}
