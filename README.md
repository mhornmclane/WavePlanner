# Ruck4HIT Pace Planner

A browser-only race configuration simulator for the 71-leg, 205.72-mile 2026 course. Select any of the 51 supplied team-year pace profiles, assign starting waves, and compare course spread and exchange staffing coverage against the 2026 rules.

## Run locally

Use Node.js 24 LTS and npm. From this directory:

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. All historical and course data are bundled; the application makes no network requests after its assets load. Local saves stay in the current browser and origin. Export JSON for sharing or backup.

## Plan a race

1. In **Starting waves**, name/color waves and enter start offsets in hours relative to Day 1 at 01:00. The resulting day/time is displayed beside each offset: `-3` gives Day 0 at 22:00 (the previous evening), `+3` gives Day 1 at 04:00, and `0.5` gives Day 1 at 01:30. The initial scenario starts all 51 profiles at Day 1, 01:00. Waves with positive start offsets run sequentially through leg 35; releases activate separately when each team reaches the monument at mile 100.08. Split a wave's pace range to add a wave; preview and edit the proposed boundary before confirming.
2. Wave ranges are numbered and displayed slowest to fastest (Wave 1 is slowest), independently of start times. Adjacent min/max fields share one boundary, with no overlap or gaps. Apply edits with Enter or by leaving the field. The exact-boundary team belongs to the slower range; outer ends have no limit. Invalid boundary edits leave the last valid assignment active. Expand each wave to see its included team/year records and overall paces. Removing a wave merges its interval into the adjacent faster wave, or the slower neighbor when removing the fastest wave.
3. In **Historical field**, filter by year/name and select teams. Click **Overall** to sort fastest-first or slowest-first. The same name in different years remains a separate profile. All selected teams are assigned automatically using the supplied overall mean, independently of table filters. Older manual configurations retain their assignment controls until **Preview pace ranges → Apply pace ranges**; the preview shows the proposed team rosters.
4. In **Release schedule**, choose the exact published timetable, custom generated pace segments, or **Visual five-section pace**. The visual option has five fixed sections: legs 1–14, 15–28, 29–42, 43–56, and 57–71. Drag nodes vertically or use their m:ss fields. Focus a node and use arrow keys for one-second changes (up/left faster, down/right slower). Visual and custom settings are retained independently when switching modes. Both use the release anchor and challenge allowances. A pace beginning at leg 15 first affects the release at the start of leg 16. Inspect all 71 releases below the controls.
5. Set challenge durations and staffing buffers. Toggle **2026 baseline**, highlight a team, and switch the chart between miles and exchange sequence. Zoom expands the horizontal timeline. Pace-bin guides explain slope changes; the dark dashed line and release points show the schedule, with five pace labels in visual mode. The published timetable's 10:25 pace is nominal: its exact minute times include challenge allowances.
6. Hover near either endpoint of a travel segment for a compact whole-field summary: exchange, first arrival, last activity (latest arrival or departure), and coverage spread. Spread runs from first arrival to last activity and excludes staffing buffers; the start line uses first departure instead. Click/tap the segment or **Pin** to retain the popup; Escape, its close button, or an outside click dismisses it. Pinned details remain in the viewport while scrolling; changing zoom/axis/highlight or resizing dismisses the popup. For keyboard access, use **Inspect exchange → Show exchange details** for the whole selected field. Release points show the same compact exchange summary. Detailed staffing windows and baseline comparisons remain in the table.
7. Review staffing windows and export all 72 occurrences as CSV, including both earliest and latest departure. Save named configurations locally or export/import versioned JSON. A baseline copy is editable; the comparison reference is immutable.

Constant historical pace produces straight distance/time sections within each bin. In exchange view, every leg gets equal vertical space despite differing distances, producing more varied slopes. Releases and waits add further changes. No random leg-to-leg variation is invented: each sloped segment represents an independent runner, and overlapping legs remain visible.

Invalid inputs for the selected release mode suspend results until corrected. Invalid pace settings in inactive release modes do not block simulation or saving; switching back validates those settings again. The generated and visual modes share a time anchor, which the published timetable ignores. Invalid imports preserve the open configuration. Loading another configuration replaces the working copy, so save or export edits you want to keep first. Deleting a saved configuration leaves the working copy recoverable with Save.

## Simulation contract

All internal times are seconds relative to Day 1 midnight (negative values support starts on the previous evening); chart elapsed zero is always Day 1, 01:00, including when waves start earlier. Event days are logical 24-hour days, independent of dates, timezones, or daylight-saving transitions. Calculations retain fractional seconds; displayed times are rounded to minutes. Coverage starts round down and coverage ends round up so display rounding never shortens a staffing window. Durations and totals still use the precise internal values.

For team `t` and leg `i`:

```text
duration[t,i] = distance[i] × team's supplied pace for the bin containing leg i
departure[t,1] = assigned wave start
ready[t,i] = arrival[t,i-1] + challenge allowance before leg i
late[t] = wave start > Day 1 01:00
suppressed[t,i] = late[t] and i <= 35
monument floor[t,i] = arrival[t,35] if late[t] and i >= 36, otherwise no floor
candidate[t,i] = ready[t,i] if suppressed[t,i], otherwise min(ready[t,i], release[i])
eligible[t,i] = max(wave start, departure[t,i-1], monument floor[t,i], candidate[t,i])
departure[t,i] = max(eligible[t,i], fixed gate opening if present)
arrival[t,i] = departure[t,i] + duration[t,i]
```

For waves starting strictly after Day 1, 01:00, releases are ignored through leg 35: each outgoing runner waits for the preceding arrival. From leg 36 onward, the shared timetable resumes, including expired releases, but no subsequent leg may start before that team’s actual monument arrival. An expired leg-36 release can bypass the monument challenge and depart immediately on arrival. Waves starting at or before the nominal start retain the original release rules. Detailed leg inspection labels suppressed releases.

An actual departure before `ready` counts as a time release. A challenge release may bypass some or all challenge waiting, including departing before the incoming runner. Challenge waiting is the portion between incoming arrival and eligible departure, capped at the configured challenge duration. Gate waiting is the additional delay from eligible departure until gate opening. Neither changes moving time.

Generated releases accumulate each traversed leg's distance × configured release pace, plus challenge allowances before legs 36 and 54. The published mode reads the original minute-resolution times verbatim and does not regenerate them from 10:25/mile.

The baseline uses the current selected field, one Day 1, 01:00 start, published releases, assumed 16-minute monument and 21-minute lighthouse challenges, and the fixed Day 2, 06:00 opening of leg 70. Staffing buffers are applied equally to both scenarios, so the coverage comparison measures race-rule changes. Baseline challenge durations are assumptions inferred from the supplied schedule and agreed for this model, not measured historical durations.

Team moving time is the sum of all leg durations. Final-leg arrival and completion of all outstanding legs are separate: early releases can leave an earlier runner on course after the final-leg runner finishes. Peak active runners counts arrivals before departures when events tie.

Each exchange occurrence has its own row, even if the physical location is reused. Coverage starts at the earliest arrival or departure minus the setup buffer and ends at the latest arrival or departure plus the closeout buffer. There are 72 occurrences: the start, 70 intermediate exchanges, and the finish. Summed coverage is **exchange-hours**, not a staffing headcount or volunteer-hours. It does not merge windows at reused physical sites.

Outgoing runners are assumed ready and available. The model excludes individual rosters/rotation, vehicle travel, handoff delays, unscheduled breaks, additional HELOS-only entrants, experimental restarts, and safety pauses. Results are deterministic estimates based on segment-average paces, not an exact replay of 2026.

## Data and configuration format

### Spread replay

Switch from **Time / course chart** to **Spread replay** to compare arrival times exchange by exchange. The opening frame compares wave starts; frames 1–71 compare incoming arrivals through the finish. Each team's horizontal position is the latest field arrival minus its own arrival, in hours. The last team stays at zero and the leader's position is the total spread. Staffing buffers do not affect this view, and releases never hide late incoming arrivals.

The scale is fixed to the greatest spread across all frames (one hour if every spread is zero). Wave-colored dots share one horizontal line and overlap naturally at close or identical times. Hover, focus, or tap a marker for details; tap pins it, and Escape or the clear button dismisses inspection. Search and highlight a team without changing field spread. Use team search or keyboard focus to inspect teams hidden beneath overlapping dots.

Use Previous/Next or the exchange slider for manual inspection. Play advances exchange snapshots at 0.25–5 seconds per exchange, defaulting to one second. Loop is off initially. Manual navigation pauses playback; simulation changes reset it, and leaving the view stops the timer. Frames stay in course order even if independent released legs have out-of-order arrival times: this is a comparison of arrival spread, not physical positions at a shared clock time. Reduced-motion preferences disable marker transitions. Replay controls are temporary view state and do not change saved configurations or the simulation model.

`src/replay.ts` contains pure replay-frame generation helpers, independent of React. Replay tests cover summary agreement, precision, ties, staggered starts, releases, empty fields, playback, inspection, and mobile layout.

- `src/data/course.json`: supplied Course Matrix version 2026-01-29, including distances, releases, challenges, and the JBCC gate.
- `src/data/historical.json`: supplied historical records for 2024–2026. Pace values and names are preserved. Overall means are displayed as supplied; simulation uses each leg's applicable bin.
- `src/model.ts`: course/profile, scenario, per-leg result, and exchange-summary types.
- `src/engine.ts`: deterministic calculations, independent of React and browser storage.
- `src/storage.ts`: validation, versioned JSON, browser persistence, and CSV export.

Configuration JSON has `schemaVersion: 2`, course/historical source identifiers, `name`, `selectedTeamIds` (`year::exact team name`), `waves`, `assignments`, `waveRules`, `release`, `challenges`, and `buffers`. Times and durations are seconds; paces are seconds/mile. Wave start offsets are an input convenience: `waves[].start` retains its existing absolute-seconds representation, so old saves load without conversion. Wave starts may be up to 30 days before Day 1 midnight or before the end of Day 30. Source IDs must match bundled data. Every selected team must have exactly one assignment to an existing wave. Segments must include leg 1 and have unique starting legs from 1–71. Import normalizes segment order. Configurations do not embed or override historical paces or course distances.

`waveRules` contains `mode` (`pace` or legacy `manual`) and an increasing list of shared `boundaries` in seconds/mile. Pace mode requires exactly one fewer boundary than waves; manual mode has no boundaries. Assignments in pace mode are recalculated from these rules. `release.mode` is `published`, `generated`, or `visual`; `release.visualPaces` contains exactly five pace values, separate from custom `segments`. Version 1 JSON files and existing browser saves migrate in memory to version 2 with manual assignments intact and five default 625-second visual paces. The existing browser storage key is retained so saved scenarios remain available; saving/exporting writes version 2. The late-wave monument rule applies automatically when loading existing positive-offset scenarios; no configuration migration is needed. Their simulated elapsed times can therefore change, while moving totals remain unchanged. Unsupported versions or mismatched source data are rejected.

## Verify

```sh
npm test
npm run build
npm run test:browser
```

Browser tests use an installed Chrome in headless mode. If Chrome is unavailable, install it with `npx playwright install chrome` or configure Playwright to use your installed browser. Tests run against the production build served at `/PacePlanner/`, checking asset loading beneath a repository subpath, calculations versus UI, field/wave editing, validation, storage/import/export, chart controls, keyboard navigation, and mobile overflow.

To preview the production build yourself:

```sh
npm run preview:pages
```

Open `http://127.0.0.1:4173/PacePlanner/`. Development/browser-test screenshots and reports are ignored by Git.

## Deploy to GitHub Pages

Live site: [Ruck4HIT Pace Planner](https://mhornmclane.github.io/WavePlanner/).

The `dist/` directory is the complete static production site. Vite uses relative asset URLs, so it works at a repository subpath or domain root. It requires HTTP(S) hosting; opening `index.html` directly as a `file://` URL is not supported.

1. Push this project to your GitHub repository.
2. In repository **Settings → Pages**, choose **GitHub Actions** as the source.
3. Push changes to `main`. The **Deploy Pace Planner** workflow automatically installs locked dependencies, runs the unit tests, builds the app, and publishes `dist/` through GitHub Pages. It can also be run manually from **Actions**.
4. Use the deployment URL shown by the workflow. Running the workflow again updates the site.

For future updates, ask to commit and push: once those changes reach `main`, deployment runs automatically. Local edits and commits that have not been pushed do not change the live site. Failed tests or builds prevent a new deployment and leave the previous site in place. Alternatively upload the contents of `dist/` to any static host. No server environment variables, API keys, or database are needed.
