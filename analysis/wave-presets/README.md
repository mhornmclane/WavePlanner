# Wave release preset comparisons

Historical analysis: these experimental variants are no longer offered. The original seven presets now adjust each wave’s release pace to make its latest start compatible with launch. Values below describe the earlier experimental configurations.

Generated with `node scripts/tune-wave-presets.mjs` using the standard application engine and original preset race rules. All time metrics are seconds relative to Friday midnight; coverage is exchange-hours. Searches change only each wave’s target and release pace.

Acceptance requires a strict primary-metric improvement for all years pooled and each year separately, with no increase in any other measured metric or individual deadline lateness (floating-point tolerance 1e-7). The search uses coarse target steps of 15 minutes and pace steps of 10 seconds/mile, then 5 minutes and 5 seconds/mile, up to three sweeps per stage. Pace is bounded to 5:00–20:00/mile. It is a local search, not proof that rejected originals cannot improve.

## two-waves — not added

Objective: exchangeHours.

| Field | Coverage before → after | Finish spread (min) | Last finish (event seconds) | Releases | Peak concurrency | Deadline violations |
|---|---|---|---|---|---|---|
| all | 198.47 → 198.47 | 261.73 → 261.73 | 134891.87 → 134891.87 | 1006 → 1006 | 2 → 2 | 0 → 0 |
| 2024 | 151.92 → 151.92 | 207.03 → 207.03 | 134452.08 → 134452.08 | 248 → 248 | 2 → 2 | 0 → 0 |
| 2025 | 192.05 → 192.05 | 261.73 → 261.73 | 134891.87 → 134891.87 | 592 → 592 | 2 → 2 | 0 → 0 |
| 2026 | 179.18 → 179.18 | 223.52 → 223.52 | 134555.95 → 134555.95 | 166 → 166 | 2 → 2 | 0 → 0 |

## three-waves — not added

Objective: exchangeHours.

| Field | Coverage before → after | Finish spread (min) | Last finish (event seconds) | Releases | Peak concurrency | Deadline violations |
|---|---|---|---|---|---|---|
| all | 185.79 → 185.79 | 231.73 → 231.73 | 134891.87 → 134891.87 | 1005 → 1005 | 2 → 2 | 0 → 0 |
| 2024 | 144.64 → 144.64 | 177.03 → 177.03 | 134452.08 → 134452.08 | 247 → 247 | 2 → 2 | 0 → 0 |
| 2025 | 181.62 → 181.62 | 231.73 → 231.73 | 134891.87 → 134891.87 | 592 → 592 | 2 → 2 | 0 → 0 |
| 2026 | 149.44 → 149.44 | 193.52 → 193.52 | 134555.95 → 134555.95 | 166 → 166 | 2 → 2 | 0 → 0 |

## tight-finish — not added

Objective: finishSpread.

| Field | Coverage before → after | Finish spread (min) | Last finish (event seconds) | Releases | Peak concurrency | Deadline violations |
|---|---|---|---|---|---|---|
| all | 187.16 → 187.16 | 201.73 → 201.73 | 134891.87 → 134891.87 | 1007 → 1007 | 2 → 2 | 0 → 0 |
| 2024 | 152.78 → 152.78 | 148.14 → 148.14 | 134452.08 → 134452.08 | 249 → 249 | 2 → 2 | 0 → 0 |
| 2025 | 181.71 → 181.71 | 201.73 → 201.73 | 134891.87 → 134891.87 | 592 → 592 | 2 → 2 | 0 → 0 |
| 2026 | 145.91 → 145.91 | 163.52 → 163.52 | 134555.95 → 134555.95 | 166 → 166 | 2 → 2 | 0 → 0 |

## earlier-finish — added

Objective: lastFinish.

| Field | Coverage before → after | Finish spread (min) | Last finish (event seconds) | Releases | Peak concurrency | Deadline violations |
|---|---|---|---|---|---|---|
| all | 162.51 → 155.44 | 172.65 → 128.76 | 131347.12 → 128713.42 | 1333 → 1267 | 2 → 2 | 0 → 0 |
| 2024 | 131.71 → 122.35 | 117.95 → 74.05 | 130907.33 → 128273.63 | 465 → 460 | 2 → 2 | 0 → 0 |
| 2025 | 157.56 → 151.15 | 172.65 → 128.76 | 131347.12 → 128713.42 | 647 → 596 | 2 → 2 | 0 → 0 |
| 2026 | 132.10 → 127.47 | 134.44 → 90.54 | 131011.20 → 128377.50 | 221 → 211 | 2 → 2 | 0 → 0 |

## eleven-am — added

Objective: lastFinish.

| Field | Coverage before → after | Finish spread (min) | Last finish (event seconds) | Releases | Peak concurrency | Deadline violations |
|---|---|---|---|---|---|---|
| all | 124.02 → 121.68 | 93.37 → 78.74 | 126590.07 → 125712.17 | 2013 → 1932 | 2 → 2 | 0 → 0 |
| 2024 | 102.26 → 99.11 | 68.78 → 54.14 | 126150.28 → 125272.38 | 780 → 757 | 2 → 2 | 0 → 0 |
| 2025 | 116.85 → 113.31 | 93.37 → 78.74 | 126590.07 → 125712.17 | 879 → 826 | 2 → 2 | 0 → 0 |
| 2026 | 91.77 → 90.45 | 55.15 → 46.80 | 126254.15 → 125376.25 | 354 → 349 | 2 → 2 | 0 → 0 |

## earlier-launch — not added

Objective: releaseCount.

| Field | Coverage before → after | Finish spread (min) | Last finish (event seconds) | Releases | Peak concurrency | Deadline violations |
|---|---|---|---|---|---|---|
| all | 235.98 → 234.20 | 320.44 → 276.92 | 134814.52 → 132202.92 | 323 → 284 | 2 → 2 | 0 → 0 |
| 2024 | 173.82 → 173.82 | 217.37 → 217.37 | 131472.80 → 131472.80 | 1 → 1 | 1 → 1 | 0 → 0 |
| 2025 | 230.53 → 230.21 | 320.44 → 276.92 | 134814.52 → 132202.92 | 262 → 233 | 2 → 2 | 0 → 0 |
| 2026 | 207.17 → 201.96 | 282.23 → 238.70 | 134478.60 → 131867.00 | 60 → 50 | 2 → 2 | 0 → 0 |
