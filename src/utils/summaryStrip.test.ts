import { fsFixture, systemFixture } from '@/__fixtures__/glances';

import {
  NO_VALUE,
  buildSummaryCells,
  formatBytesPair,
  formatDisk,
  formatDuration,
  formatLoad,
  formatProcessCount,
  formatUptime,
  pickByteUnit,
} from './summaryStrip';

describe('formatUptime', () => {
  it('reads the { seconds } shape', () => {
    expect(formatUptime({ seconds: 31 * 86400 + 12 * 3600 })).toBe('31d 12h');
  });

  it('reads the rendered-string shape some versions serve instead', () => {
    expect(formatUptime('31 days, 12:34:56')).toBe('31d 12h');
    expect(formatUptime('12:34:56')).toBe('12h 34m');
  });

  it('says nothing rather than guessing', () => {
    expect(formatUptime(undefined)).toBe(NO_VALUE);
    expect(formatUptime({})).toBe(NO_VALUE);
  });

  it('passes an unparseable string through instead of hiding it', () => {
    expect(formatUptime('a while')).toBe('a while');
  });
});

describe('formatDuration', () => {
  it('steps down through days, hours and minutes', () => {
    expect(formatDuration(90061)).toBe('1d 1h');
    expect(formatDuration(3660)).toBe('1h 01m');
    expect(formatDuration(240)).toBe('4m');
  });

  it('rejects nonsense', () => {
    expect(formatDuration(-1)).toBe(NO_VALUE);
    expect(formatDuration(Number.NaN)).toBe(NO_VALUE);
  });
});

describe('formatLoad', () => {
  it('renders the three averages at two decimals', () => {
    expect(formatLoad({ min1: 1.92, min5: 1.44, min15: 1.1, cpucore: 12 })).toBe('1.92 / 1.44 / 1.10');
  });

  it('needs all three', () => {
    expect(formatLoad({ min1: 1.92 })).toBe(NO_VALUE);
    expect(formatLoad(null)).toBe(NO_VALUE);
  });
});

describe('formatProcessCount', () => {
  it('renders total and running', () => {
    expect(formatProcessCount({ total: 412, running: 3, sleeping: 409 })).toBe('412 · 3 run');
  });

  it('falls back to the total alone', () => {
    expect(formatProcessCount({ total: 412 })).toBe('412');
    expect(formatProcessCount({})).toBe(NO_VALUE);
  });
});

describe('formatDisk', () => {
  it('sums every filesystem rather than trusting the first entry', () => {
    // The captured payload leads with a bind mount, which is exactly why this
    // sums instead of reading fsFixture[0].
    expect(formatDisk(fsFixture)).toMatch(/^\d+\.\d \/ \d+\.\d TB$/);
  });

  it('counts a device once even when it is mounted twice', () => {
    const doubled = [
      { device_name: '/dev/sda1', used: 1024 ** 4, size: 2 * 1024 ** 4 },
      { device_name: '/dev/sda1', used: 1024 ** 4, size: 2 * 1024 ** 4 },
    ];
    expect(formatDisk(doubled)).toBe('1.0 / 2.0 TB');
  });

  it('needs an array of usable entries', () => {
    expect(formatDisk({ used: 1, size: 2 })).toBe(NO_VALUE);
    expect(formatDisk([])).toBe(NO_VALUE);
    expect(formatDisk([{ device_name: 'x' }])).toBe(NO_VALUE);
  });
});

describe('byte helpers', () => {
  it('picks the largest unit the value fills', () => {
    expect(pickByteUnit(5 * 1024 ** 4).suffix).toBe('TB');
    expect(pickByteUnit(5 * 1024 ** 3).suffix).toBe('GB');
    expect(pickByteUnit(12).suffix).toBe('B');
  });

  it('renders a used/total pair in the total’s unit', () => {
    expect(formatBytesPair(8.39 * 1024 ** 3, 123 * 1024 ** 3)).toBe('8.39 / 123 GB');
    expect(formatBytesPair(null, 1)).toBe(NO_VALUE);
    expect(formatBytesPair(1, 0)).toBe(NO_VALUE);
  });
});

describe('buildSummaryCells', () => {
  it('returns the six cells in the handoff order', () => {
    const cells = buildSummaryCells({
      system: systemFixture,
      uptime: { seconds: 86400 },
      load: { min1: 1, min5: 1, min15: 1 },
      processCount: { total: 5, running: 1 },
      fs: fsFixture,
    });

    expect(cells.map((cell) => cell.key)).toEqual([
      'host',
      'uptime',
      'kernel',
      'load',
      'processes',
      'disk',
    ]);
    expect(cells[0].value).toBe('TCloud');
    expect(cells[2].value).toBe('6.17.0-40-generic');
  });

  it('fills every cell with an em dash when nothing is loaded yet', () => {
    const cells = buildSummaryCells({});
    expect(cells.every((cell) => cell.value === NO_VALUE)).toBe(true);
    expect(cells).toHaveLength(6);
  });
});
