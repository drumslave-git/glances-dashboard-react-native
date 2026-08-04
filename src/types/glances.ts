/**
 * Normalized snapshot types — the shape every widget reads.
 *
 * `src/data/normalize.ts` turns raw Glances 4 payloads into these before anything else sees them:
 * list plugins are re-keyed by their own `key` member, cumulative counters are resolved to a single
 * rate per second, and sensors get a composite id. Nothing above this layer touches a Glances quirk.
 *
 * Ported from the reference's `src/shared/glances.ts` (ref §5), field names verified against a live
 * Glances 4.5.6 server — see `src/__fixtures__/payloads.ts`.
 */

/** The plugins we fetch. Values are the `/api/4/<path>` suffixes minus any modifiers. */
export const PLUGINS = [
  'cpu',
  'percpu',
  'load',
  'mem',
  'memswap',
  'network',
  'diskio',
  'fs',
  'sensors',
  'gpu',
  'processlist',
  'processcount',
  'containers',
  'system',
  'uptime',
  'quicklook',
  'alert',
] as const;

export type PluginName = (typeof PLUGINS)[number];

export interface CpuStats {
  total: number;
  user: number;
  system: number;
  idle: number;
  iowait?: number;
  nice?: number;
  irq?: number;
  steal?: number;
}

export interface PerCpuStats {
  cpuNumber: number;
  total: number;
  user: number;
  system: number;
  idle: number;
  iowait?: number;
}

export interface LoadStats {
  min1: number;
  min5: number;
  min15: number;
  cpucore: number;
}

export interface MemStats {
  total: number;
  /**
   * What can still be allocated. Preferred over `free`, which excludes reclaimable page cache and
   * so reads alarmingly low on a healthy Linux host.
   */
  available: number;
  used: number;
  free: number;
  percent: number;
  /** Page cache. Linux and macOS report it; Windows does not, hence nullable. */
  cached: number | null;
}

export interface MemSwapStats {
  total: number;
  used: number;
  free: number;
  percent: number;
}

/**
 * One network interface. Rates are **bytes per second**, and `null` on the server's very first
 * refresh, when no rate fields exist yet — widgets skip such a point rather than plot a raw
 * cumulative counter as a spike (ref §4.3).
 *
 * `is_up` is documented for this plugin but absent from real 4.5.x payloads, so it is not modelled.
 */
export interface NetworkItem {
  interfaceName: string;
  alias: string | null;
  rxRatePerSec: number | null;
  txRatePerSec: number | null;
  /** Lifetime totals — display only. Never diffed across our own polls. */
  bytesRecvGauge: number | null;
  bytesSentGauge: number | null;
  /** Link speed in bits/s as reported by the OS; 0 when unknown. */
  speed: number | null;
}

/** Rates are bytes per second, `null` on the server's first refresh (ref §4.3). */
export interface DiskIoItem {
  diskName: string;
  readRatePerSec: number | null;
  writeRatePerSec: number | null;
  readBytesGauge: number | null;
  writeBytesGauge: number | null;
}

export interface FsItem {
  mntPoint: string;
  deviceName: string | null;
  fsType: string | null;
  size: number;
  used: number;
  free: number;
  percent: number;
}

export type SensorType = 'temperature_core' | 'fan_speed' | 'battery' | string;

export interface SensorItem {
  /** `${type}:${label}` — labels alone are not unique across types (ref §9). */
  id: string;
  label: string;
  type: SensorType;
  value: number | null;
  unit: string;
  warning?: number;
  critical?: number;
}

/** Every metric is nullable — which ones a vendor reports varies. `mem` is a **percentage**. */
export interface GpuItem {
  gpuId: string;
  name: string | null;
  proc: number | null;
  mem: number | null;
  temperature: number | null;
  fanSpeed: number | null;
}

export interface ProcessItem {
  pid: number;
  name: string;
  username: string | null;
  /** Can exceed 100 on a multi-core host. */
  cpuPercent: number | null;
  memoryPercent: number | null;
  /** Resident set size in bytes. */
  rss: number | null;
  numThreads: number | null;
  status: string | null;
  /** Joined from the raw `cmdline` array, which is what Glances actually sends. */
  cmdline: string | null;
  /**
   * Total CPU seconds consumed since the process started (user + system).
   *
   * The counterpart to `cpuPercent`: the instantaneous figure says what a process is doing now,
   * this says what it has cost overall — which is how a slow leak is told from a brief spike.
   */
  cpuTimeSec: number | null;
}

export interface ProcessCountStats {
  total: number;
  running: number;
  sleeping: number;
  thread: number;
}

export interface ContainerItem {
  name: string;
  id: string | null;
  engine: string | null;
  status: string | null;
  image: string | null;
  cpuPercent: number | null;
  memoryUsage: number | null;
  memoryLimit: number | null;
  /**
   * Network and I/O rates, all four in **bytes per second**.
   *
   * The Glances docs describe `network_rx`/`network_tx` as bits/s. They are wrong: 4.5.x computes
   * them as `network.rx / network.time_since_update` — a byte delta over seconds, exactly like
   * `io_rx` and `io_wx`. Verified against a live server by the reference (ref §9).
   */
  networkRx: number | null;
  networkTx: number | null;
  ioRx: number | null;
  ioWx: number | null;
  /** Pre-formatted by the server, e.g. `"2 days"`. */
  uptime: string | null;
}

export interface SystemStats {
  hostname: string;
  /** Ready-made display string, e.g. `"Ubuntu 25.10 64bit / Linux 6.17.0-40-generic"`. */
  hrName: string;
  osName: string | null;
  osVersion: string | null;
  platform: string | null;
  linuxDistro: string | null;
}

export interface QuicklookStats {
  cpu: number;
  mem: number;
  swap: number;
  /** Load as a percentage of capacity — already normalized by the server. */
  load: number | null;
  cpuName: string | null;
  cpuHz: number | null;
  cpuHzCurrent: number | null;
  cpuCoresPhys: number | null;
  cpuCoresLog: number | null;
  gpuProc: number | null;
  gpuMem: number | null;
  percpu: PerCpuStats[];
}

/**
 * One entry in a server's event log — the Glances `alert` plugin.
 *
 * These are not thresholds this app evaluates: the server raises an event when one of its own
 * stats crosses a limit from its `glances.conf`, keeps it open while the condition holds, and
 * closes it on recovery. Only the last few are kept (10 by default), so this is a recent-events
 * feed rather than a history.
 */
export interface AlertItem {
  /** `type:begin` — unique within one endpoint; two events of a type never share a start second. */
  id: string;
  /** Start, epoch ms. From the **endpoint's own clock** (Glances reports whole seconds). */
  begin: number;
  /** End, epoch ms, or `null` while the event is still running (Glances sends `-1`). */
  end: number | null;
  /** Glances discards OK and CAREFUL before recording, so only these two ever arrive. */
  state: 'WARNING' | 'CRITICAL';
  /** The stat that raised it: `MEM`, `MEMSWAP`, `CPU_IOWAIT`, `LOAD`, `SENSORS_<label>`, … */
  type: string;
  /**
   * Percentages, all three — whatever the plugin. Glances records `(value * 100) / maximum` for
   * every event, so a load event is a share of core capacity and a sensor event a share of its
   * critical limit, not the raw reading (ref §9).
   */
  min: number | null;
  max: number | null;
  avg: number | null;
  /** How many server refreshes the event has spanned so far. */
  count: number;
  /** Up to three process names. Collected only while the event is CRITICAL, so often empty. */
  top: string[];
}

/**
 * Every section is optional: a plugin can be disabled server-side, absent (no GPU), or simply
 * belong to a slower tier that did not fire on this tick.
 */
export interface SnapshotPlugins {
  cpu?: CpuStats;
  percpu?: PerCpuStats[];
  load?: LoadStats;
  mem?: MemStats;
  memswap?: MemSwapStats;
  network?: NetworkItem[];
  diskio?: DiskIoItem[];
  fs?: FsItem[];
  sensors?: SensorItem[];
  gpu?: GpuItem[];
  processlist?: ProcessItem[];
  processcount?: ProcessCountStats;
  containers?: ContainerItem[];
  system?: SystemStats;
  /** A bare formatted string such as `"3 days, 4:12:07"` — displayed verbatim (ref §9). */
  uptime?: string;
  quicklook?: QuicklookStats;
  alert?: AlertItem[];
}

export interface EndpointSnapshot {
  endpointId: string;
  /** Client receive time, epoch ms. */
  ts: number;
  plugins: SnapshotPlugins;
}

/** Where an endpoint is in its connection lifecycle (ref §9). */
export type EndpointState =
  | 'connecting'
  | 'online'
  /** 1–2 consecutive failures. */
  | 'degraded'
  /** 3+ consecutive failures; backoff is active. */
  | 'offline'
  | 'unsupported-version'
  /** Paused by the user — widgets must tell this apart from a failure. */
  | 'disabled';

export interface EndpointStatus {
  endpointId: string;
  state: EndpointState;
  lastError?: string;
  /** From `/api/4/status`. */
  glancesVersion?: string;
  /** From `/api/4/pluginslist` — drives which widgets the catalog offers for this host. */
  capabilities?: string[];
  /** From `/api/4/all/limits`, flattened — drives threshold colouring. */
  limits?: Record<string, number>;
  /** Epoch ms of the last successful poll, if any. */
  lastSuccessAt?: number;
}

export type ProbeResult =
  | {
      ok: true;
      glancesVersion: string;
      capabilities: string[];
      limits: Record<string, number>;
    }
  | {
      ok: false;
      reason: 'unsupported-version' | 'unreachable' | 'bad-response';
      message: string;
      /** Present when a v3 server answered the fallback probe. */
      detectedVersion?: string;
    };
