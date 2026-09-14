import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { baseline, profiles, fieldIds } from "../src/data";
import { latestStart, simulate } from "../src/engine";
import { clock } from "../src/format";

async function section(page:Page,name:string) { await page.getByRole("navigation",{name:"Planner sections"}).getByRole("button",{name,exact:true}).click(); }
async function downloadText(page:Page,name:string) {
  const event=page.waitForEvent("download");await page.getByRole("button",{name,exact:true}).click();
  const file=await event; return readFile((await file.path())!,"utf8");
}
test.beforeEach(async({page})=>{await page.goto("./");});

test("opens visual simulation with separate sections and no legacy release controls",async({page})=>{
  await expect(page.getByRole("button",{name:"Simulation",exact:true})).toHaveAttribute("aria-current","page");
  await expect(page.getByRole("heading",{name:"The field, over time"})).toBeVisible();
  await expect(page.getByLabel("Simulation field")).toHaveValue("2025");
  await expect(page.getByLabel("Wave 1 start weekday")).toHaveValue("0");
  await expect(page.getByLabel("Wave 1 start time")).toHaveValue("01:00");
  await expect(page.getByLabel("Wave 1 release pace",{exact:true})).toHaveValue("10:25");
  await expect(page.getByText("Release anchor",{exact:true})).toHaveCount(0);
  await expect(page.getByText("Historical data",{exact:true})).not.toHaveCount(0);
  const config=await page.locator('.configuration-panel').boundingBox();
  const visual=await page.locator('.simulation-visual').boundingBox();
  expect(visual!.y).toBeGreaterThanOrEqual(config!.y+config!.height);
  expect(Math.abs(visual!.width-config!.width)).toBeLessThan(2);
});

test("history filters and CSV exports stay independent of simulation",async({page})=>{
  await page.getByLabel("Simulation field").selectOption("2026");
  await section(page,"Historical data");
  await page.getByLabel("Historical year").selectOption("2025");
  await page.getByLabel("Find historical team").fill("ruck");
  const filtered=profiles.filter(p=>p.year===2025&&p.team.toLowerCase().includes("ruck"));
  const csv=await downloadText(page,"Export filtered CSV");expect(csv.split("\r\n")).toHaveLength(filtered.length+1);
  expect(csv).toContain("Overall seconds/mile");expect(csv).toContain("legs_57_71 seconds/mile");
  expect((await downloadText(page,"Export all CSV")).split("\r\n")).toHaveLength(52);
  await page.getByRole("button",{name:/Overall/}).click();
  await section(page,"Simulation");await expect(page.getByLabel("Simulation field")).toHaveValue("2026");
  await expect(page.locator('.configuration-heading')).toContainText(`${fieldIds(2026).length} profiles`);
  await section(page,"Historical data");await expect(page.getByLabel("Find historical team")).toHaveValue("ruck");
  await expect(page.getByLabel("Historical year")).toHaveValue("2025");
  await page.getByLabel("Find historical team").fill("no matching team 123");
  await expect(page.getByRole("button",{name:"Export filtered CSV"})).toBeDisabled();
});

test("finish inputs guide without changing starts; challenge changes recalculate",async({page})=>{
  await page.getByLabel("Wave 1 target finish weekday").selectOption("1");
  await page.getByLabel("Wave 1 target finish time").fill("12:00");
  await page.getByLabel("Wave 1 release pace",{exact:true}).fill("11:00");
  const s=baseline();s.waves[0].release={targetFinish:129600,pace:660};
  await expect(page.locator('.start-guidance')).toHaveText(clock(latestStart(s, s.waves[0]),"down"));
  await expect(page.getByLabel("Wave 1 start time")).toHaveValue("01:00");
  await expect(page.getByText("Wave 1 starts after the calculated latest start.")).toBeVisible();
  await page.getByText("Challenge allowances",{exact:true}).click();
  await page.getByLabel("Monument challenge",{exact:true}).fill("30");s.challenges.monument=1800;
  await expect(page.locator('.start-guidance')).toHaveText(clock(latestStart(s, s.waves[0]),"down"));
  await page.getByLabel("Wave 1 start weekday").selectOption("-1");
  await page.getByLabel("Wave 1 start time").fill("22:00");
  await expect(page.getByLabel("Wave 1 start weekday")).toHaveValue("-1");
});

test("invalid configuration prevents stale results and exports, then recovers",async({page})=>{
  await page.getByLabel("Wave 1 release pace",{exact:true}).fill("bad");
  await expect(page.getByRole("heading",{name:"The field, over time"})).toHaveCount(0);
  await section(page,"Results");
  await expect(page.getByRole("alert")).toContainText("Correct the configuration");
  await expect(page.getByRole("button",{name:"Export team results CSV"})).toHaveCount(0);
  await section(page,"Simulation");await page.getByLabel("Wave 1 release pace",{exact:true}).fill("10:00");
  await expect(page.getByRole("heading",{name:"The field, over time"})).toBeVisible();
  await page.getByLabel("Wave 1 target finish time").fill("");
  await section(page,"Results");await expect(page.getByRole("button",{name:"Export team results CSV"})).toHaveCount(0);
  await section(page,"Simulation");await page.getByLabel("Wave 1 target finish time").fill("14:00");
  await section(page,"Results");await expect(page.getByRole("button",{name:"Export team results CSV"})).toBeVisible();
});

test("presets apply finish settings and retain field; wave boundaries, split and removal work",async({page})=>{
  await page.getByLabel("Wave 1 release pace",{exact:true}).fill("11:30");await page.getByLabel("Simulation field").selectOption("2025");
  await page.getByLabel("Strategy preset").selectOption("three-waves");
  await expect(page.locator('.wave-card')).toHaveCount(3);await expect(page.getByLabel("Wave 1 release pace",{exact:true})).toHaveValue("10:25");
  await expect(page.getByLabel("Simulation field")).toHaveValue("2025");
  await expect(page.locator('.finish-target').getByLabel("Wave 1 target finish time")).toBeVisible();
  const boundary=page.getByLabel("Wave 1 minimum pace (inclusive)",{exact:true});await boundary.fill("10:30");await boundary.press("Enter");
  await expect(page.getByLabel("Wave 2 maximum pace (exclusive)",{exact:true})).toHaveValue("10:30");
  await boundary.fill("1:00");await boundary.press("Enter");await expect(boundary).toHaveAttribute("aria-invalid","true");await boundary.press("Escape");
  await page.getByRole("button",{name:"+ Add wave",exact:true}).click();await page.getByRole("button",{name:"Confirm split"}).click();
  await expect(page.locator('.wave-card')).toHaveCount(4);await page.getByLabel("Remove wave 1",{exact:true}).click();
  await expect(page.locator('.wave-card')).toHaveCount(3);await expect(page.getByLabel("Wave 1 release pace",{exact:true})).toHaveValue("10:25");
});

test("results tables and CSV reflect current field and configuration",async({page})=>{
  await page.getByLabel("Simulation field").selectOption("2026");
  await page.getByRole("button",{name:"Tabular results",exact:true}).click();
  const csv=await downloadText(page,"Export team results CSV");expect(csv.split("\r\n")).toHaveLength(fieldIds(2026).length+1);
  expect(csv).toContain("All legs complete");expect(csv).toContain("Saturday");
  expect((await downloadText(page,"↓ Export all CSV")).split("\r\n")).toHaveLength(73);
  await expect(page.getByRole("heading",{name:"Release timetable"})).toBeVisible();
  await page.getByRole("button",{name:"← Adjust simulation"}).click();await page.getByLabel("Wave 1 target finish time").fill("16:00");
  await section(page,"Results");expect(await downloadText(page,"Export team results CSV")).toContain("Saturday 4:00 PM");
});

test("new saves round-trip and rejected legacy imports preserve edits",async({page})=>{
  await page.getByText(/^Configuration files ·/).click();
  await page.getByLabel("Configuration name",{exact:true}).fill("Finish party plan");
  await page.getByLabel("Wave 1 release pace",{exact:true}).fill("11:15");
  await page.getByRole("button",{name:"Save configuration",exact:true}).click();
  const json=await downloadText(page,"↓ JSON"),saved=JSON.parse(json);
  expect(saved.schemaVersion).toBe(8);expect(saved.waves[0].release.pace).toBe(675);expect(saved.waves[0].release.mode).toBeUndefined();
  await page.getByLabel("Wave 1 release pace",{exact:true}).fill("12:00");
  await page.getByLabel("Import configuration JSON").setInputFiles({name:"old.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({...saved,schemaVersion:5}))});
  await expect(page.getByRole("alert")).toContainText("Unsupported configuration version");await expect(page.getByLabel("Wave 1 release pace",{exact:true})).toHaveValue("12:00");
  await page.getByLabel("Import configuration JSON").setInputFiles({name:"new.json",mimeType:"application/json",buffer:Buffer.from(json)});
  await expect(page.getByLabel("Wave 1 release pace",{exact:true})).toHaveValue("11:15");
  await page.reload();await page.getByText(/^Configuration files ·/).click();await page.getByLabel("Load configuration",{exact:true}).selectOption({label:"Finish party plan"});
  await expect(page.getByLabel("Wave 1 release pace",{exact:true})).toHaveValue("11:15");
});

test("advanced controls affect simulation and hypothetical inclusion survives year changes",async({page})=>{
  await page.getByText("Hypothetical teams",{exact:true}).click();await page.getByLabel("Include Worst-case slowest").check();
  await page.getByLabel("Simulation field").selectOption("2026");await expect(page.getByLabel("Include Worst-case slowest")).toBeChecked();
  await page.getByText("Timing rules & fast-wave releases",{exact:true}).click();
  await page.getByLabel("Enable releases for fast waves").uncheck();await expect(page.getByLabel("Fast-wave release starting exchange")).toBeDisabled();
  await page.getByLabel("Enable releases for fast waves").check();await page.getByLabel("Fast-wave release starting exchange").selectOption("53");
  await page.getByLabel("Rule 2 weekday").selectOption("1");await page.getByLabel("Rule 2 time").fill("18:00");
  await expect(page.locator('.simulation-visual .gate-feedback')).toBeVisible();
  await page.getByText("Staffing buffers",{exact:true}).click();await page.getByLabel("Before first activity",{exact:true}).fill("10");
  await section(page,"Results");const csv=await downloadText(page,"Export team results CSV");expect(csv).toContain("Worst-case slowest");
});

test("chart controls and replay work, and leaving replay pauses while preserving frame",async({page})=>{
  await page.getByRole("checkbox",{name:"2026 baseline"}).check();await page.getByRole("button",{name:"Exchanges",exact:true}).click();
  await page.getByRole("button",{name:"Zoom in",exact:true}).click();await expect(page.locator(".chart-zoom-level")).toHaveText("2.0×");
  await section(page,"Historical data");await section(page,"Simulation");await expect(page.locator(".chart-zoom-level")).toHaveText("2.0×");
  await page.getByRole("button",{name:"Spread replay",exact:true}).click();await page.getByRole("region",{name:"Spread replay",exact:true}).getByLabel("Replay exchange",{exact:true}).fill("35");
  await expect(page.getByRole("region",{name:"Spread replay",exact:true}).getByLabel("Replay exchange",{exact:true})).toHaveValue("35");
  await page.getByRole("button",{name:"Play",exact:true}).click();await section(page,"Results");await section(page,"Simulation");
  await expect(page.getByRole("button",{name:"Play",exact:true})).toBeVisible();await expect(page.getByRole("region",{name:"Spread replay",exact:true}).getByLabel("Replay exchange",{exact:true})).toHaveValue("35");
  await page.getByLabel("Wave 1 release pace",{exact:true}).fill("11:00");await expect(page.getByRole("region",{name:"Spread replay",exact:true}).getByLabel("Replay exchange",{exact:true})).toHaveValue("0");
});

test("desktop and mobile sections fit the viewport and render without errors",async({page})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.screenshot({path:"test-results/redesign-desktop.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});
  for(const name of ["Simulation","Historical data","Results"]){
    await section(page,name);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
    await page.screenshot({path:`test-results/redesign-mobile-${name.split(" ")[0].toLowerCase()}.png`,fullPage:true});
  }
  expect(errors).toEqual([]);
});

test("compact configuration keeps rows aligned and exposes rosters and settings at every width",async({page})=>{
  await page.getByLabel("Strategy preset").selectOption("three-waves");
  const config=page.locator('.configuration-panel');
  const summaries=config.locator('.compact-settings summary');
  const boxes=await summaries.evaluateAll(elements=>elements.map(el=>el.getBoundingClientRect().y));
  expect(Math.max(...boxes)-Math.min(...boxes)).toBeLessThan(2);
  const descriptionHeight = (await config.locator('.preset-description').boundingBox())!.height;
  expect((await config.boundingBox())!.height - descriptionHeight).toBeLessThan(850);
  expect((await config.boundingBox())!.height).toBeLessThan(920);
  await config.getByRole('button',{name:/included teams for wave 1/}).click();
  await expect(config.locator('.wave-members').first()).toBeVisible();
  await expect(config.locator('.wave-members').first().getByRole('button',{name:'Split this range'})).toBeVisible();
  await config.getByRole('button',{name:/included teams for wave 1/}).click();
  await page.getByText('Challenge allowances',{exact:true}).click();
  await page.getByLabel('Monument challenge',{exact:true}).fill('25');
  await expect(summaries.nth(1)).toContainText('25 + 21 min');
  const content=config.locator('.secondary-control[open] .settings-content');
  expect((await content.boundingBox())!.width).toBeGreaterThan((await config.boundingBox())!.width-60);
  await page.getByText('Staffing buffers',{exact:true}).click();
  await expect(page.getByLabel('Monument challenge',{exact:true})).not.toBeVisible();
  await expect(page.getByLabel('Before first activity',{exact:true})).toBeVisible();
  await page.getByText('Staffing buffers',{exact:true}).click();
  await config.screenshot({path:'test-results/compact-config-desktop.png'});
  for(const width of [740,600,390,320]) {
    await page.setViewportSize({width,height:900});
    expect(await config.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await expect(page.getByLabel('Wave 1 start time')).toBeVisible();
    await expect(page.getByLabel("Wave 2 maximum pace (exclusive)",{exact:true})).toBeVisible();
  }
  await config.screenshot({path:'test-results/compact-config-mobile.png'});
});

 test("early release guides remain inside the chart and finish target is marked",async({page})=>{
  await page.getByLabel("Wave 1 release pace",{exact:true}).fill("14:00");
  await expect(page.locator('.start-guidance')).toContainText("Thursday");
  const first=page.locator('[data-release-leg="1"]');expect(Number(await first.getAttribute('cx'))).toBeGreaterThanOrEqual(68);
  await expect(page.locator('.finish-target-marker circle')).toHaveAttribute('aria-label',/Target finish Saturday/);
});

test("first split moves strictly faster teams into the new wave and retains the original slow wave",async({page})=>{
  await page.getByLabel("Simulation field").selectOption("all");
  const cutoff=profiles.find(p=>Number.isInteger(p.overall_mean_pace_seconds_per_mile))!.overall_mean_pace_seconds_per_mile;
  const input=`${Math.floor(cutoff/60)}:${String(cutoff%60).padStart(2,"0")}`;
  await page.getByLabel("Wave 1 name",{exact:true}).fill("Original slow wave");
  await page.getByLabel("Wave 1 start time").fill("00:30");
  await page.getByRole("button",{name:"+ Add wave",exact:true}).click();
  await page.getByLabel("Split teams faster than",{exact:true}).fill(input);
  await expect(page.getByText(/Teams faster than this pace move to the new wave/)).toBeVisible();
  await page.getByRole("button",{name:"Confirm split"}).click();
  await expect(page.getByLabel("Wave 1 name",{exact:true})).toHaveValue("Original slow wave");
  await expect(page.getByLabel("Wave 1 start time")).toHaveValue("00:30");
  await expect(page.getByLabel("Wave 2 start time")).toHaveValue("01:00");
  await page.getByText(/^Configuration files ·/).click();
  const saved=JSON.parse(await downloadText(page,"↓ JSON"));
  expect(saved.waves[1].id).toBe("wave-1");
  for(const profile of profiles){
    const id=`${profile.year}::${profile.team}`;
    expect(saved.assignments[id]).toBe(profile.overall_mean_pace_seconds_per_mile<cutoff ? saved.waves[0].id : "wave-1");
  }
});

test("complete presets switch atomically, restore rules, and retain field and buffers", async ({page}) => {
  await page.getByLabel("Simulation field").selectOption("2026");
  await page.getByText("Challenge allowances", {exact:true}).click();
  await page.getByLabel("Monument challenge", {exact:true}).fill("30");
  await page.getByText("Timing rules & fast-wave releases", {exact:true}).click();
  await page.getByLabel("Enable releases for fast waves").uncheck();
  await page.getByText("Staffing buffers", {exact:true}).click();
  await page.getByLabel("Before first activity", {exact:true}).fill("10");
  await page.getByLabel("Strategy preset").selectOption("eleven-am");
  await expect(page.getByLabel("Wave 1 target finish time")).toHaveValue("Saturday 10:46 AM");
  await expect(page.getByLabel("Wave 1 release pace", {exact:true})).toHaveValue("9:40");
  await expect(page.getByLabel("Wave 3 start time")).toHaveValue("03:30");
  await expect(page.locator('.preset-description')).toContainText("launch time");
  await page.getByText(/^Configuration files ·/).click();
  const s = JSON.parse(await downloadText(page,"↓ JSON"));
  expect(s.fieldYear).toBe(2026);
  expect(s.buffers.before).toBe(600);
  expect(s.challenges).toEqual({monument:960,lighthouse:1260});
  expect(s.fastWaveReleases).toEqual({enabled:true,fromExchange:35});
  expect(s.timingRules).toEqual(baseline().timingRules);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.getByLabel("Strategy preset").selectOption("earlier-launch");
  await expect(page.getByLabel("Wave 1 start weekday")).toHaveValue("-1");
  await expect(page.getByLabel("Wave 1 start time")).toHaveValue("23:00");
  await expect(page.getByLabel("Wave 1 release pace", {exact:true})).toHaveValue("11:00");
  await page.getByLabel("Strategy preset").selectOption("two-waves");
  await expect(page.locator('.wave-card')).toHaveCount(2);
  await expect(page.getByLabel("Wave 1 target finish time")).toHaveValue("Saturday 1:20 PM");
  await page.getByLabel("Wave 1 start time").fill("00:30");
  await expect(page.getByLabel("Strategy preset")).toHaveValue("custom");
  await page.setViewportSize({width:320,height:900});
  await page.getByLabel("Strategy preset").selectOption("earlier-launch");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
