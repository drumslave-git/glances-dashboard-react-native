import {
  rawAlert,
  rawContainers,
  rawCpu,
  rawDiskio,
  rawFs,
  rawGpu,
  rawLoad,
  rawMem,
  rawMemswap,
  rawNetwork,
  rawPercpu,
  rawProcesscount,
  rawProcesslist,
  rawQuicklook,
  rawSensors,
  rawSystem,
  rawUptime,
} from '@/__fixtures__/payloads';
import {
  PLUGIN_SPECS,
  normalizeAlert,
  normalizeContainers,
  normalizeCpu,
  normalizeDiskIo,
  normalizeFs,
  normalizeGpu,
  normalizeLoad,
  normalizeMem,
  normalizeMemSwap,
  normalizeNetwork,
  normalizePerCpu,
  normalizeProcessCount,
  normalizeProcessList,
  normalizeQuicklook,
  normalizeSensors,
  normalizeSystem,
  normalizeUptime,
} from './normalize';
import type { SnapshotPlugins } from '@/types/glances';

describe('scalar plugins', () => {
  it('reads cpu, load, mem and swap from a real payload', () => {
    expect(normalizeCpu(rawCpu)).toMatchObject({ total: 3.5, user: 1.7, system: 1.3, idle: 96.2, iowait: 0.3 });
    expect(normalizeLoad(rawLoad)).toMatchObject({ cpucore: 12 });
    expect(normalizeMem(rawMem)?.percent).toBeGreaterThan(0);
    expect(normalizeMemSwap(rawMemswap)).toMatchObject({ percent: 25.6 });
  });

  it('prefers `available` over `free`, which understates a healthy Linux host', () => {
    const mem = normalizeMem(rawMem);
    expect(mem?.available).toBeGreaterThan(mem?.free ?? 0);
  });

  it('keeps uptime as the preformatted string the server sends', () => {
    expect(normalizeUptime(rawUptime)).toBe('31 days, 23:10:53');
    expect(normalizeUptime(1234)).toBeUndefined();
  });

  it('falls back to hostname when hr_name is absent', () => {
    expect(normalizeSystem(rawSystem)?.hostname).toBe('TCloud');
    expect(normalizeSystem({ hostname: 'box' })?.hrName).toBe('box');
  });

  it('rejects a payload of the wrong shape rather than inventing one', () => {
    expect(normalizeCpu([])).toBeUndefined();
    expect(normalizeCpu(null)).toBeUndefined();
    expect(normalizePerCpu({})).toBeUndefined();
  });

  it('defaults missing numbers instead of emitting NaN', () => {
    expect(normalizeCpu({})).toEqual({
      total: 0,
      user: 0,
      system: 0,
      idle: 0,
      iowait: undefined,
      nice: undefined,
      irq: undefined,
      steal: undefined,
    });
  });
});

describe('rate resolution', () => {
  // The whole reason this layer exists: Glances sends three variants of every cumulative counter
  // and only one of them is a rate we may use (ref §4.3).
  it('divides the plain delta by time_since_update rather than taking the floored rate', () => {
    const [lo] = normalizeNetwork(rawNetwork) ?? [];
    const raw = rawNetwork[0];
    expect(lo.rxRatePerSec).toBeCloseTo(raw.bytes_recv / raw.time_since_update, 6);
    // The server's own figure is integer-floored, so the two differ — that is the point.
    expect(lo.rxRatePerSec).not.toBe(raw.bytes_recv_rate_per_sec);
    expect(lo.rxRatePerSec).toBeGreaterThan(raw.bytes_recv_rate_per_sec);
  });

  it('carries the lifetime gauges through untouched, for display only', () => {
    const [lo] = normalizeNetwork(rawNetwork) ?? [];
    expect(lo.bytesRecvGauge).toBe(rawNetwork[0].bytes_recv_gauge);
  });

  it('returns null on the server first refresh, when no rate fields exist yet', () => {
    // The plain field then holds the raw cumulative counter; plotting it would draw a spike.
    const [item] = normalizeNetwork([{ interface_name: 'eth0', bytes_recv: 44412330671 }]) ?? [];
    expect(item.rxRatePerSec).toBeNull();
    expect(item.txRatePerSec).toBeNull();
  });

  it('falls back to _rate_per_sec when time_since_update is missing', () => {
    const [item] = normalizeNetwork([{ interface_name: 'eth0', bytes_recv: 100, bytes_recv_rate_per_sec: 50 }]) ?? [];
    expect(item.rxRatePerSec).toBe(50);
  });

  it('never derives a rate from _gauge alone', () => {
    const [item] = normalizeNetwork([{ interface_name: 'eth0', bytes_recv_gauge: 999, time_since_update: 2 }]) ?? [];
    expect(item.rxRatePerSec).toBeNull();
  });

  it('resolves disk read and write the same way', () => {
    const disks = normalizeDiskIo(rawDiskio) ?? [];
    expect(disks[0].diskName).toBe('sda');
    expect(disks.every((disk) => disk.readRatePerSec !== undefined)).toBe(true);
  });
});

describe('list plugins', () => {
  it('sorts per-core readings by core number', () => {
    const cores = normalizePerCpu(rawPercpu) ?? [];
    expect(cores.map((core) => core.cpuNumber)).toEqual([...cores.map((core) => core.cpuNumber)].sort((a, b) => a - b));
  });

  it('keeps the bind mounts a containerised server leads with', () => {
    const mounts = normalizeFs(rawFs) ?? [];
    expect(mounts[0].mntPoint).toMatch(/^\//);
    expect(mounts[0].deviceName).not.toBeNull();
  });

  it('gives sensors a composite id, because labels repeat across types', () => {
    const sensors = normalizeSensors(rawSensors) ?? [];
    expect(sensors[0].id).toBe(`${sensors[0].type}:${sensors[0].label}`);
    // Two sensors of different types may share a label; their ids must still differ.
    const collided = normalizeSensors([
      { label: 'dell_smm 0', type: 'temperature_core', value: 40, unit: 'C' },
      { label: 'dell_smm 0', type: 'fan_speed', value: 2200, unit: 'RPM' },
    ]);
    expect(new Set(collided?.map((sensor) => sensor.id)).size).toBe(2);
  });

  it('reads a GPU whose fields are vendor-dependent', () => {
    const [gpu] = normalizeGpu(rawGpu) ?? [];
    expect(gpu).toMatchObject({ gpuId: 'nvidia0', name: 'NVIDIA GeForce RTX 3090' });
    // Absent metrics are null, not zero — "not reported" and "reporting zero" are different.
    const [sparse] = normalizeGpu([{ gpu_id: 'x' }]) ?? [];
    expect(sparse.temperature).toBeNull();
    expect(sparse.proc).toBeNull();
  });

  it('reads an empty GPU or container list as an empty state, not a failure', () => {
    expect(normalizeGpu([])).toEqual([]);
    expect(normalizeContainers([])).toEqual([]);
  });

  it('takes the first image tag and tolerates null rates', () => {
    const [container] = normalizeContainers(rawContainers) ?? [];
    expect(container.name).toBe('glances-web');
    expect(container.image).toBe('nicolargo/glances:ubuntu-latest-full');
    // This host reports an empty `network` block, so the rates really are null.
    expect(container.networkRx).toBeNull();
  });

  it('joins a process cmdline array and digs rss out of memory_info', () => {
    const processes = normalizeProcessList(rawProcesslist) ?? [];
    expect(processes[0].cmdline).not.toContain(',');
    expect(typeof processes[0].pid).toBe('number');
    const [one] = normalizeProcessList([
      { pid: 1, name: 'x', cmdline: ['/usr/bin/x', '--flag'], memory_info: { rss: 4096 } },
    ]) ?? [];
    expect(one.cmdline).toBe('/usr/bin/x --flag');
    expect(one.rss).toBe(4096);
  });

  it('sums only the process own user and system cpu time', () => {
    const [one] = normalizeProcessList([{ pid: 1, name: 'x', cpu_times: { user: 1.5, system: 0.5, children_user: 99 } }]) ?? [];
    expect(one.cpuTimeSec).toBe(2);
  });

  it('reads the process counts', () => {
    expect(normalizeProcessCount(rawProcesscount)).toMatchObject({ total: 529, sleeping: 383, thread: 2064 });
  });

  it('unpacks quicklook, including its nested percpu block', () => {
    const quicklook = normalizeQuicklook(rawQuicklook);
    expect(quicklook?.percpu.length).toBeGreaterThan(0);
    expect(quicklook?.cpuName).not.toBeNull();
  });
});

describe('alerts', () => {
  it('reads a healthy server empty feed', () => {
    expect(normalizeAlert(rawAlert)).toEqual([]);
  });

  it('drops any state the server would not have recorded', () => {
    const alerts = normalizeAlert([
      { state: 'OK', type: 'MEM', begin: 1, end: -1 },
      { state: 'CAREFUL', type: 'MEM', begin: 2, end: -1 },
      { state: 'WARNING', type: 'MEM', begin: 3, end: -1 },
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts?.[0].state).toBe('WARNING');
  });

  it('widens server seconds to ms and reads -1 as still running', () => {
    const [ongoing, finished] = normalizeAlert([
      { state: 'CRITICAL', type: 'LOAD', begin: 1700000000, end: -1, count: 3.0 },
      { state: 'WARNING', type: 'MEM', begin: 1700000000, end: 1700000060 },
    ]) ?? [];
    expect(ongoing.begin).toBe(1700000000000);
    expect(ongoing.end).toBeNull();
    expect(ongoing.count).toBe(3);
    expect(finished.end).toBe(1700000060000);
  });

  it('ignores global_msg, which describes the system rather than the event', () => {
    const [alert] = normalizeAlert([
      { state: 'WARNING', type: 'MEM', begin: 1, end: -1, global_msg: 'High CPU I/O waiting' },
    ]) ?? [];
    expect(alert).not.toHaveProperty('globalMsg');
    expect(JSON.stringify(alert)).not.toContain('High CPU');
  });
});

describe('PLUGIN_SPECS', () => {
  it('puts the process and container plugins on the heavy tier', () => {
    // Not cosmetic: polling these at the fast cadence makes Glances report 0% CPU for every row.
    expect(PLUGIN_SPECS.processlist.tier).toBe('heavy');
    expect(PLUGIN_SPECS.processcount.tier).toBe('heavy');
    expect(PLUGIN_SPECS.containers.tier).toBe('heavy');
  });

  it('slices the process list server-side rather than fetching all of it', () => {
    expect(PLUGIN_SPECS.processlist.path).toBe('processlist/top/50');
  });

  it('puts the server-throttled plugins on the slow tier and constants on static', () => {
    expect(PLUGIN_SPECS.fs.tier).toBe('slow');
    expect(PLUGIN_SPECS.sensors.tier).toBe('slow');
    expect(PLUGIN_SPECS.alert.tier).toBe('slow');
    expect(PLUGIN_SPECS.system.tier).toBe('static');
    expect(PLUGIN_SPECS.uptime.tier).toBe('static');
  });

  it('writes a normalized section into the snapshot', () => {
    const target: SnapshotPlugins = {};
    PLUGIN_SPECS.cpu.apply(target, rawCpu);
    expect(target.cpu?.total).toBe(3.5);
  });

  it('leaves the section undefined when the payload is unusable', () => {
    const target: SnapshotPlugins = {};
    PLUGIN_SPECS.cpu.apply(target, 'not a payload');
    expect(target.cpu).toBeUndefined();
  });
});
