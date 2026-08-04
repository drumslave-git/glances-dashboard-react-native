import {
  MAX_WINDOW_SEC,
  MIN_RETENTION_SEC,
  RingBuffer,
  bufferSizes,
  capacityFor,
  evictEndpoint,
  getBuffer,
  pushSnapshot,
  resetBuffers,
  retentionSecFor,
  setEndpointCapacity,
  sliceKey,
} from './buffers';

beforeEach(resetBuffers);

const sample = <T,>(ts: number, value?: T) => ({ ts, value: (value ?? ts) as T });

describe('RingBuffer', () => {
  it('returns samples oldest to newest', () => {
    const buffer = new RingBuffer<number>(4);
    [1, 2, 3].forEach((ts) => buffer.push(sample(ts)));
    expect(buffer.toArray().map((s) => s.ts)).toEqual([1, 2, 3]);
    expect(buffer.size).toBe(3);
  });

  it('overwrites the oldest sample once full, and keeps reading in order', () => {
    const buffer = new RingBuffer<number>(3);
    [1, 2, 3, 4, 5].forEach((ts) => buffer.push(sample(ts)));
    expect(buffer.toArray().map((s) => s.ts)).toEqual([3, 4, 5]);
    expect(buffer.size).toBe(3);
    expect(buffer.latest()?.ts).toBe(5);
  });

  it('has no latest sample while empty', () => {
    expect(new RingBuffer<number>(3).latest()).toBeUndefined();
    expect(new RingBuffer<number>(3).toArray()).toEqual([]);
  });

  it('never has zero capacity', () => {
    const buffer = new RingBuffer<number>(0);
    buffer.push(sample(1));
    expect(buffer.latest()?.ts).toBe(1);
  });

  describe('since', () => {
    it('measures the window back from the newest sample, not the wall clock', () => {
      // If polling stalled, a 5-minute window should still show the last five minutes of data
      // rather than mostly empty axis.
      const buffer = new RingBuffer<number>(10);
      const base = 1_000_000_000_000;
      [0, 60, 120, 240, 300].forEach((offset) => buffer.push(sample(base + offset * 1000)));
      const window = buffer.since(180);
      expect(window.map((s) => s.ts)).toEqual([base + 120_000, base + 240_000, base + 300_000]);
    });

    it('accepts an explicit now, and returns everything for a non-positive window', () => {
      const buffer = new RingBuffer<number>(10);
      [1000, 2000, 3000].forEach((ts) => buffer.push(sample(ts)));
      expect(buffer.since(1, 3000).map((s) => s.ts)).toEqual([2000, 3000]);
      expect(buffer.since(0).map((s) => s.ts)).toEqual([1000, 2000, 3000]);
    });

    it('is empty when the buffer is', () => {
      expect(new RingBuffer<number>(4).since(300)).toEqual([]);
    });
  });

  describe('resize', () => {
    it('keeps the newest samples when shrinking', () => {
      const buffer = new RingBuffer<number>(5);
      [1, 2, 3, 4, 5].forEach((ts) => buffer.push(sample(ts)));
      buffer.resize(2);
      expect(buffer.toArray().map((s) => s.ts)).toEqual([4, 5]);
      expect(buffer.capacity).toBe(2);
    });

    it('keeps everything when growing, and stays writable', () => {
      const buffer = new RingBuffer<number>(2);
      [1, 2].forEach((ts) => buffer.push(sample(ts)));
      buffer.resize(4);
      buffer.push(sample(3));
      expect(buffer.toArray().map((s) => s.ts)).toEqual([1, 2, 3]);
    });
  });
});

describe('capacityFor', () => {
  it('derives capacity from the poll interval so the window holds', () => {
    expect(capacityFor(1000, 900)).toBe(900);
    expect(capacityFor(2000, 900)).toBe(450);
    expect(capacityFor(3000, 900)).toBe(300);
  });

  it('floors the interval, so a nonsensical one cannot demand an enormous buffer', () => {
    expect(capacityFor(0, 300)).toBe(600);
  });

  it('always leaves room for at least two samples — one point draws no line', () => {
    expect(capacityFor(60_000, 5)).toBe(2);
  });
});

describe('retentionSecFor', () => {
  it('takes the widest window any widget asked for', () => {
    expect(retentionSecFor([300, 900, 600])).toBe(900);
  });

  it('floors at the minimum, so a board of gauges still fills a buffer', () => {
    expect(retentionSecFor([])).toBe(MIN_RETENTION_SEC);
    expect(retentionSecFor([60])).toBe(MIN_RETENTION_SEC);
  });

  it('caps at the longest offered window, and ignores nonsense', () => {
    expect(retentionSecFor([99_999])).toBe(MAX_WINDOW_SEC);
    expect(retentionSecFor([Number.NaN, 600])).toBe(600);
  });
});

describe('pushSnapshot', () => {
  it('appends every present section and reports which slices moved', () => {
    const touched = pushSnapshot('e1', 1000, { cpu: { total: 5, user: 1, system: 1, idle: 93 } });
    expect(touched).toEqual([sliceKey('e1', 'cpu')]);
    expect(getBuffer('e1', 'cpu')?.latest()?.value).toMatchObject({ total: 5 });
  });

  it('skips absent sections rather than storing an undefined sample', () => {
    // Every section is optional — a slow-tier plugin simply did not fire on this tick.
    const touched = pushSnapshot('e1', 1000, { cpu: undefined, mem: undefined });
    expect(touched).toEqual([]);
    expect(bufferSizes()).toEqual({});
  });

  it('keeps endpoints apart', () => {
    pushSnapshot('e1', 1, { uptime: 'a' });
    pushSnapshot('e2', 1, { uptime: 'b' });
    expect(getBuffer<string>('e1', 'uptime')?.latest()?.value).toBe('a');
    expect(getBuffer<string>('e2', 'uptime')?.latest()?.value).toBe('b');
  });
});

describe('capacity per endpoint', () => {
  it('resizes the endpoint existing buffers in place', () => {
    for (let i = 0; i < 10; i += 1) pushSnapshot('e1', i, { uptime: `t${i}` });
    setEndpointCapacity('e1', 3);
    expect(getBuffer('e1', 'uptime')?.size).toBe(3);
    expect(getBuffer<string>('e1', 'uptime')?.latest()?.value).toBe('t9');
  });

  it('applies to buffers created afterwards too', () => {
    setEndpointCapacity('e1', 2);
    for (let i = 0; i < 5; i += 1) pushSnapshot('e1', i, { uptime: `t${i}` });
    expect(getBuffer('e1', 'uptime')?.capacity).toBe(2);
  });

  it('leaves other endpoints alone', () => {
    for (let i = 0; i < 5; i += 1) pushSnapshot('e2', i, { uptime: `t${i}` });
    setEndpointCapacity('e1', 2);
    expect(getBuffer('e2', 'uptime')?.size).toBe(5);
  });
});

describe('evictEndpoint', () => {
  it('drops only that endpoint buffers', () => {
    pushSnapshot('e1', 1, { uptime: 'a' });
    pushSnapshot('e2', 1, { uptime: 'b' });
    evictEndpoint('e1');
    expect(getBuffer('e1', 'uptime')).toBeUndefined();
    expect(getBuffer('e2', 'uptime')).toBeDefined();
  });

  it('does not confuse an endpoint with one whose id it prefixes', () => {
    pushSnapshot('e1', 1, { uptime: 'a' });
    pushSnapshot('e10', 1, { uptime: 'b' });
    evictEndpoint('e1');
    expect(getBuffer('e10', 'uptime')).toBeDefined();
  });
});
