import { useRef, useState } from "react";
import { bins } from "./data";
import { pace } from "./format";
import { PaceInput } from "./Config";

export function VisualPace({
  values,
  onChange,
}: {
  values: number[];
  onChange: (index: number, value: number) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{
    index: number;
    min: number;
    max: number;
  } | null>(null);
  const safe = values.map((v) => (Number.isFinite(v) ? v : 625));
  const min =
    drag?.min ??
    Math.max(1, Math.floor((Math.min(...safe, 480) - 60) / 60) * 60);
  const max =
    drag?.max ??
    Math.min(5999, Math.ceil((Math.max(...safe, 900) + 60) / 60) * 60);
  const y = (p: number) => 40 + ((p - min) / (max - min)) * 150;
  return (
    <div className="visual-pace">
      <p className="muted">
        Drag the five nodes up for faster releases or down for slower releases.
        Sections stay fixed.
      </p>
      <svg
        ref={svg}
        viewBox="0 0 600 245"
        aria-label="Five fixed release pace sections"
        className="pace-editor"
      >
        {[min, (min + max) / 2, max].map((p) => (
          <g key={p}>
            <line x1="52" x2="590" y1={y(p)} y2={y(p)} stroke="#d7e1d7" />
            <text x="3" y={y(p) + 4}>
              {pace(p)}
            </text>
          </g>
        ))}
        <text x="52" y="18">
          FASTER ↑ · PACE / MILE · ↓ SLOWER
        </text>
        {bins.map((bin, i) => {
          const x = 64 + i * 106;
          return (
            <g key={bin.bin_id}>
              <line
                x1={x}
                x2={x + 100}
                y1={y(safe[i])}
                y2={y(safe[i])}
                stroke="#277b71"
                strokeWidth="3"
              />
              {i < 4 && (
                <line
                  x1={x + 100}
                  x2={x + 106}
                  y1={y(safe[i])}
                  y2={y(safe[i + 1])}
                  stroke="#277b71"
                  strokeDasharray="2 3"
                />
              )}
              <circle
                cx={x + 50}
                cy={y(safe[i])}
                r="11"
                fill="#277b71"
                stroke="white"
                strokeWidth="3"
                tabIndex={0}
                role="slider"
                aria-label={`Visual pace node ${i + 1}, legs ${bin.first_leg} to ${bin.last_leg}`}
                aria-valuemin={1}
                aria-valuemax={5999}
                aria-valuenow={safe[i]}
                aria-valuetext={`${pace(safe[i])} per mile`}
                onKeyDown={(e) => {
                  if (
                    [
                      "ArrowUp",
                      "ArrowDown",
                      "ArrowLeft",
                      "ArrowRight",
                    ].includes(e.key)
                  ) {
                    e.preventDefault();
                    onChange(
                      i,
                      Math.max(
                        1,
                        Math.min(
                          5999,
                          safe[i] +
                            (["ArrowUp", "ArrowLeft"].includes(e.key) ? -1 : 1),
                        ),
                      ),
                    );
                  }
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDrag({ index: i, min, max });
                }}
                onPointerMove={(e) => {
                  if (drag?.index !== i || !svg.current) return;
                  const point = new DOMPoint(
                    e.clientX,
                    e.clientY,
                  ).matrixTransform(svg.current.getScreenCTM()!.inverse());
                  onChange(
                    i,
                    Math.max(
                      1,
                      Math.min(
                        5999,
                        Math.round(
                          min +
                            ((Math.max(40, Math.min(190, point.y)) - 40) /
                              150) *
                              (max - min),
                        ),
                      ),
                    ),
                  );
                }}
                onPointerUp={(e) => {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  setDrag(null);
                }}
                onPointerCancel={() => setDrag(null)}
              />
              <text x={x + 50} y="216" textAnchor="middle">
                Legs {bin.first_leg}–{bin.last_leg}
              </text>
              <text x={x + 50} y="236" textAnchor="middle">
                {pace(safe[i])}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="visual-pace-inputs">
        {bins.map((bin, i) => (
          <label className="field" key={bin.bin_id}>
            <span>
              Legs {bin.first_leg}–{bin.last_leg}
            </span>
            <PaceInput
              label={`Visual section ${i + 1} pace`}
              value={values[i]}
              onChange={(v) => onChange(i, v)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
