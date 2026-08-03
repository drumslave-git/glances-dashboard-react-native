import type { Sample } from './sampleBuffer';
import {
  GAUGE_START_ANGLE,
  bezelTicks,
  circumference,
  gaugeDashArray,
  gridLines,
  plotMirrored,
  plotSeries,
  ringRadius,
} from './seriesGeometry';

const box = { width: 100, height: 50 };

function at(times: number[], values: number[]): Sample[] {
  return times.map((t, index) => ({ t, v: values[index] }));
}

describe('plotSeries', () => {
  it('spreads samples across the box and inverts the y axis', () => {
    const plot = plotSeries(at([0, 50, 100], [0, 50, 100]), [0, 100], box);

    expect(plot.points).toEqual([
      { x: 0, y: 50 },
      { x: 50, y: 25 },
      { x: 100, y: 0 },
    ]);
    expect(plot.last).toEqual({ x: 100, y: 0 });
  });

  it('positions against time, so a late poll leaves a wider gap', () => {
    // Three samples, the middle one arriving at 10% of the elapsed time.
    const plot = plotSeries(at([0, 10, 100], [0, 0, 0]), [0, 100], box);
    expect(plot.points.map((point) => point.x)).toEqual([0, 10, 100]);
  });

  it('honours padding, which is where the inline Y labels live', () => {
    const plot = plotSeries(at([0, 100], [0, 100]), [0, 100], {
      ...box,
      paddingLeft: 20,
      paddingBottom: 10,
    });

    expect(plot.left).toBe(20);
    expect(plot.bottom).toBe(40);
    expect(plot.points[0]).toEqual({ x: 20, y: 40 });
  });

  it('clamps out-of-domain values to the box instead of dropping them', () => {
    const plot = plotSeries(at([0, 100], [-20, 180]), [0, 100], box);
    expect(plot.points[0].y).toBe(50);
    expect(plot.points[1].y).toBe(0);
  });

  it('puts a lone sample at the right edge, where the next one continues from', () => {
    const plot = plotSeries(at([0], [50]), [0, 100], box);
    expect(plot.points).toEqual([{ x: 100, y: 25 }]);
  });

  it('has nothing to plot in a zero-sized box or with no samples', () => {
    expect(plotSeries([], [0, 100], box).points).toEqual([]);
    expect(plotSeries(at([0], [1]), [0, 100], { width: 0, height: 0 }).points).toEqual([]);
  });
});

describe('gridLines', () => {
  it('marks 0 and 100 solid, the quarters dashed', () => {
    const lines = gridLines([0, 100], 0, 100);
    expect(lines.map((line) => line.value)).toEqual([0, 25, 50, 75, 100]);
    expect(lines.map((line) => line.dashed)).toEqual([false, true, true, true, false]);
    expect(lines.map((line) => line.y)).toEqual([100, 75, 50, 25, 0]);
  });
});

describe('plotMirrored', () => {
  const samples = at([0, 100], [0, 100]);

  it('draws the upper half above the centre baseline', () => {
    const plot = plotMirrored(samples, [0, 100], { width: 100, height: 100 }, 'upper');
    expect(plot.bottom).toBe(50);
    expect(plot.points[1].y).toBe(0);
  });

  it('mirrors the lower half below it', () => {
    const plot = plotMirrored(samples, [0, 100], { width: 100, height: 100 }, 'lower');
    expect(plot.top).toBe(50);
    expect(plot.points[1].y).toBe(50);
    expect(plot.points[0].y).toBe(100);
  });
});

describe('ring gauge', () => {
  it('starts the arc at twelve o’clock', () => {
    expect(GAUGE_START_ANGLE).toBe(-90);
    const [first] = bezelTicks({ x: 0, y: 0 }, 10, { count: 4, inner: 0, outer: 1 });
    // Straight up: x ≈ 0, y negative.
    expect(first.x1).toBeCloseTo(0, 6);
    expect(first.y1).toBeCloseTo(-10, 6);
  });

  it('fills the dash array in proportion to the percentage', () => {
    const [filled, total] = gaugeDashArray(25, 10);
    expect(total).toBeCloseTo(circumference(10), 6);
    expect(filled).toBeCloseTo(circumference(10) / 4, 6);
  });

  it('clamps a percentage from a plugin that reports over 100', () => {
    expect(gaugeDashArray(180, 10)[0]).toBeCloseTo(circumference(10), 6);
    expect(gaugeDashArray(-5, 10)[0]).toBe(0);
    expect(gaugeDashArray(Number.NaN, 10)[0]).toBe(0);
  });

  it('draws a 60-tick bezel at 6° increments', () => {
    const ticks = bezelTicks({ x: 50, y: 50 }, 40);
    expect(ticks).toHaveLength(60);
    // Each tick spans the 4→9 band outside the radius.
    const length = Math.hypot(ticks[0].x2 - ticks[0].x1, ticks[0].y2 - ticks[0].y1);
    expect(length).toBeCloseTo(5, 6);
  });

  it('has no bezel to draw for a zero radius', () => {
    expect(bezelTicks({ x: 0, y: 0 }, 0)).toEqual([]);
  });

  it('keeps the stroke and bezel inside the box', () => {
    expect(ringRadius(158, 9)).toBe(158 / 2 - 4.5 - 9 - 1);
    expect(ringRadius(10, 9)).toBeGreaterThan(0);
  });
});
