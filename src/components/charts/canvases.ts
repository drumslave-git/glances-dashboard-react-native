/**
 * Native builds link Skia in, so the canvases can be imported directly.
 * The web build cannot — see `canvases.web.ts` for why.
 */
export { BarCanvas } from './bar-canvas';
export { PieCanvas } from './pie-canvas';
export { SeriesCanvas } from './series-canvas';
export { GaugeCanvas } from './gauge-canvas';
