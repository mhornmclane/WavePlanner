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

1. In **Starting waves**, name/color waves and enter their Day/time starts. The initial scenario starts all 51 profiles at Day 1, 01:00.
2. In **Historical field**, filter by year/name, select teams, and assign each selected record to one wave. The same name in different years remains a different team profile. Bulk assignment applies to selected teams currently shown by the filter.
3. In **Release schedule**, keep the exact published timetable or generate a shared course-wide schedule from an anchor and pace segments. A segment starting at leg 15 changes the allowed travel pace for leg 15 onward; its first effect is the release at the start of leg 16. Inspect all 71 calculated releases below the controls.
4. Set challenge durations and staffing buffers. Removing a wave reassigns its teams to the first remaining wave.
5. Toggle **2026 baseline**, highlight a team, inspect leg timings, and switch the vertical axis between miles and exchange sequence. Zoom expands the horizontal timeline; scroll to explore it. Every sloped segment represents an individual runner's travel, so overlapping legs are not hidden by a single team-progress line.
6. Review exchange staffing windows and export all 72 occurrences as CSV. Save named configurations locally or export/import versioned JSON. A baseline copy is editable; the reference used for comparison is not.

Invalid edits suspend results until corrected. Invalid imports preserve the open configuration. Loading another configuration replaces the open working copy, so save or export edits you want to keep first. Deleting a saved configuration leaves the current working copy open and recoverable with Save.

## Simulation contract

All internal times are seconds after Day 1 midnight; chart elapsed zero is always Day 1, 01:00, including when waves start earlier. Event days are logical 24-hour days, independent of dates, timezones, or daylight-saving transitions. Calculations retain fractional seconds; displayed times are rounded to minutes. Coverage starts round down and coverage ends round up so display rounding never shortens a staffing window. Durations and totals still use the precise internal values.

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

Configuration JSON has `schemaVersion: 1`, course/historical source identifiers, `name`, `selectedTeamIds` (`year::exact team name`), `waves`, `assignments`, `release`, `challenges`, and `buffers`. Times and durations are seconds; paces are seconds/mile. Source IDs must match bundled data. Every selected team must have exactly one assignment to an existing wave. Segments must include leg 1 and have unique starting legs from 1–71. Import normalizes segment order. Configurations do not embed or override historical paces or course distances.

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
