import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { course } from "../src/data";
import { clock, precisePace } from "../src/format";
import type { Scenario } from "../src/model";

async function saved(page: Page): Promise<Scenario> {
  const button=page.getByRole('button',{name:'↓ JSON',exact:true});
  if(!await button.isVisible())await page.getByText(/^Configuration files ·/).click();
  const download=page.waitForEvent('download');await button.click();
  return JSON.parse(await readFile((await (await download).path())!,'utf8'));
}
const mode=(page:Page,wave:number,name:string)=>page.getByRole('group',{name:`Wave ${wave} solver`,exact:true}).getByRole('radio',{name,exact:true});

test('solver changes calculate immediately, update live, and allow manual editing with None',async({page})=>{
  await page.goto('./');
  await page.getByLabel('Strategy preset').selectOption('three-waves');
  await mode(page,2,'Start').check();
  const start=page.getByLabel('Wave 2 start time',{exact:true});
  await expect(start).toHaveJSProperty('readOnly',true);
  await page.getByLabel('Wave 2 target finish time',{exact:true}).fill('12:00');
  let s=await saved(page),w=s.waves[1];
  expect(w.start).toBeCloseTo(w.release.targetFinish-course.event.total_distance_miles*w.release.pace-s.challenges.monument-s.challenges.lighthouse,8);
  await expect(start).toHaveValue(clock(w.start));
  await expect(page.locator('.wave-card').nth(1).locator('.rule-failed')).toHaveCount(0);

  await mode(page,2,'Finish').check();
  const finish=page.getByLabel('Wave 2 target finish time',{exact:true});
  await expect(finish).toHaveJSProperty('readOnly',true);
  await start.fill('02:00');
  s=await saved(page);w=s.waves[1];
  await expect(finish).toHaveValue(clock(w.start+course.event.total_distance_miles*w.release.pace+s.challenges.monument+s.challenges.lighthouse));
  const previous=w.release.targetFinish;
  await page.getByText('Challenge allowances',{exact:true}).click();
  await page.getByLabel('Monument challenge',{exact:true}).fill('26');
  await expect(finish).toHaveValue(clock(previous+600));

  await mode(page,2,'Pace').check();
  await finish.fill('13:00');
  const pace=page.getByLabel('Wave 2 release pace',{exact:true});
  await expect(pace).toHaveJSProperty('readOnly',true);
  s=await saved(page);w=s.waves[1];
  const expected=(w.release.targetFinish-w.start-s.challenges.monument-s.challenges.lighthouse)/course.event.total_distance_miles;
  expect(w.release.pace).toBe(expected);
  await expect(pace).toHaveValue(precisePace(expected));
  await expect(page.locator('.wave-release-guide[data-wave-ids="wave-2"]')).toBeVisible();
  await expect(mode(page,1,'Finish')).toBeChecked();
  await mode(page,2,'None').check();
  await expect(pace).toHaveJSProperty('readOnly',false);
  expect((await saved(page)).waves[1].release.pace).toBe(expected);
});

test('invalid solutions withhold results and exports, then recover',async({page})=>{
  await page.goto('./');
  await mode(page,1,'Pace').check();
  await page.getByLabel('Wave 1 target finish weekday').selectOption('0');
  await page.getByLabel('Wave 1 target finish time',{exact:true}).fill('01:01');
  await expect(page.locator('.solver-error')).toContainText('calculated pace must be between');
  await expect(page.getByLabel('Wave 1 release pace',{exact:true})).toHaveValue('—');
  await expect(page.locator('.chart-canvas')).toHaveCount(0);
  await page.getByText(/^Configuration files ·/).click();
  await expect(page.getByRole('button',{name:'↓ JSON',exact:true})).toBeDisabled();
  await page.getByLabel('Wave 1 target finish weekday').selectOption('1');
  await page.getByLabel('Wave 1 target finish time',{exact:true}).fill('13:00');
  await expect(page.locator('.solver-error')).toHaveCount(0);
  await expect(page.locator('.chart-canvas')).toBeVisible();
  await expect(page.getByRole('button',{name:'↓ JSON',exact:true})).toBeEnabled();
});

test('mode persists through save/load and splitting, with keyboard and mobile controls',async({page})=>{
  await page.goto('./');
  await mode(page,1,'None').focus();await page.keyboard.press('ArrowRight');
  await expect(mode(page,1,'Start')).toBeChecked();
  await mode(page,1,'Finish').check();
  await page.getByRole('button',{name:'+ Add wave',exact:true}).click();
  await page.getByRole('button',{name:'Confirm split',exact:true}).click();
  await expect(mode(page,2,'Finish')).toBeChecked();
  let s=await saved(page);
  expect(s.waves[0].release.targetFinish-s.waves[1].release.targetFinish).toBeCloseTo(1800,8);
  await page.getByLabel('Configuration name',{exact:true}).fill('Solver trial');
  await page.getByRole('button',{name:'Save configuration',exact:true}).click();
  await page.reload();
  await page.getByText(/^Configuration files ·/).click();
  await page.getByLabel('Load configuration',{exact:true}).selectOption({label:'Solver trial'});
  await expect(mode(page,1,'Finish')).toBeChecked();await expect(mode(page,2,'Finish')).toBeChecked();
  s=await saved(page);expect(s.schemaVersion).toBe(8);
  for(const width of [1440,740,390,320]){
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await expect(page.getByLabel('Wave 1 target finish time',{exact:true})).toBeVisible();
  }
  await page.locator('.configuration-panel').screenshot({path:'test-results/solver-mobile.png'});
  await page.getByLabel('Strategy preset').selectOption('three-waves');
  for(const wave of [1,2,3])await expect(mode(page,wave,'Finish')).toBeChecked();
});
