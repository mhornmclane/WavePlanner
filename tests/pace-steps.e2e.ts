import { test, expect } from "@playwright/test";
import { baseline, course } from "../src/data";
import { clock } from "../src/format";

test("five-second pace controls update the solver and respect pace and boundary limits", async ({ page }) => {
  await page.goto('./');
  await page.getByRole('group',{name:'Wave 1 solver',exact:true}).getByRole('radio',{name:'Finish',exact:true}).check();
  const input=page.getByLabel('Wave 1 release pace',{exact:true});
  const increase=page.getByRole('button',{name:'Increase Wave 1 release pace by 5 seconds',exact:true});
  const decrease=page.getByRole('button',{name:'Decrease Wave 1 release pace by 5 seconds',exact:true});
  await increase.click();await expect(input).toHaveValue('10:30');
  const s=baseline();
  await expect(page.getByLabel('Wave 1 target finish time',{exact:true})).toHaveValue(clock(s.waves[0].start+course.event.total_distance_miles*630+s.challenges.monument+s.challenges.lighthouse));
  await decrease.focus();await page.keyboard.press('Enter');await expect(input).toHaveValue('10:25');
  await input.fill('0:01');await expect(decrease).toBeDisabled();
  await input.fill('99:59');await expect(increase).toBeDisabled();
  await input.fill('bad');await expect(increase).toBeDisabled();await expect(decrease).toBeDisabled();
  await page.getByLabel('Strategy preset').selectOption('three-waves');
  await page.getByRole('button',{name:'Increase Wave 1 minimum pace (inclusive) by 5 seconds',exact:true}).click();
  await expect(page.getByLabel('Wave 1 minimum pace (inclusive)',{exact:true})).toHaveValue('10:05');
  await expect(page.getByLabel('Wave 2 maximum pace (exclusive)',{exact:true})).toHaveValue('10:05');
  await page.getByLabel('Wave 1 minimum pace (inclusive)',{exact:true}).fill('9:16');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Decrease Wave 1 minimum pace (inclusive) by 5 seconds',exact:true})).toBeDisabled();
  await page.getByRole('group',{name:'Wave 1 solver',exact:true}).getByRole('radio',{name:'Pace',exact:true}).check();
  await expect(increase).toHaveCount(0);
});

test("calculated and editable timestamps round to the nearest minute across midnight", async ({ page }) => {
  const s=baseline();
  s.waves[0].solver='start';
  s.waves[0].release.targetFinish=86380.25+course.event.total_distance_miles*s.waves[0].release.pace+s.challenges.monument+s.challenges.lighthouse;
  await page.goto('./');
  await page.getByText(/^Configuration files ·/).click();
  await page.getByLabel('Import configuration JSON').setInputFiles({name:'rounding.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});
  await expect(page.getByLabel('Wave 1 start time',{exact:true})).toHaveValue('Saturday 12:00 AM');
  await page.getByRole('group',{name:'Wave 1 solver',exact:true}).getByRole('radio',{name:'None',exact:true}).check();
  await expect(page.getByLabel('Wave 1 start time',{exact:true})).toHaveValue('00:00');
  await expect(page.getByLabel('Wave 1 start weekday',{exact:true})).toHaveValue('1');
  for(const width of [740,390,320]){
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  await page.locator('.configuration-panel').screenshot({path:'test-results/pace-steps-mobile.png'});
});
