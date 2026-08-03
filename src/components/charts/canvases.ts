/**
 * Native builds link Skia in, so the canvases can be imported directly.
 * The web build cannot — see `canvases.web.tsx` for why.
 */
export { BarCanvas } from './bar-canvas';
export { PieCanvas } from './pie-canvas';
