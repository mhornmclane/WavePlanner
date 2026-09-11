import { useState } from "react";
import { clock, delta, duration } from "./format";
import { download, staffingCsv } from "./storage";
import type { Simulation } from "./model";

export function Staffing({
  result,
  comparison,
  overlay,
}: {
  result: Simulation;
  comparison: Simulation;
  overlay: boolean;
}) {
  const [search, setSearch] = useState("");
  const rows = result.exchanges.filter((e) =>
    `${e.index} ${e.name}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="panel" aria-labelledby="staffing-title">
      <div className="section-head">
        <div>
          <div className="eyebrow">03 / EVALUATE</div>
          <h2 id="staffing-title">Exchange staffing windows</h2>
        </div>
        <button
          onClick={() =>
            download(
              "ruck4hit-exchange-staffing.csv",
              staffingCsv(result, comparison),
              "text/csv;charset=utf-8",
            )
          }
        >
          ↓ Export all CSV
        </button>
      </div>
      <div className="staffing-intro">
        <p className="muted">
          Cover the first arrival or departure through the last activity, plus
          your buffers. Late incoming runners always count. Displayed coverage
          starts round down and ends round up to whole minutes.
        </p>
        <input
          type="search"
          aria-label="Find exchange"
          placeholder="Find an exchange…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div
        className="table-scroll staffing-table"
        tabIndex={0}
        aria-label="Exchange staffing table, horizontally scrollable"
      >
        <table>
          <thead>
            <tr>
              <th>Exchange / location</th>
              <th>Mile</th>
              <th>First arrival</th>
              <th>Last arrival</th>
              <th>First departure</th>
              <th>Last activity</th>
              <th>Coverage begins</th>
              <th>Coverage ends</th>
              <th>Coverage</th>
              {overlay && (
                <>
                  <th>2026 coverage</th>
                  <th>Δ begins</th>
                  <th>Δ ends</th>
                  <th>Δ duration</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const b = comparison.exchanges[e.index];
              const diff = e.coverage - b.coverage;
              return (
                <tr key={e.index}>
                  <th scope="row">
                    <span className="exchange-id">
                      {e.index === 0
                        ? "START"
                        : e.index === 71
                          ? "FINISH"
                          : `EX ${String(e.index).padStart(2, "0")}`}
                    </span>
                    <span>{e.name}</span>
                  </th>
                  <td>{e.miles.toFixed(2)}</td>
                  <td>{clock(e.earliestArrival)}</td>
                  <td>{clock(e.latestArrival)}</td>
                  <td>{clock(e.earliestDeparture)}</td>
                  <td>{clock(e.latestActivity)}</td>
                  <td>{clock(e.coverageStart, "down")}</td>
                  <td>{clock(e.coverageEnd, "up")}</td>
                  <td className="coverage-cell">
                    {e.coverageStart === null ? "—" : duration(e.coverage)}
                  </td>
                  {overlay && (
                    <>
                      <td>
                        {b.coverageStart === null ? "—" : duration(b.coverage)}
                      </td>
                      <td>
                        {e.coverageStart !== null && b.coverageStart !== null
                          ? delta(e.coverageStart - b.coverageStart)
                          : "—"}
                      </td>
                      <td>
                        {e.coverageEnd !== null && b.coverageEnd !== null
                          ? delta(e.coverageEnd - b.coverageEnd)
                          : "—"}
                      </td>
                      <td
                        className={
                          diff < -0.5
                            ? "improved"
                            : diff > 0.5
                              ? "increased"
                              : ""
                        }
                      >
                        {delta(diff)}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <div className="empty">No exchanges match this search.</div>
        )}
      </div>
      <div className="table-footer">
        <span>
          {rows.length} of 72 exchange occurrences · Repeated locations remain
          separate
        </span>
        <strong>{result.exchangeHours.toFixed(1)} exchange-hours total</strong>
      </div>
    </section>
  );
}
