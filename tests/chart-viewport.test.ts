import { describe, expect, it } from "vitest";
import { chartTicks, constrainViewport, fullViewport, panViewport, regionViewport, zoomViewport } from "../src/chartViewport";

describe("chart viewport geometry",()=>{
  it("zooms both axes around the selected pointer location",()=>{
    expect(zoomViewport(fullViewport,2,{x:0.25,y:0.75})).toEqual({x0:0.125,x1:0.625,y0:0.375,y1:0.875});
  });
  it("selects a reversed rectangle and composes selections in the current view",()=>{
    const view=regionViewport(fullViewport,{x:0.8,y:0.9},{x:0.2,y:0.3});
    expect(view.x0).toBeCloseTo(0.2);expect(view.x1).toBeCloseTo(0.8);
    const next=regionViewport(view,{x:0.25,y:0.25},{x:0.75,y:0.75});
    expect(next.x0).toBeCloseTo(0.35);expect(next.x1).toBeCloseTo(0.65);
    expect(next.y0).toBeCloseTo(0.45);expect(next.y1).toBeCloseTo(0.75);
  });
  it("pans without changing scale and clamps to the course bounds",()=>{
    const view=zoomViewport(fullViewport,2);
    expect(panViewport(view,10,-10)).toEqual({x0:0,x1:0.5,y0:0.5,y1:1});
    expect(panViewport(fullViewport,2,2)).toEqual(fullViewport);
  });
  it("limits repeated zoom and restores the full view when zooming out",()=>{
    const view=zoomViewport(fullViewport,1e9);expect(view.x1-view.x0).toBeCloseTo(0.01);
    expect(zoomViewport(view,1e-9)).toEqual(fullViewport);
    const tiny=constrainViewport({x0:0.7,x1:0.7,y0:-0.5,y1:2});expect(tiny.x1-tiny.x0).toBeCloseTo(0.01);expect(tiny.y0).toBe(0);expect(tiny.y1).toBe(1);
  });
  it("provides fractional time ticks at high zoom and handles negative hours",()=>{
    const ticks=chartTicks(-0.12,0.14,5);expect(ticks.length).toBeGreaterThan(2);
    expect(ticks.every(t=>t>=-0.12&&t<=0.14)).toBe(true);expect(ticks).toContain(0);
  });
});
