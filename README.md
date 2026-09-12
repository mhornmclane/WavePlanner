# Ruck4HIT Pace Planner

A browser-only planner for the 71-leg, 205.72-mile 2026 course, using 51 historical team-year pace profiles from 2024–2026. All data is bundled; configurations stay in the current browser unless exported.

## Run and verify

Use Node.js 24 LTS and npm:

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:browser
```

Browser tests run the production build at `/PacePlanner/` using installed Chrome. To preview that build, run `npm run preview:pages` and open `http://127.0.0.1:4173/PacePlanner/`.

## Four workspaces

**Historical data** is an independent browser for past performance. Filter by year or team and sort by overall pace. Export the filtered records or all historical records to CSV. Exports include profile ID, team, year, supplied overall pace, and every segment pace in numeric seconds/mile. Historical browsing does not change simulation selection.

**Historical replay** independently replays the 51 supplied team-year records using their unrounded per-leg paces and the fixed published baseline rules. Select one or more years (2025 by default); each year has a stable color and its own last arrival at zero. A common horizontal scale spans all selected years and exchanges. Per-year first/last arrival and spread metrics update at each step. These are recorded leg paces replayed on the bundled 2026 course and baseline, not recorded arrival timestamps. Simulation edits, invalid settings, and historical table filters never affect this replay.

A circle marks arrival at or before the outgoing leg’s published release; a diamond marks a strictly later incoming arrival. Start and Finish remain circles. Inspection gives the release, time late, and whether the next runner actually departed before arrival (respecting gate delays). Each team has one marker. Changing years pauses playback while retaining the exchange; leaving the section pauses and preserves playback preferences.

**Simulation** opens by default. The graph and replay share a Teams selector, defaulting to 2025; choose all years or a specific year; a team appearing in multiple years remains a separate profile for each performance. Compact wave rows sit above the full-width live chart, with a shared finish-target strip and responsive layouts for smaller screens. Select a wave's team count to view its roster and split its range. Wave arrangements provide editable starting points while preserving the selected field, finish target, and other settings. Optional hypothetical teams, timing rules, challenge allowances, and staffing buffers show current values in an expandable settings bar.

**Results** always reflects the current valid configuration. It includes summary metrics, team finishes, timing-rule evaluations, all 72 exchange staffing windows, and the 71 release times. Export team results or exchange staffing CSV. Returning to Simulation and editing automatically updates Results. Invalid scenario inputs suspend simulation and result exports until corrected.

The configuration files toolbar supports named browser saves, loading, duplication, deletion, JSON export, and import. Rejected imports preserve the current working configuration. Historical filters, chart settings, and section state persist while navigating. Leaving spread replay pauses it; changing simulation data resets playback.

## Graph navigation

The course graph includes **Inspect**, **Zoom region**, and **Pan** modes. In Zoom region, drag a rectangle around the time and course area to enlarge. In Pan, drag to move around the enlarged view. Both work with a mouse or a single touch. A tiny drag does not accidentally zoom.

Use **+**, **−**, **Previous view**, or **Reset view** in the toolbar. Reset fits the full course without clearing the highlighted team. In Zoom region or Pan, the mouse wheel zooms around the pointer; trackpad pinch (Ctrl/Meta-wheel) also zooms in Inspect mode. Ordinary scrolling in Inspect mode scrolls the page. Double-click in a navigation mode zooms in; Shift-double-click zooms out.

Focus the graph for keyboard controls: +/− zoom, arrow keys pan, 0/Home fits the course, and Escape cancels an unfinished selection. Navigation is bounded to the full data extent, with up to 100× magnification. Axes and inspection coordinates update with the viewport; lines are clipped to the plot. Changing the course axis or simulation resets the view. Navigation never changes saved race settings or results.

## Finish target and release schedule

Wave 1 is always the slowest pace range, independently of its start time. The shared finish strip contains the target final-leg finish weekday/time, a single release pace in min:sec/mile, and the latest-start estimate for Wave 1.

```text
latest start = target finish
             − total course distance × release pace
             − monument challenge allowance
             − lighthouse challenge allowance
```

This is guidance only: it never changes any wave start and has no Apply action. The guidance rounds down to a minute so it does not suggest starting later than the exact calculation. A later selected Wave 1 start produces a warning.

Release times are generated forward from that calculated start, using constant pace and allowances before legs 36 and 54. The calculation includes travel along the final leg: its release plus its duration at the release pace equals the target finish. Adjusting challenges changes the latest start while preserving the target.

The target is a planning reference, not a guarantee for historical profiles: their final-leg paces can differ from the release pace, and gate openings can delay departures. The chart marks the target, the summaries report final-leg overruns, and gate openings later than planned releases are flagged separately. Final-leg arrival and all outstanding runners off course remain distinct metrics because released legs can overlap.

Default release pace is 10:25/mile. The initial target is the published final-leg release plus that leg's duration at 10:25/mile. The published timetable is retained solely for the 2026 comparison; there are no alternate release editor modes.

## Wave and timing rules

Waves are stored in ascending pace order and displayed slowest first. Shared boundaries leave no gaps; an exact-boundary profile belongs to the slower wave. The first split moves teams strictly faster than the entered pace into a new wave, retaining teams at or slower than the pace in the original Wave 1 with its existing start. Later splits add a slower pace range; removing a wave merges its interval into its adjacent faster range, or the slower neighbor when removing the fastest. Invalid boundary edits retain the last applied assignment until corrected or canceled with Escape.

Wave 1 uses release times throughout the course. Every other wave uses the fast-wave activation policy, regardless of weekday or time:

- By default, run sequentially through exchange 35, then activate releases once each team physically reaches that exchange.
- A different activation exchange can be selected from 0 (start) through 70.
- Disabling fast-wave releases makes those waves sequential for the entire course.

For each leg, departure is never before the team's start, a preceding leg's departure, or its required activation arrival. Enabled gate openings can delay departure further. A time release can bypass some or all challenge waiting. Moving time always remains distance multiplied by the profile's pace for the relevant historical bin.

Timing rules support arrival deadlines, exchange-clearance deadlines, and departure openings. Deadlines report violations without stopping runners. Openings hold outgoing runners. Defaults remain monument clearance by Friday 7:00 PM and the JBCC gate opening Saturday 6:00 AM. Challenge defaults are 16 minutes at the monument and 21 minutes at the lighthouse.

Optional hypothetical fastest/slowest profiles retain flat or individual-bin pace editing. They follow the same assignments and race rules as historical profiles, survive simulation year changes, and appear in results and exports. Their initial paces extend the historical extremes by 30 seconds/mile; both are initially disabled.

## Time, coverage, and comparison

Friday is event Day 1, with a default start of Friday 1:00 AM. Inputs and output use weekdays and clock times. The weekday picker covers Thursday through Wednesday around the event, without additional-week options. Internally, times remain seconds relative to Friday midnight, independent of calendar dates, timezones, or daylight-saving changes. The chart's elapsed-hour origin stays Friday 1:00 AM.

Calculations preserve fractional seconds. Most display times round to minutes. Coverage starts round down and ends round up. Every exchange occurrence has its own window, including repeated physical locations: earliest activity minus setup buffer through latest activity plus closeout buffer. Summed coverage is exchange-hours, not volunteer headcount or volunteer-hours.

The immutable comparison uses the same selected profiles and hypothetical paces, a single Friday 1:00 AM start, exact published releases, 16/21-minute challenges, and the Saturday 6:00 AM JBCC opening. Staffing buffers apply equally to both scenarios.

The model assumes outgoing runners are available. It excludes individual runner rotations, vehicle travel, unscheduled breaks, handoff delays, extra HELOS entrants, and safety pauses. Replay compares arrival spread at each exchange rather than positions at a common clock time.

## Configuration contract

Version 6 JSON stores `fieldYear` (`"all"` or a bundled historical year), `release: { targetFinish, pace }`, selected profile IDs, automatic wave boundaries/assignments, hypothetical profiles, timing rules, challenges, and buffers. Paces are seconds/mile; times and durations are seconds. Source identifiers must match bundled data. Historical selected IDs must match the chosen field year; hypothetical inclusion is independent.

Browser storage uses `ruck4hit-scenarios-v6`. Earlier schemas and alternate release structures are rejected without migration, and old browser saves are not loaded. No backend or external account is required.

## Deployment

The static production output is `dist/`. Vite uses relative asset URLs, so it supports a repository subpath or domain root. Serve it over HTTP(S); opening `index.html` through `file://` is not supported.

The existing GitHub Pages workflow runs checks and publishes when changes are pushed to `main`. Local edits do not publish automatically. No server secrets or environment variables are needed.
