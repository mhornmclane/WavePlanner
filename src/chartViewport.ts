export interface ChartViewport { x0: number; x1: number; y0: number; y1: number }
export interface PlotPoint { x: number; y: number }
export const fullViewport: ChartViewport = { x0: 0, x1: 1, y0: 0, y1: 1 };
const minimumSpan = 0.01;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
function interval(low: number, high: number): [number, number] {
  const span = clamp(high - low, minimumSpan, 1);
  const start = clamp(low, 0, 1 - span);
  return [start, start + span];
}
export function constrainViewport(view: ChartViewport): ChartViewport {
  const [x0, x1] = interval(view.x0, view.x1);
  const [y0, y1] = interval(view.y0, view.y1);
  return { x0, x1, y0, y1 };
}
export function zoomViewport(view: ChartViewport, factor: number, anchor: PlotPoint = { x: 0.5, y: 0.5 }): ChartViewport {
  const width = view.x1 - view.x0, height = view.y1 - view.y0;
  const nextWidth = clamp(width / factor, minimumSpan, 1), nextHeight = clamp(height / factor, minimumSpan, 1);
  const x0 = view.x0 + anchor.x * (width - nextWidth);
  const y0 = view.y0 + anchor.y * (height - nextHeight);
  return constrainViewport({ x0, x1: x0 + nextWidth, y0, y1: y0 + nextHeight });
}
export function panViewport(view: ChartViewport, dx: number, dy: number): ChartViewport {
  const x = dx * (view.x1 - view.x0), y = dy * (view.y1 - view.y0);
  return constrainViewport({ x0: view.x0 - x, x1: view.x1 - x, y0: view.y0 - y, y1: view.y1 - y });
}
export function regionViewport(view: ChartViewport, start: PlotPoint, end: PlotPoint): ChartViewport {
  const x = (value: number) => view.x0 + clamp(value, 0, 1) * (view.x1 - view.x0);
  const y = (value: number) => view.y0 + clamp(value, 0, 1) * (view.y1 - view.y0);
  return constrainViewport({ x0: x(Math.min(start.x, end.x)), x1: x(Math.max(start.x, end.x)), y0: y(Math.min(start.y, end.y)), y1: y(Math.max(start.y, end.y)) });
}
export function chartTicks(min: number, max: number, count = 10): number[] {
  const rough = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map(n => n * magnitude).find(n => n >= rough)!;
  const ticks: number[] = [];
  for (let i = Math.ceil(min / step); i * step <= max + step * 1e-8; i++) ticks.push(Number((i * step).toPrecision(12)));
  return ticks;
}
