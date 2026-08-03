import {
  DEFAULT_CAPACITY,
  TIME_WINDOWS,
  formatClock,
  isTimeWindow,
  nextTimeWindow,
  pushSample,
  recentSamples,
  samplesWithin,
  seriesDomain,
  seriesStats,
  timeAxisTicks,
  type Sample,
} from './sampleBuffer';

function series(values: number[], step = 5000, start = 1_000_000): Sample[] {
  return values.map((v, index) => ({ t: start + index * step, v }));
}

describe('pushSample', () => {
  it('appends in order', () => {
    const buffer = pushSample(pushSample([], { t: 1, v: 10 }), { t: 2, v: 20 });
    expect(buffer).toEqual([
      { t: 1, v: 10 },
      { t: 2, v: 20 },
    ]);
  });

  it('ignores a sample that is not newer, so repeat polls do not duplicate', () => {
    const buffer = pushSample([], { t: 5, v: 1 });
    // Three widgets on the same server and endpoint all report the same poll.
    const again = pushSample(pushSample(buffer, { t: 5, v: 1 }), { t: 5, v: 1 });
    expect(again).toHaveLength(1);
  });

  it('returns the same reference when nothing changed', () => {
    const buffer = pushSample([], { t: 5, v: 1 });
    expect(pushSample(buffer, { t: 5, v: 1 })).toBe(buffer);
    expect(pushSample(buffer, { t: 6, v: Number.NaN })).toBe(buffer);
  });

  it('drops the oldest sample at capacity', () => {
    let buffer: Sample[] = [];
    for (let i = 0; i < 12; i += 1) buffer = pushSample(buffer, { t: i, v: i }, 10);
    expect(buffer).toHaveLength(10);
    expect(buffer[0]).toEqual({ t: 2, v: 2 });
  });

  it('holds an hour at a five-second cadence by default', () => {
    expect(DEFAULT_CAPACITY * 5000).toBeGreaterThanOrEqual(TIME_WINDOWS['1h']);
  });

  it('treats a missing buffer as empty', () => {
    expect(pushSample(undefined, { t: 1, v: 1 })).toEqual([{ t: 1, v: 1 }]);
  });
});

describe('samplesWithin', () => {
  const buffer = series([1, 2, 3, 4, 5]); // t = 1_000_000 … 1_020_000

  it('returns the suffix inside the window', () => {
    expect(samplesWithin(buffer, 10_000, 1_020_000).map((s) => s.v)).toEqual([3, 4, 5]);
  });

  it('returns everything when the window covers the buffer', () => {
    expect(samplesWithin(buffer, 10_000_000, 1_020_000)).toHaveLength(5);
  });

  it('returns nothing when every sample is older than the window', () => {
    expect(samplesWithin(buffer, 1000, 9_999_999)).toEqual([]);
    expect(samplesWithin([], 1000, 1)).toEqual([]);
  });
});

describe('recentSamples', () => {
  const buffer = series([1, 2, 3, 4, 5]);

  it('measures the window back from the newest sample, not the wall clock', () => {
    expect(recentSamples(buffer, 10_000).map((s) => s.v)).toEqual([3, 4, 5]);
  });

  it('still shows the last window of data when polling has stalled', () => {
    // Every sample is hours old; the chart should show them, not an empty box.
    const stale = series([1, 2, 3], 5000, 0);
    expect(recentSamples(stale, 10_000)).toHaveLength(3);
  });

  it('has nothing to return for an empty buffer', () => {
    expect(recentSamples([], 1000)).toEqual([]);
    expect(recentSamples(undefined, 1000)).toEqual([]);
  });
});

describe('seriesStats', () => {
  it('reports peak, min, average and the delta the footer prints', () => {
    const stats = seriesStats(series([10, 20, 30]));
    expect(stats).toMatchObject({ peak: 30, min: 10, avg: 20, latest: 30, count: 3 });
    expect(stats?.deltaFromAvg).toBe(10);
  });

  it('has nothing to say about an empty series', () => {
    expect(seriesStats([])).toBeNull();
  });
});

describe('seriesDomain', () => {
  it('pins percentages to 0–100 so the line does not rescale every poll', () => {
    expect(seriesDomain(series([3, 4]), { percentage: true })).toEqual([0, 100]);
  });

  it('follows the data with headroom otherwise', () => {
    const [low, high] = seriesDomain(series([0, 200]));
    expect(low).toBe(0);
    expect(high).toBeCloseTo(220, 6);
  });

  it('never returns a zero-height domain', () => {
    expect(seriesDomain([])).toEqual([0, 1]);
    expect(seriesDomain(series([0, 0]))).toEqual([0, 1]);
  });
});

describe('timeAxisTicks', () => {
  it('spaces five labels across the window, first and last included', () => {
    const ticks = timeAxisTicks(series([0, 1, 2, 3, 4, 5, 6, 7, 8]));
    expect(ticks.map((s) => s.v)).toEqual([0, 2, 4, 6, 8]);
  });

  it('returns what it has rather than repeating a label', () => {
    expect(timeAxisTicks(series([1, 2]))).toHaveLength(2);
    expect(timeAxisTicks([])).toEqual([]);
  });
});

describe('time windows', () => {
  it('cycles 5m → 15m → 1h → 5m', () => {
    expect(nextTimeWindow('5m')).toBe('15m');
    expect(nextTimeWindow('15m')).toBe('1h');
    expect(nextTimeWindow('1h')).toBe('5m');
  });

  it('validates a persisted value', () => {
    expect(isTimeWindow('15m')).toBe(true);
    expect(isTimeWindow('30m')).toBe(false);
    expect(isTimeWindow(undefined)).toBe(false);
  });
});

describe('formatClock', () => {
  it('renders zero-padded local hours and minutes', () => {
    const at = new Date(2026, 7, 3, 9, 5).getTime();
    expect(formatClock(at)).toBe('09:05');
  });
});
