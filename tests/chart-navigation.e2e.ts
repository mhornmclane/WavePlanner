import { test, expect, type Page } from "@playwright/test";
async function view(page:Page) { return JSON.parse((await page.locator('.chart-canvas').getAttribute('data-viewport'))!); }
async function drag(page:Page,from:[number,number],to:[number,number]) {
  const plot=page.getByTestId('chart-plot');await plot.scrollIntoViewIfNeeded();const box=(await plot.boundingBox())!;
  await page.mouse.move(box.x+box.width*from[0],box.y+box.height*from[1]);await page.mouse.down();
  await page.mouse.move(box.x+box.width*to[0],box.y+box.height*to[1],{steps:8});await page.mouse.up();
}
test.beforeEach(async({page})=>{await page.goto('./');});

test('region zoom, pan, previous view and reset preserve team highlighting',async({page})=>{
  await page.getByLabel('Highlight team').selectOption(await page.locator('optgroup[label=Teams] option').first().getAttribute('value') as string);const selected=await page.getByLabel('Highlight team').inputValue();
  await page.getByRole('button',{name:'Zoom region',exact:true}).click();await drag(page,[0.2,0.25],[0.7,0.75]);
  const zoomed=await view(page);expect(zoomed.x0).toBeCloseTo(0.2,1);expect(zoomed.x1-zoomed.x0).toBeCloseTo(0.5,1);expect(zoomed.y1-zoomed.y0).toBeCloseTo(0.5,1);expect(zoomed.y0).toBeCloseTo(0.25,1);expect(zoomed.y1).toBeCloseTo(0.75,1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Pan',exact:true}).click();await drag(page,[0.4,0.5],[0.55,0.6]);
  const panned=await view(page);expect(panned.x0).toBeLessThan(zoomed.x0);expect(panned.y0).toBeGreaterThan(zoomed.y0);
  await page.getByRole('button',{name:'Previous view',exact:true}).click();expect(await view(page)).toEqual(zoomed);
  await page.getByRole('button',{name:'Reset view',exact:true}).click();expect(await view(page)).toEqual({x0:0,x1:1,y0:0,y1:1});
  await expect(page.getByLabel('Highlight team')).toHaveValue(selected);
});

test('wheel zoom anchors the pointer and keyboard can navigate and cancel selections',async({page})=>{
  await page.getByRole('button',{name:'Pan',exact:true}).click();
  const plot=page.getByTestId('chart-plot');await plot.scrollIntoViewIfNeeded();const box=(await plot.boundingBox())!;
  await page.mouse.move(box.x+box.width*0.25,box.y+box.height*0.25);await page.mouse.wheel(0,-140);
  await expect.poll(async()=> (await view(page)).x1-(await view(page)).x0).toBeLessThan(1);
  const zoomed=await view(page);expect((0.25-zoomed.x0)/(zoomed.x1-zoomed.x0)).toBeCloseTo(0.25,1);
  const svg=page.locator('.chart-canvas');await svg.focus();await svg.press('ArrowRight');expect((await view(page)).x0).toBeGreaterThan(zoomed.x0);
  await svg.press('0');expect(await view(page)).toEqual({x0:0,x1:1,y0:0,y1:1});
  await page.getByRole('button',{name:'Zoom region',exact:true}).click();
  await plot.scrollIntoViewIfNeeded();const fresh=(await plot.boundingBox())!;
  await page.mouse.move(fresh.x+fresh.width*0.2,fresh.y+fresh.height*0.2);await page.mouse.down();await page.mouse.move(fresh.x+fresh.width*0.6,fresh.y+fresh.height*0.6);
  await expect(page.locator('.zoom-selection')).toBeVisible();await page.keyboard.press('Escape');await page.mouse.up();
  expect(await view(page)).toEqual({x0:0,x1:1,y0:0,y1:1});await expect(page.locator('.zoom-selection')).toHaveCount(0);
});

test('inspection still works after zoom and changing axes restores full course',async({page})=>{
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  await page.getByRole('button',{name:'Exchanges',exact:true}).click();await expect.poll(()=>view(page)).toEqual({x0:0,x1:1,y0:0,y1:1});
  await page.getByRole('button',{name:'Inspect',exact:true}).click();
  const point=page.locator('[data-release-leg="36"]');await point.scrollIntoViewIfNeeded();await point.click();
  await expect(page.getByRole('dialog',{name:'Exchange 35 details'})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('mobile chart fits and pointer gestures work on touch screens',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();await page.goto('./');
  await page.getByRole('button',{name:'Zoom region',exact:true}).click();const svg=page.locator('.chart-canvas');await svg.scrollIntoViewIfNeeded();
  const plot=(await page.getByTestId('chart-plot').boundingBox())!;
  const start={x:plot.x+plot.width*0.15,y:plot.y+plot.height*0.2},end={x:plot.x+plot.width*0.75,y:plot.y+plot.height*0.8};
  const client=await context.newCDPSession(page);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[end]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect((await view(page)).x1-(await view(page)).x0).toBeLessThan(0.8);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.screenshot({path:'test-results/chart-tools-mobile.png',fullPage:true});await context.close();
});
