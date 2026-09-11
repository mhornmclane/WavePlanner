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

1. In **Starting waves**, name/color waves and enter start offsets in hours relative to Day 1 at 01:00. The resulting day/time is displayed beside each offset: `-3` gives Day 0 at 22:00 (the previous evening), `+3` gives Day 1 at 04:00, and `0.5` gives Day 1 at 01:30. The initial scenario starts all 51 profiles at Day 1, 01:00. Split a wave's pace range to add a wave; preview and edit the proposed boundary before confirming.
2. Wave ranges are ordered fastest to slowest, independently of start times. Adjacent min/max fields share one boundary, with no overlap or gaps. Apply edits with Enter or by leaving the field. The exact-boundary team belongs to the slower range; outer ends have no limit. Invalid boundary edits leave the last valid assignment active. Expand each wave to see its included team/year records and overall paces. Removing a wave merges its interval into the previous wave, or the next for the first wave.
3. In **Historical field**, filter by year/name and select teams. Click **Overall** to sort fastest-first or slowest-first. The same name in different years remains a separate profile. All selected teams are assigned automatically using the supplied overall mean, independently of table filters. Older manual configurations retain their assignment controls until **Preview pace ranges → Apply pace ranges**; the preview shows the proposed team rosters.
4. In **Release schedule**, choose the exact published timetable, custom generated pace segments, or **Visual five-section pace**. The visual option has five fixed sections: legs 1–14, 15–28, 29–42, 43–56, and 57–71. Drag nodes vertically or use their m:ss fields. Focus a node and use arrow keys for one-second changes (up/left faster, down/right slower). Visual and custom settings are retained independently when switching modes. Both use the release anchor and challenge allowances. A pace beginning at leg 15 first affects the release at the start of leg 16. Inspect all 71 releases below the controls.
5. Set challenge durations and staffing buffers. Toggle **2026 baseline**, highlight a team, and switch the chart between miles and exchange sequence. Zoom expands the horizontal timeline. Pace-bin guides explain slope changes; the dark dashed line and release points show the schedule, with five pace labels in visual mode. The published timetable's 10:25 pace is nominal: its exact minute times include challenge allowances.
6. Hover near either endpoint of a travel segment for that exchange's whole-field and wave arrival/departure windows, spreads, and coverage. Click/tap the segment or **Pin** to retain the popup; Escape, its close button, or an outside click dismisses it. Pinned details remain in the viewport while scrolling; changing zoom/axis/highlight or resizing dismisses the popup. For keyboard access, use **Inspect exchange → Show exchange details**, with the highlighted team or the first selected team. Release points also have schedule tooltips.
7. Review staffing windows and export all 72 occurrences as CSV, including both earliest and latest departure. Save named configurations locally or export/import versioned JSON. A baseline copy is editable; the comparison reference is immutable.

Constant historical pace produces straight distance/time sections within each bin. In exchange view, every leg gets equal vertical space despite differing distances, producing more varied slopes. Releases and waits add further changes. No random leg-to-leg variation is invented: each sloped segment represents an independent runner, and overlapping legs remain visible.

Invalid simulation inputs suspend results until corrected. Invalid imports preserve the open configuration. Loading another configuration replaces the working copy, so save or export edits you want to keep first. Deleting a saved configuration leaves the working copy recoverable with Save.

## Simulation contract

All internal times are seconds relative to Day 1 midnight (negative values support starts on the previous evening); chart elapsed zero is always Day 1, 01:00, including when waves start earlier. Event days are logical 24-hour days, independent of dates, timezones, or daylight-saving transitions. Calculations retain fractional seconds; displayed times are rounded to minutes. Coverage starts round down and coverage ends round up so display rounding never shortens a staffing window. Durations and totals still use the precise internal values.

For team `t` and leg `i`:

```text
duration[t,i] = distance[i] × team's supplied pace for the bin containing leg i
departure[t,1] = assigned wave start
ready[t,i] = arrival[t,i-1] + challenge allowance before leg i
eligible[t,i] = max(wave start, departure[t,i-1], min(ready[t,i], release[i]))
departure[t,i] = max(eligible[t,i], fixed gate opening if present)
arrival[t,i] = departure[t,i] + duration[t,i]
```

An actual departure before `ready` counts as a time release. A challenge release may bypass some or all challenge waiting, including departing before the incoming runner. Challenge waiting is the portion between incoming arrival and eligible departure, capped at the configured challenge duration. Gate waiting is the additional delay from eligible departure until gate opening. Neither changes moving time.

Generated releases accumulate each traversed leg's distance × configured release pace, plus challenge allowances before legs 36 and 54. The published mode reads the original minute-resolution times verbatim and does not regenerate them from 10:25/mile.

The baseline uses the current selected field, one Day 1, 01:00 start, published releases, assumed 16-minute monument and 21-minute lighthouse challenges, and the fixed Day 2, 06:00 opening of leg 70. Staffing buffers are applied equally to both scenarios, so the coverage comparison measures race-rule changes. Baseline challenge durations are assumptions inferred from the supplied schedule and agreed for this model, not measured historical durations.

Team moving time is the sum of all leg durations. Final-leg arrival and completion of all outstanding legs are separate: early releases can leave an earlier runner on course after the final-leg runner finishes. Peak active runners counts arrivals before departures when events tie.

Each exchange occurrence has its own row, even if the physical location is reused. Coverage starts at the earliest arrival or departure minus the setup buffer and ends at the latest arrival or departure plus the closeout buffer. There are 72 occurrences: the start, 70 intermediate exchanges, and the finish. Summed coverage is **exchange-hours**, not a staffing headcount or volunteer-hours. It does not merge windows at reused physical sites.

Outgoing runners are assumed ready and available. The model excludes individual rosters/rotation, vehicle travel, handoff delays, unscheduled breaks, additional HELOS-only entrants, experimental restarts, and safety pauses. Results are deterministic estimates based on segment-average paces, not an exact replay of 2026.

## Data and configuration format

- `src/data/course.json`: supplied Course Matrix version 2026-01-29, including distances, releases, challenges, and the JBCC gate.
- `src/data/historical.json`: supplied historical records for 2024–2026. Pace values and names are preserved. Overall means are displayed as supplied; simulation uses each leg's applicable bin.
- `src/model.ts`: course/profile, scenario, per-leg result, and exchange-summary types.
- `src/engine.ts`: deterministic calculations, independent of React and browser storage.
- `src/storage.ts`: validation, versioned JSON, browser persistence, and CSV export.

Configuration JSON has `schemaVersion: 2`, course/historical source identifiers, `name`, `selectedTeamIds` (`year::exact team name`), `waves`, `assignments`, `waveRules`, `release`, `challenges`, and `buffers`. Times and durations are seconds; paces are seconds/mile. Wave start offsets are an input convenience: `waves[].start` retains its existing absolute-seconds representation, so old saves load without conversion. Wave starts may be up to 30 days before Day 1 midnight or before the end of Day 30. Source IDs must match bundled data. Every selected team must have exactly one assignment to an existing wave. Segments must include leg 1 and have unique starting legs from 1–71. Import normalizes segment order. Configurations do not embed or override historical paces or course distances.

`waveRules` contains `mode` (`pace` or legacy `manual`) and an increasing list of shared `boundaries` in seconds/mile. Pace mode requires exactly one fewer boundary than waves; manual mode has no boundaries. Assignments in pace mode are recalculated from these rules. `release.mode` is `published`, `generated`, or `visual`; `release.visualPaces` contains exactly five pace values, separate from custom `segments`. Version 1 JSON files and existing browser saves migrate in memory to version 2 with manual assignments intact and five default 625-second visual paces. The existing browser storage key is retained so saved scenarios remain available; saving/exporting writes version 2. Unsupported versions or mismatched source data are rejected.

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
