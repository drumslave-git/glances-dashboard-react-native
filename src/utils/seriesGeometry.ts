import type { Sample } from './sampleBuffer';

/**
 * Pure geometry for the two chart shapes the Telemetry design adds: the time
 * series (CPU, network) and the ring gauge (memory).
 *
 * Kept out of the canvas components on purpose — this is where the design's
 * exact numbers live (gridlines at 0/25/50/75/100, the arc rotated so 0% starts
 * at twelve o'clock, the 60-tick bezel at 6° increments), and none of it needs a
 * GPU to be checked.
 */

export interface Point {
  x: number;
  y: number;
}

export interface PlotBox {
  width: number;
  height: number;
  /** Space reserved at the left for inline Y labels. */
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
}

export interface SeriesPlot {
  points: Point[];
  /** Where the newest sample landed, for the current-value marker. */
  last: Point | null;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Project samples into a plot box.
 *
 * The series is drawn against **time**, not sample index, so a poll that arrives
 * late leaves a correspondingly wider gap instead of silently compressing the
 * timeline. A single sample sits at the right-hand edge, where the next one will
 * continue from.
 */
export function plotSeries(
  samples: readonly Sample[],
  domain: readonly [number, number],
  box: PlotBox,
): SeriesPlot {
  const left = box.paddingLeft ?? 0;
  const right = box.width - (box.paddingRight ?? 0);
  const top = box.paddingTop ?? 0;
  const bottom = box.height - (box.paddingBottom ?? 0);

  const empty: SeriesPlot = { points: [], last: null, left, right, top, bottom };
  if (samples.length === 0 || right <= left || bottom <= top) return empty;

  const [low, high] = domain;
  const span = high - low;
  const plotWidth = right - left;
  const plotHeight = bottom - top;

  const firstTime = samples[0].t;
  const lastTime = samples[samples.length - 1].t;
  const timeSpan = lastTime - firstTime;

  const points = samples.map((sample, index) => {
    const xFraction =
      timeSpan > 0
        ? (sample.t - firstTime) / timeSpan
        : samples.length > 1
          ? index / (samples.length - 1)
          : 1;
    const yFraction = span > 0 ? (sample.v - low) / span : 0;
    return {
      x: left + xFraction * plotWidth,
      // Clamped, not dropped: a value briefly over the domain should ride the
      // top of the box rather than vanish from the line.
      y: bottom - Math.min(1, Math.max(0, yFraction)) * plotHeight,
    };
  });

  return { points, last: points[points.length - 1] ?? null, left, right, top, bottom };
}

export interface GridLine {
  /** The domain value this line marks. */
  value: number;
  y: number;
  /** 0% and 100% are solid; 25/50/75 are dashed `2 5`. */
  dashed: boolean;
}

/** The design's five horizontal rules across a plot box. */
export function gridLines(
  domain: readonly [number, number],
  top: number,
  bottom: number,
  fractions: readonly number[] = [0, 0.25, 0.5, 0.75, 1],
): GridLine[] {
  const [low, high] = domain;
  const height = bottom - top;
  return fractions.map((fraction) => ({
    value: low + (high - low) * fraction,
    y: bottom - fraction * height,
    dashed: fraction > 0 && fraction < 1,
  }));
}

/**
 * Mirrored network chart: download fills the upper half downward from the top,
 * upload the lower half — both measured from a shared centre baseline.
 */
export function plotMirrored(
  samples: readonly Sample[],
  domain: readonly [number, number],
  box: PlotBox,
  half: 'upper' | 'lower',
): SeriesPlot {
  const top = box.paddingTop ?? 0;
  const bottom = box.height - (box.paddingBottom ?? 0);
  const centre = (top + bottom) / 2;

  return plotSeries(samples, domain, {
    ...box,
    ...(half === 'upper'
      ? { paddingBottom: box.height - centre }
      : { paddingTop: centre }),
  });
}

/* ------------------------------------------------------------------ *
 * Ring gauge
 * ------------------------------------------------------------------ */

/** The arc starts at twelve o'clock: Skia's 0° is 3 o'clock, so rotate by −90°. */
export const GAUGE_START_ANGLE = -90;

export function circumference(radius: number): number {
  return 2 * Math.PI * radius;
}

/**
 * `stroke-dasharray: <pct × 2πr> <2πr>` — the filled length followed by a gap
 * long enough that the arc never repeats.
 */
export function gaugeDashArray(percent: number, radius: number): [number, number] {
  const total = circumference(radius);
  const clamped = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
  return [(clamped / 100) * total, total];
}

export interface BezelTick {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * The 60-tick bezel: 1pt lines from r+4 to r+9 at 6° increments. Sixty ticks
 * around a circle is a clock face, which is the instrument this design is
 * quoting.
 */
export function bezelTicks(
  centre: Point,
  radius: number,
  { count = 60, inner = 4, outer = 9 }: { count?: number; inner?: number; outer?: number } = {},
): BezelTick[] {
  if (count <= 0 || radius <= 0) return [];

  const ticks: BezelTick[] = [];
  const step = 360 / count;
  for (let i = 0; i < count; i += 1) {
    const radians = ((GAUGE_START_ANGLE + i * step) * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    ticks.push({
      x1: centre.x + (radius + inner) * cos,
      y1: centre.y + (radius + inner) * sin,
      x2: centre.x + (radius + outer) * cos,
      y2: centre.y + (radius + outer) * sin,
    });
  }
  return ticks;
}

/**
 * Ring radius for a gauge box: the track stroke and the bezel both sit outside
 * the radius, so the drawable circle is smaller than half the box.
 */
export function ringRadius(diameter: number, strokeWidth: number, bezelOuter = 9): number {
  return Math.max(1, diameter / 2 - strokeWidth / 2 - bezelOuter - 1);
}
