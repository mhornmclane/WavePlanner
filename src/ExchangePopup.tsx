import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clock, duration } from "./format";
import type { Simulation } from "./model";

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
  result,
  close,
  pin,
  enter,
  leave,
}: {
  target: PopupTarget;
  result: Simulation;
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
  const field = result.exchanges[target.index];
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
  }, [target, result]);
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
  if (!field) return null;
  const first =
    field.index === 0 ? field.earliestDeparture : field.earliestArrival;
  const rows = [
    [field.index === 0 ? "First departure" : "First arrival", clock(first)],
    ["Last activity", clock(field.latestActivity)],
    ["Coverage spread", spread(first, field.latestActivity)],
  ];
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
              : `EX ${field.index}`}
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
      <table>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
    document.body,
  );
}
