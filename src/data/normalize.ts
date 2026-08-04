/**
 * Raw Glances 4 payloads → normalized snapshot sections.
 *
 * Everything Glances-specific is absorbed here so no widget ever sees it: list plugins are re-keyed
 * by their `key` member, cumulative counters are resolved to a single rate, sensors get a composite
 * id, and every field is defensively optional — a plugin can be disabled server-side, return `[]`,
 * or omit fields by platform.
 *
 * Ported from the reference's `src/main/services/normalize.ts` (ref §5). Pure functions over
 * `unknown`, so the whole module is testable against the captured payloads in
 * `src/__fixtures__/payloads.ts` without a network or a clock.
 */
import type {
  AlertItem,
  ContainerItem,
  CpuStats,
  DiskIoItem,
  FsItem,
  GpuItem,
  LoadStats,
  MemStats,
  MemSwapStats,
  NetworkItem,
  PerCpuStats,
  PluginName,
  ProcessCountStats,
  ProcessItem,
  QuicklookStats,
  SensorItem,
  SnapshotPlugins,
  SystemStats,
} from '@/types/glances';

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function numOr(value: unknown, fallback: number): number {
  return num(value) ?? fallback;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function list(value: unknown): Raw[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

/**
 * Resolve a cumulative counter to a rate per second (ref §4.3).
 *
 * Glances emits three variants per counter from its second refresh onward: `<field>_gauge` (the raw
 * monotonic OS counter), `<field>` (the **delta** since the previous server refresh — not a rate,
 * not a total), and `<field>_rate_per_sec` (that delta integer-floored over the interval). A single
 * per-item `time_since_update` gives the interval in float seconds.
 *
 * Preference order: the plain delta over `time_since_update`, which keeps full precision, then the
 * server's own floored rate. `null` when neither exists — that is the server's very first refresh,
 * where the plain field still holds the raw cumulative counter and plotting it would draw a spike.
 *
 * `_gauge` is never diffed across our own polls: our cadence and the server's refresh cycle are
 * unrelated, and a rate belongs to the server window that produced it.
 */
function ratePerSec(item: Raw, field: string): number | null {
  const timeSinceUpdate = num(item['time_since_update']);
  const delta = num(item[field]);
  if (
    timeSinceUpdate !== null &&
    timeSinceUpdate > 0 &&
    delta !== null &&
    item[`${field}_rate_per_sec`] !== undefined
  ) {
    return delta / timeSinceUpdate;
  }
  return num(item[`${field}_rate_per_sec`]);
}

export function normalizeCpu(raw: unknown): CpuStats | undefined {
  if (!isRecord(raw)) return undefined;
  return {
    total: numOr(raw['total'], 0),
    user: numOr(raw['user'], 0),
    system: numOr(raw['system'], 0),
    idle: numOr(raw['idle'], 0),
    iowait: num(raw['iowait']) ?? undefined,
    nice: num(raw['nice']) ?? undefined,
    irq: num(raw['irq']) ?? undefined,
    steal: num(raw['steal']) ?? undefined,
  };
}

function toPerCpu(item: Raw): PerCpuStats {
  return {
    cpuNumber: numOr(item['cpu_number'], 0),
    total: numOr(item['total'], 0),
    user: numOr(item['user'], 0),
    system: numOr(item['system'], 0),
    idle: numOr(item['idle'], 0),
    iowait: num(item['iowait']) ?? undefined,
  };
}

export function normalizePerCpu(raw: unknown): PerCpuStats[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return list(raw)
    .map(toPerCpu)
    .sort((a, b) => a.cpuNumber - b.cpuNumber);
}

export function normalizeLoad(raw: unknown): LoadStats | undefined {
  if (!isRecord(raw)) return undefined;
  return {
    min1: numOr(raw['min1'], 0),
    min5: numOr(raw['min5'], 0),
    min15: numOr(raw['min15'], 0),
    cpucore: numOr(raw['cpucore'], 1),
  };
}

export function normalizeMem(raw: unknown): MemStats | undefined {
  if (!isRecord(raw)) return undefined;
  return {
    total: numOr(raw['total'], 0),
    available: numOr(raw['available'], 0),
    used: numOr(raw['used'], 0),
    free: numOr(raw['free'], 0),
    percent: numOr(raw['percent'], 0),
    cached: num(raw['cached']),
  };
}

export function normalizeMemSwap(raw: unknown): MemSwapStats | undefined {
  if (!isRecord(raw)) return undefined;
  return {
    total: numOr(raw['total'], 0),
    used: numOr(raw['used'], 0),
    free: numOr(raw['free'], 0),
    percent: numOr(raw['percent'], 0),
  };
}

export function normalizeNetwork(raw: unknown): NetworkItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return list(raw).map((item) => ({
    interfaceName: str(item['interface_name']) ?? '?',
    alias: str(item['alias']),
    rxRatePerSec: ratePerSec(item, 'bytes_recv'),
    txRatePerSec: ratePerSec(item, 'bytes_sent'),
    bytesRecvGauge: num(item['bytes_recv_gauge']),
    bytesSentGauge: num(item['bytes_sent_gauge']),
    speed: num(item['speed']),
  }));
}

export function normalizeDiskIo(raw: unknown): DiskIoItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return list(raw).map((item) => ({
    diskName: str(item['disk_name']) ?? '?',
    readRatePerSec: ratePerSec(item, 'read_bytes'),
    writeRatePerSec: ratePerSec(item, 'write_bytes'),
    readBytesGauge: num(item['read_bytes_gauge']),
    writeBytesGauge: num(item['write_bytes_gauge']),
  }));
}

export function normalizeFs(raw: unknown): FsItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return list(raw).map((item) => ({
    mntPoint: str(item['mnt_point']) ?? '?',
    deviceName: str(item['device_name']),
    fsType: str(item['fs_type']),
    size: numOr(item['size'], 0),
    used: numOr(item['used'], 0),
    free: numOr(item['free'], 0),
    percent: numOr(item['percent'], 0),
  }));
}

export function normalizeSensors(raw: unknown): SensorItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return list(raw).map((item) => {
    const label = str(item['label']) ?? '?';
    const type = str(item['type']) ?? 'unknown';
    return {
      // Labels are not unique across types — a real host reports `dell_smm 0` as both a
      // temperature and a fan — so the id is composite (ref §9).
      id: `${type}:${label}`,
      label,
      type,
      value: num(item['value']),
      unit: str(item['unit']) ?? '',
      warning: num(item['warning']) ?? undefined,
      critical: num(item['critical']) ?? undefined,
    };
  });
}

export function normalizeGpu(raw: unknown): GpuItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return list(raw).map((item) => ({
    gpuId: str(item['gpu_id']) ?? '?',
    name: str(item['name']),
    proc: num(item['proc']),
    mem: num(item['mem']),
    temperature: num(item['temperature']),
    fanSpeed: num(item['fan_speed']),
  }));
}

export function normalizeProcessList(raw: unknown): ProcessItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return list(raw).map((item) => {
    const memoryInfo = isRecord(item['memory_info']) ? item['memory_info'] : undefined;
    const cmdline = item['cmdline'];
    // `cpu_times` is a namedtuple serialized as an object on Linux/macOS and omitted elsewhere.
    // Only user and system are the process's own, so children are deliberately left out.
    const cpuTimes = isRecord(item['cpu_times']) ? item['cpu_times'] : undefined;
    const cpuTimeSec = cpuTimes
      ? (num(cpuTimes['user']) ?? 0) + (num(cpuTimes['system']) ?? 0) || null
      : null;
    return {
      pid: numOr(item['pid'], 0),
      name: str(item['name']) ?? '?',
      username: str(item['username']),
      cpuPercent: num(item['cpu_percent']),
      memoryPercent: num(item['memory_percent']),
      rss: memoryInfo ? num(memoryInfo['rss']) : null,
      numThreads: num(item['num_threads']),
      status: str(item['status']),
      cmdline: Array.isArray(cmdline)
        ? cmdline.filter((part) => typeof part === 'string').join(' ') || null
        : str(cmdline),
      cpuTimeSec,
    };
  });
}

export function normalizeProcessCount(raw: unknown): ProcessCountStats | undefined {
  if (!isRecord(raw)) return undefined;
  return {
    total: numOr(raw['total'], 0),
    running: numOr(raw['running'], 0),
    sleeping: numOr(raw['sleeping'], 0),
    thread: numOr(raw['thread'], 0),
  };
}

export function normalizeContainers(raw: unknown): ContainerItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return list(raw).map((item) => {
    const image = item['image'];
    return {
      name: str(item['name']) ?? '?',
      id: str(item['id']),
      engine: str(item['engine']),
      status: str(item['status']),
      // `image` is an array of tags; the first is the one worth showing.
      image: Array.isArray(image) ? (str(image[0]) ?? null) : str(image),
      cpuPercent: num(item['cpu_percent']),
      memoryUsage: num(item['memory_usage']),
      memoryLimit: num(item['memory_limit']),
      networkRx: num(item['network_rx']),
      networkTx: num(item['network_tx']),
      ioRx: num(item['io_rx']),
      ioWx: num(item['io_wx']),
      uptime: str(item['uptime']),
    };
  });
}

/**
 * The event log.
 *
 * Rows the server would not have recorded are dropped rather than guessed at: only WARNING and
 * CRITICAL ever reach the list server-side, so any other `state` is a payload shape we do not
 * model. Timestamps arrive as whole epoch seconds on the *server's* clock and are widened to ms;
 * `-1` is the sentinel for "still running", not a time.
 *
 * `global_msg` is deliberately not modelled. Despite riding on each event it is not *about* that
 * event — Glances writes the whole system's current decision-tree verdict into every row it
 * touches, so a memory event routinely carries "High CPU I/O waiting" and a quiet system carries
 * the literal placeholder "EVENTS history". The widget names the event from its own `type`.
 */
export function normalizeAlert(raw: unknown): AlertItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return list(raw).flatMap((item): AlertItem[] => {
    const state = str(item['state']);
    if (state !== 'WARNING' && state !== 'CRITICAL') return [];
    const type = str(item['type']) ?? 'UNKNOWN';
    const begin = numOr(item['begin'], 0) * 1000;
    const end = numOr(item['end'], -1);
    const top = item['top'];
    return [
      {
        id: `${type}:${begin}`,
        begin,
        end: end < 0 ? null : end * 1000,
        state,
        type,
        min: num(item['min']),
        max: num(item['max']),
        avg: num(item['avg']),
        count: Math.round(numOr(item['count'], 0)),
        top: Array.isArray(top) ? top.filter((name): name is string => typeof name === 'string') : [],
      },
    ];
  });
}

export function normalizeSystem(raw: unknown): SystemStats | undefined {
  if (!isRecord(raw)) return undefined;
  return {
    hostname: str(raw['hostname']) ?? '?',
    hrName: str(raw['hr_name']) ?? str(raw['hostname']) ?? '?',
    osName: str(raw['os_name']),
    osVersion: str(raw['os_version']),
    platform: str(raw['platform']),
    linuxDistro: str(raw['linux_distro']),
  };
}

/** `/uptime` returns a bare formatted string such as `"24 days, 5:22:00"` — kept verbatim. */
export function normalizeUptime(raw: unknown): string | undefined {
  return typeof raw === 'string' ? raw : undefined;
}

export function normalizeQuicklook(raw: unknown): QuicklookStats | undefined {
  if (!isRecord(raw)) return undefined;
  return {
    cpu: numOr(raw['cpu'], 0),
    mem: numOr(raw['mem'], 0),
    swap: numOr(raw['swap'], 0),
    load: num(raw['load']),
    cpuName: str(raw['cpu_name']),
    cpuHz: num(raw['cpu_hz']),
    cpuHzCurrent: num(raw['cpu_hz_current']),
    cpuCoresPhys: num(raw['cpu_phys_core']),
    cpuCoresLog: num(raw['cpu_log_core']),
    gpuProc: num(raw['gpu_proc']),
    gpuMem: num(raw['gpu_mem']),
    percpu: list(raw['percpu'])
      .map(toPerCpu)
      .sort((a, b) => a.cpuNumber - b.cpuNumber),
  };
}

/**
 * Which cadence a plugin belongs to (ref §4.4).
 *
 * `heavy` exists because the process and container plugins cannot be polled at the fast tier's
 * cadence. Glances derives per-process CPU from the gap between its *own* refreshes, so polling
 * faster than it can refresh leaves it no interval to measure: at 1 s, `/processlist` returns
 * `cpu_percent: 0` for every process from the third request onward and `/processcount` starts
 * flipping between nonsense tallies. Measured by the reference against 4.5.5 — see
 * `HEAVY_TIER_MIN_MS` in `poller.ts`.
 */
export type PollTier = 'fast' | 'heavy' | 'slow' | 'static';

export interface PluginSpec {
  /** Path under `/api/4/`. */
  path: string;
  tier: PollTier;
  /** Writes the normalized value into the snapshot; a no-op when the payload is unusable. */
  apply: (target: SnapshotPlugins, raw: unknown) => void;
}

/**
 * Per-plugin GETs beat `GET /api/4/all`: `/all` always carries the **full** process list with
 * complete cmdline arrays — routinely hundreds of KB — with no request-side way to exclude it,
 * while the individual endpoints are tiny and only refresh their own plugin server-side (ref §4.4).
 *
 * `processlist/top/50` slices server-side for the same reason.
 */
export const PLUGIN_SPECS: Record<PluginName, PluginSpec> = {
  cpu: { path: 'cpu', tier: 'fast', apply: (t, r) => void (t.cpu = normalizeCpu(r)) },
  percpu: { path: 'percpu', tier: 'fast', apply: (t, r) => void (t.percpu = normalizePerCpu(r)) },
  load: { path: 'load', tier: 'fast', apply: (t, r) => void (t.load = normalizeLoad(r)) },
  mem: { path: 'mem', tier: 'fast', apply: (t, r) => void (t.mem = normalizeMem(r)) },
  memswap: { path: 'memswap', tier: 'fast', apply: (t, r) => void (t.memswap = normalizeMemSwap(r)) },
  network: { path: 'network', tier: 'fast', apply: (t, r) => void (t.network = normalizeNetwork(r)) },
  diskio: { path: 'diskio', tier: 'fast', apply: (t, r) => void (t.diskio = normalizeDiskIo(r)) },
  gpu: { path: 'gpu', tier: 'fast', apply: (t, r) => void (t.gpu = normalizeGpu(r)) },
  quicklook: {
    path: 'quicklook',
    tier: 'fast',
    apply: (t, r) => void (t.quicklook = normalizeQuicklook(r)),
  },
  processlist: {
    path: 'processlist/top/50',
    tier: 'heavy',
    apply: (t, r) => void (t.processlist = normalizeProcessList(r)),
  },
  processcount: {
    path: 'processcount',
    tier: 'heavy',
    apply: (t, r) => void (t.processcount = normalizeProcessCount(r)),
  },
  // Docker's own stats window is ~3 s (the payload reports `time_since_update: 3`), so polling
  // faster returns nothing new — and measurably breaks the processlist plugin's CPU accounting.
  containers: {
    path: 'containers',
    tier: 'heavy',
    apply: (t, r) => void (t.containers = normalizeContainers(r)),
  },
  // The server refreshes these on its own slower cadence regardless of how often we ask.
  sensors: { path: 'sensors', tier: 'slow', apply: (t, r) => void (t.sensors = normalizeSensors(r)) },
  fs: { path: 'fs', tier: 'slow', apply: (t, r) => void (t.fs = normalizeFs(r)) },
  // Events are raised by the server's own refresh loop whatever our cadence, and one must last 6 s
  // to be recorded at all — polling this fast would only re-fetch the same ten rows.
  alert: { path: 'alert', tier: 'slow', apply: (t, r) => void (t.alert = normalizeAlert(r)) },
  system: { path: 'system', tier: 'static', apply: (t, r) => void (t.system = normalizeSystem(r)) },
  uptime: { path: 'uptime', tier: 'static', apply: (t, r) => void (t.uptime = normalizeUptime(r)) },
};
