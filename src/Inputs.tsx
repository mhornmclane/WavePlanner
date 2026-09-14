import { useState, type ReactNode } from "react";
import { pace, parsePace, weekday, clock, precisePace } from "./format";
export function TimeInput({label, value, onChange, calculated = false, invalid = false}: {label: string; value: number; onChange: (v: number) => void; calculated?: boolean; invalid?: boolean}) {
  const [day, setDay] = useState(Number.isFinite(value) ? Math.floor(Math.round(value / 60) / 1440) : 0);
  const [previous, setPrevious] = useState(value);
  if (!Object.is(previous, value)) {
    setPrevious(value);
    if (Number.isFinite(value)) setDay(Math.floor(Math.round(value / 60) / 1440));
  }
  if (calculated) return <div className="time-input calculated-value"><input aria-label={label + " time"} readOnly aria-invalid={invalid} value={invalid ? "—" : clock(value)} /><small>Calculated</small></div>;
  const within = Number.isFinite(value) ? ((Math.round(value / 60) * 60 % 86400) + 86400) % 86400 : 0;
  const time = Number.isFinite(value) ? `${String(Math.floor(within / 3600)).padStart(2,"0")}:${String(Math.floor(within % 3600 / 60)).padStart(2,"0")}` : "";
  return <div className="time-input">
    <select aria-label={`${label} weekday`} value={day} onChange={e => { const d=+e.target.value; setDay(d); onChange(d*86400+within); }}>
      {[...new Set([-1,0,1,2,3,4,5,day])].sort((a,b)=>a-b).map(d=><option key={d} value={d}>{weekday(d)}</option>)}
    </select>
    <input aria-label={`${label} time`} type="time" value={time} aria-invalid={!Number.isFinite(value)} onChange={e=>{
      const [h,m]=e.target.value.split(":").map(Number);
      onChange(e.target.value ? day*86400+h*3600+m*60 : NaN);
    }}/>
  </div>;
}
export function PaceInput({
  value,
  onChange,
  label,
  calculated = false,
  invalid = false,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  calculated?: boolean;
  invalid?: boolean;
}) {
  const [text, setText] = useState(Number.isFinite(value) ? pace(value) : "");
  const [oldValue, setOldValue] = useState(value);
  if (!Object.is(value, oldValue)) {
    setOldValue(value);
    if (Number.isFinite(value)) setText(pace(value));
  }
  if (calculated) return <span className="calculated-value"><input className="pace-input" aria-label={label} readOnly aria-invalid={invalid} value={invalid ? "—" : precisePace(value)} /><small>Calculated</small></span>;
  return (
    <PaceStepper label={label} value={parsePace(text)} onChange={onChange}>
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
    </PaceStepper>
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

export function PaceStepper({ label, value, onChange, valid = () => true, children }: {
  label: string; value: number | null; onChange: (value: number) => void;
  valid?: (value: number) => boolean; children: ReactNode;
}) {
  const canStep = (delta: number) => value !== null && Number.isFinite(value) && value + delta >= 1 && value + delta <= 5999 && valid(value + delta);
  return <div className="pace-stepper">{children}<div className="pace-step-buttons">
    <button type="button" aria-label={`Increase ${label} by 5 seconds`} title="Increase pace by 5 seconds per mile" disabled={!canStep(5)} onClick={()=>{if(canStep(5))onChange(value!+5);}}>+5</button>
    <button type="button" aria-label={`Decrease ${label} by 5 seconds`} title="Decrease pace by 5 seconds per mile" disabled={!canStep(-5)} onClick={()=>{if(canStep(-5))onChange(value!-5);}}>−5</button>
  </div></div>;
}
