import { test, expect } from "@playwright/test";
import { baseline } from "../src/data";
import { simulate } from "../src/engine";

test('monument timetable warnings update live and appear in simulation and results',async({page})=>{
  const s=baseline();
  s.timingRules=s.timingRules.filter(r=>r.id==='monument-deadline');
  s.waves[0].release.targetFinish+=s.timingRules[0].time+600-simulate(s).releasesByWave['wave-1'][35];
  await page.goto('./');
  await page.getByText(/^Configuration files ·/).click();
  await page.getByLabel('Import configuration JSON').setInputFiles({name:'late-monument.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});
  const warning=page.getByRole('region',{name:'Release timetable warnings',exact:true});
  await expect(warning).toContainText('Wave 1 · EX 35');
  await expect(warning).toContainText('Friday 7:10 PM');
  await expect(warning).toContainText('Clear exchange by Friday 7:00 PM');
  await expect(warning).toContainText('0h 10m late');
  await expect(page.locator('.chart-canvas')).toBeVisible();
  await expect(page.getByRole('button',{name:'↓ JSON',exact:true})).toBeEnabled();
  await page.getByRole('navigation',{name:'Planner sections'}).getByRole('button',{name:'Results',exact:true}).click();
  await expect(warning).toBeVisible();
  await page.getByRole('navigation',{name:'Planner sections'}).getByRole('button',{name:'Simulation',exact:true}).click();
  await page.getByText('Timing rules & fast-wave releases',{exact:true}).click();
  await page.getByLabel('Enable timing rule 1',{exact:true}).uncheck();
  await expect(warning).toHaveCount(0);
  await page.getByLabel('Enable timing rule 1',{exact:true}).check();
  await expect(warning).toBeVisible();
  await page.getByLabel('Rule 1 time',{exact:true}).fill('20:00');
  await expect(warning).toHaveCount(0);
});
