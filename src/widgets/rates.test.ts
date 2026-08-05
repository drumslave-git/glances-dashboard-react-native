import {
  dedupeMounts,
  formatElapsed,
  formatPercent,
  formatRate,
  formatTotal,
  pickBusiest,
  shortenMountPath,
} from './rates';

describe('formatElapsed', () => {
  it('renders H:MM:SS with zero-padded minutes and seconds', () => {
    expect(formatElapsed(0)).toBe('0:00:00');
    expect(formatElapsed(65)).toBe('0:01:05');
    expect(formatElapsed(3661)).toBe('1:01:01');
  });

  it('keeps counting hours instead of wrapping to a clock or a day count', () => {
    // 26 hours of CPU time is 26 hours. `2:00:00` would be a different number, and `1d 2h` would
    // lose the precision the column exists for.
    expect(formatElapsed(26 * 3600)).toBe('26:00:00');
    expect(formatElapsed(100 * 3600 + 59 * 60 + 59)).toBe('100:59:59');
  });

  it('drops fractional seconds rather than rounding up into the next second', () => {
    expect(formatElapsed(59.9)).toBe('0:00:59');
  });

  it('dashes anything that is not a duration', () => {
    expect(formatElapsed(null)).toBe('—');
    expect(formatElapsed(undefined)).toBe('—');
    expect(formatElapsed(-1)).toBe('—');
    expect(formatElapsed(Number.NaN)).toBe('—');
  });
});

describe('formatPercent', () => {
  it('carries the sign, because these sit in cells with no unit of their own', () => {
    expect(formatPercent(1.75)).toBe('1.8%');
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('does not clamp — process CPU passes 100 on a multi-core host', () => {
    expect(formatPercent(654.37)).toBe('654.4%');
  });

  it('takes a digit count', () => {
    expect(formatPercent(42.4, 0)).toBe('42%');
  });

  it('dashes a missing reading', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(undefined)).toBe('—');
  });
});

describe('formatRate', () => {
  it('scales bytes per second', () => {
    expect(formatRate(512)).toBe('512 B/s');
    expect(formatRate(5)).toBe('5.00 B/s');
    expect(formatRate(2048)).toBe('2.00 KB/s');
    expect(formatRate(5 * 1024 * 1024)).toBe('5.00 MB/s');
  });

  it('converts to bits when asked, which is eight times the number', () => {
    expect(formatRate(1024, 'bits')).toBe('8.00 Kb/s');
  });

  it('shows a dash for a rate the server has not reported yet', () => {
    // `null` is the first-refresh case. Rendering it as zero would draw a trough that never
    // happened, and on the next poll a spike back up.
    expect(formatRate(null)).toBe('—');
    expect(formatRate(undefined)).toBe('—');
    expect(formatRate(Number.NaN)).toBe('—');
  });

  it('caps decimals as the number grows, so the column does not jitter', () => {
    expect(formatRate(9 * 1024)).toBe('9.00 KB/s');
    expect(formatRate(50 * 1024)).toBe('50.0 KB/s');
    expect(formatRate(500 * 1024)).toBe('500 KB/s');
  });
});

describe('formatTotal', () => {
  it('carries no per-second suffix — a lifetime counter is not a rate', () => {
    expect(formatTotal(2048)).toBe('2.00 KB');
    expect(formatTotal(null)).toBe('—');
  });
});

describe('pickBusiest', () => {
  const items = [
    { name: 'lo', rate: 5 },
    { name: 'eth0', rate: 900 },
    { name: 'docker0', rate: 0 },
    { name: 'wlan0', rate: 40 },
  ];
  const name = (i: (typeof items)[number]) => i.name;
  const rate = (i: (typeof items)[number]) => i.rate;

  it('takes the busiest few when nothing is selected', () => {
    expect(pickBusiest(items, [], name, rate, 2).map(name)).toEqual(['eth0', 'wlan0']);
  });

  it('honours a selection outright, even one currently reading zero', () => {
    // Otherwise the interface someone is watching would vanish the moment it went quiet.
    expect(pickBusiest(items, ['docker0'], name, rate, 2).map(name)).toEqual(['docker0']);
  });

  it('breaks ties by name, so idle rows do not swap places every poll', () => {
    const idle = [
      { name: 'b', rate: 0 },
      { name: 'a', rate: 0 },
    ];
    expect(pickBusiest(idle, [], (i) => i.name, (i) => i.rate, 2).map((i) => i.name)).toEqual(['a', 'b']);
  });

  it('always returns at least one row', () => {
    expect(pickBusiest(items, [], name, rate, 0)).toHaveLength(1);
  });

  it('is empty when a selection names nothing this host has', () => {
    expect(pickBusiest(items, ['enp5s0'], name, rate, 2)).toEqual([]);
  });
});

describe('dedupeMounts', () => {
  const mounts = [
    { path: '/host_mnt/disks/disk14TB', device: '/dev/sda1' },
    { path: '/host_mnt', device: '/dev/sdb2' },
    { path: '/very/long/bind/path/to/sda1', device: '/dev/sda1' },
    { path: '/overlay', device: null },
  ];
  const device = (m: (typeof mounts)[number]) => m.device;
  const path = (m: (typeof mounts)[number]) => m.path;

  it('collapses a device reported under several bind mounts to its shortest path', () => {
    // A containerised Glances sees the host filesystem a dozen times over; showing all of it
    // buries the real disks.
    const kept = dedupeMounts(mounts, device, path, false).map(path);
    expect(kept).toContain('/host_mnt/disks/disk14TB');
    expect(kept).not.toContain('/very/long/bind/path/to/sda1');
  });

  it('keeps a mount with no device rather than guessing', () => {
    expect(dedupeMounts(mounts, device, path, false).map(path)).toContain('/overlay');
  });

  it('shows every mount when the user asked for that', () => {
    expect(dedupeMounts(mounts, device, path, true)).toHaveLength(mounts.length);
  });
});

describe('shortenMountPath', () => {
  it('leaves a short path alone', () => {
    expect(shortenMountPath('/host_mnt')).toBe('/host_mnt');
  });

  it('keeps the tail, which is the part that identifies the mount', () => {
    // Head-truncation would render these two identically as "/host_mnt/dis…".
    const a = shortenMountPath('/host_mnt/disks/disk14TB');
    const b = shortenMountPath('/host_mnt/disks/disk1TB_1');
    expect(a).not.toBe(b);
    expect(a).toContain('disk14TB');
    expect(b).toContain('disk1TB_1');
  });

  it('marks that something was dropped', () => {
    expect(shortenMountPath('/host_mnt/disks/external/disk4TB')).toMatch(/^…\//);
  });

  it('always keeps at least the last segment, however long it is', () => {
    expect(shortenMountPath('/a/b/c/averyveryverylongfinalsegmentindeed')).toContain(
      'averyveryverylongfinalsegmentindeed',
    );
  });
});
