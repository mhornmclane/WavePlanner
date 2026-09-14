// Offline search using the application engine, never run by the user interface.
import { createServer } from 'vite';
import fs from 'node:fs';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { createPreset } = await server.ssrLoadModule('/src/presets.ts');
  const { fieldIds } = await server.ssrLoadModule('/src/data.ts');
  const { simulate } = await server.ssrLoadModule('/src/engine.ts');
  const years = ['all', 2024, 2025, 2026];
  const objectives = {
    'two-waves': 'exchangeHours', 'three-waves': 'exchangeHours',
    'tight-finish': 'finishSpread', 'earlier-finish': 'lastFinish',
    'eleven-am': 'lastFinish', 'earlier-launch': 'releaseCount',
  };
  const metrics = r => ({
    exchangeHours: r.exchangeHours, finishSpread: r.finishSpread,
    lastFinish: Math.max(...r.teams.map(t => t.finish)), lastOffCourse: r.lastOffCourse,
    releaseCount: r.releaseCount, peakActive: r.peakActive,
    violations: r.timingRules.flatMap(rule => rule.teams.map(t => t.lateness)),
  });
  const flat = m => [m.exchangeHours, m.finishSpread, m.lastFinish, m.lastOffCourse,
    m.releaseCount, m.peakActive, ...m.violations];
  const noWorse = (candidate, reference) => flat(candidate).every((v, i) => v <= flat(reference)[i] + 1e-7);
  const report = [];
  for (const [id, objective] of Object.entries(objectives)) {
    const scenarios = years.map(year => createPreset(id, fieldIds(year)));
    const evaluate = releases => scenarios.map(s => metrics(simulate({ ...s,
      waves: s.waves.map((w, i) => ({ ...w, release: releases[i] })) })));
    let chosen = scenarios[0].waves.map(w => ({ ...w.release }));
    const original = evaluate(chosen);
    let best = original;
    // Coordinate descent over explicit, bounded settings, coarse then fine.
    for (const [timeStep, paceStep, radius] of [[900, 10, 8], [300, 5, 3]]) {
      for (let sweep = 0; sweep < 3; sweep++) {
        let changed = false;
        for (let wave = 0; wave < chosen.length; wave++) {
          const center = { ...chosen[wave] };
          for (let dt = -radius; dt <= radius; dt++) for (let dp = -radius; dp <= radius; dp++) {
            const candidate = chosen.map(r => ({ ...r }));
            candidate[wave] = { targetFinish: center.targetFinish + dt * timeStep, pace: center.pace + dp * paceStep };
            if (candidate[wave].pace < 300 || candidate[wave].pace > 1200) continue;
            const values = evaluate(candidate);
            if (values.every((v, i) => noWorse(v, original[i])) &&
                values[0][objective] < best[0][objective] - 1e-7) {
              chosen = candidate; best = values; changed = true;
            }
          }
        }
        if (!changed) break;
      }
    }
    const accepted = best.every((m, i) => m[objective] < original[i][objective] - 1e-7);
    const compact = values => values.map(({ violations, ...v }, i) => ({ year: years[i], ...v,
      deadlineViolations: violations.filter(v => v > 0).length, maxLateness: Math.max(0, ...violations) }));
    report.push({ id, objective, accepted, waves: scenarios[0].waves.map((w, i) => ({ id: w.id, release: chosen[i] })),
      original: compact(original), tuned: compact(best) });
    console.log(JSON.stringify(report.at(-1)));
  }
  fs.mkdirSync('analysis/wave-presets', { recursive: true });
  fs.writeFileSync('analysis/wave-presets/results.json', JSON.stringify(report, null, 2));
} finally { await server.close(); }
