import { useState } from "react";
import { pace, parsePace, weekday } from "./format";
export function TimeInput({label, value, onChange}: {label: string; value: number; onChange: (v: number) => void}) {
  const [day, setDay] = useState(Number.isFinite(value) ? Math.floor(value / 86400) : 0);
  const [previous, setPrevious] = useState(value);
  if (!Object.is(previous, value)) {
    setPrevious(value);
    if (Number.isFinite(value)) setDay(Math.floor(value / 86400));
  }
  const within = Number.isFinite(value) ? ((value % 86400) + 86400) % 86400 : 0;
  const time = Number.isFinite(value) ? `${String(Math.floor(within / 3600)).padStart(2,"0")}:${String(Math.floor(within % 3600 / 60)).padStart(2,"0")}` : "";
  return <div className="time-input">
    <select aria-label={`${label} weekday`} value={day} onChange={e => { const d=+e.target.value; setDay(d); onChange(d*86400+within); }}>
      <optgroup label="Event week">{[-1,0,1,2,3,4,5].map(d=><option key={d} value={d}>{weekday(d)}</option>)}</optgroup>
      <optgroup label="Other weeks">{Array.from({length:60},(_,i)=>i-30).filter(d=>d < -1 || d > 5).map(d=><option key={d} value={d}>{weekday(d)}</option>)}</optgroup>
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
