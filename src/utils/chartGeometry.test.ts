import {
  barDomain,
  DEFAULT_CHART_THICKNESS,
  donutInnerRadius,
  paddingAngleToGap,
  resolveChartOptions,
  resolveChartSize,
  segmentLabelText,
  sliceGeometry,
  sliceLabels,
} from './chartGeometry';
import type { ChartSegment } from './widgetData';

const segment = (name: string, value: number, extra?: Partial<ChartSegment>): ChartSegment => ({
  name,
  value,
  color: '#228be6',
  ...extra,
});

describe('resolveChartOptions', () => {
  it('applies the reference defaults', () => {
    expect(resolveChartOptions()).toEqual({
      thickness: DEFAULT_CHART_THICKNESS,
      paddingAngle: 0,
      withLabels: true,
    });
  });

  it('keeps configured values', () => {
    expect(resolveChartOptions({ size: 160, thickness: 8, paddingAngle: 4, withLabels: false })).toEqual(
      { size: 160, thickness: 8, paddingAngle: 4, withLabels: false },
    );
  });

  it('treats a zero size as "auto"', () => {
    expect(resolveChartOptions({ size: 0 })).not.toHaveProperty('size');
  });
});

describe('resolveChartSize', () => {
  it('honours an explicit size regardless of the container', () => {
    expect(resolveChartSize({ width: 0, height: 0, size: 200, thickness: 20 })).toBe(200);
  });

  it('waits for the container to be measured', () => {
    expect(resolveChartSize({ width: 0, height: 180, thickness: 20 })).toBeNull();
    expect(resolveChartSize({ width: 180, height: 0, thickness: 20 })).toBeNull();
  });

  it('fills the smaller container axis', () => {
    expect(resolveChartSize({ width: 300, height: 180, thickness: 20 })).toBe(180);
  });

  it('never comes out thinner than the ring', () => {
    expect(resolveChartSize({ width: 10, height: 10, thickness: 20 })).toBe(20);
  });
});

describe('donutInnerRadius', () => {
  it('subtracts the ring thickness from the radius', () => {
    expect(donutInnerRadius(200, 20)).toBe(80);
  });

  it('collapses to a pie when the ring is thicker than the radius', () => {
    expect(donutInnerRadius(100, 80)).toBe(0);
  });
});

describe('sliceGeometry', () => {
  it('splits the circle proportionally, clockwise from 3 o’clock', () => {
    expect(sliceGeometry([segment('a', 3), segment('b', 1)])).toEqual([
      { name: 'a', startAngle: 0, endAngle: 270, midAngle: 135, sweepAngle: 270 },
      { name: 'b', startAngle: 270, endAngle: 360, midAngle: 315, sweepAngle: 90 },
    ]);
  });

  it('gives a single segment the whole circle', () => {
    expect(sliceGeometry([segment('only', 42)])[0]).toMatchObject({
      startAngle: 0,
      endAngle: 360,
    });
  });

  it('returns nothing when the values do not add up to a positive total', () => {
    expect(sliceGeometry([])).toEqual([]);
    expect(sliceGeometry([segment('a', 0), segment('b', 0)])).toEqual([]);
  });
});

describe('sliceLabels', () => {
  it('places a half-circle label on the ring, opposite its twin', () => {
    const labels = sliceLabels([segment('used', 50), segment('free', 50)], {
      size: 200,
      innerRadius: 60,
    });

    // Ring midpoint is (60 + 100) / 2 = 80 from a centre at (100, 100).
    expect(labels).toHaveLength(2);
    expect(labels[0].x).toBeCloseTo(100);
    expect(labels[0].y).toBeCloseTo(180);
    expect(labels[1].x).toBeCloseTo(100);
    expect(labels[1].y).toBeCloseTo(20);
  });

  it('labels a pie between the centre and the rim', () => {
    const [label] = sliceLabels([segment('all', 1)], { size: 200, innerRadius: 0 });
    // A single slice sweeps 0–360, so its midpoint is at 180° — straight left,
    // 60% of the 100pt radius from the centre.
    expect(label.x).toBeCloseTo(40);
    expect(label.y).toBeCloseTo(100);
  });

  it('prefers the formatted value over the field name', () => {
    const [label] = sliceLabels([segment('percent', 1, { displayLabel: '16.1%' })], {
      size: 200,
      innerRadius: 0,
    });
    expect(label.text).toBe('16.1%');
  });

  it('drops slivers that have no room for a label', () => {
    const labels = sliceLabels([segment('big', 99), segment('sliver', 1)], {
      size: 200,
      innerRadius: 0,
    });
    expect(labels.map((label) => label.name)).toEqual(['big']);
  });
});

describe('segmentLabelText', () => {
  it('falls back to the field name', () => {
    expect(segmentLabelText(segment('total', 1))).toBe('total');
  });
});

describe('paddingAngleToGap', () => {
  it('is zero when there is no padding', () => {
    expect(paddingAngleToGap(0, 100)).toBe(0);
    expect(paddingAngleToGap(5, 0)).toBe(0);
  });

  it('converts degrees to the chord they subtend at the rim', () => {
    // 60° at radius 100 subtends a chord of exactly the radius.
    expect(paddingAngleToGap(60, 100)).toBeCloseTo(100);
  });

  it('clamps absurd angles', () => {
    expect(paddingAngleToGap(400, 100)).toBeCloseTo(paddingAngleToGap(60, 100));
  });
});

describe('barDomain', () => {
  it('always includes zero', () => {
    expect(barDomain([segment('a', 5), segment('b', 20)])).toEqual([0, 20]);
  });

  it('spans negative values', () => {
    expect(barDomain([segment('a', -5), segment('b', 20)])).toEqual([-5, 20]);
  });

  it('does not collapse when everything is zero', () => {
    expect(barDomain([segment('a', 0)])).toEqual([0, 1]);
  });
});
