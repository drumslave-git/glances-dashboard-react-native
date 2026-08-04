/**
 * Metric series live here — never in React state, and never in a store.
 *
 * The reference's reason holds exactly as well in React Native (ref §7.2): a per-second tick across
 * a dozen widgets must not churn the tree. `pushSnapshot` mutates buffers in place and the store
 * (`feed-store.ts`) carries only a small per-slice counter, so a chart can subscribe to that counter
 * and repaint its canvas without a single re-render.
 *
 * Nothing here is persisted. History is lost on restart, which is what both apps do — a dashboard of
 * live values has no use for yesterday's samples, and writing them would be the one thing that
 * turned config storage into a database.
 */
import type { PluginName, SnapshotPlugins } from '@/types/glances';

export type SliceKey = `${string}:${string}`;

export interface Sample<T = unknown> {
  /** Epoch ms, client receive time. */
  ts: number;
  value: T;
}

export function sliceKey(endpointId: string, plugin: PluginName): SliceKey {
  return `${endpointId}:${plugin}`;
}

/** Fixed-capacity circular buffer — pushing past capacity overwrites the oldest sample. */
export class RingBuffer<T> {
  #items: (Sample<T> | undefined)[];
  #next = 0;
  #size = 0;

  constructor(capacity: number) {
    this.#items = new Array<Sample<T> | undefined>(Math.max(1, capacity));
  }

  get size(): number {
    return this.#size;
  }

  get capacity(): number {
    return this.#items.length;
  }

  push(sample: Sample<T>): void {
    this.#items[this.#next] = sample;
    this.#next = (this.#next + 1) % this.#items.length;
    if (this.#size < this.#items.length) this.#size += 1;
  }

  /** Oldest → newest. */
  toArray(): Sample<T>[] {
    const out: Sample<T>[] = [];
    const start = (this.#next - this.#size + this.#items.length) % this.#items.length;
    for (let i = 0; i < this.#size; i += 1) {
      const item = this.#items[(start + i) % this.#items.length];
      if (item) out.push(item);
    }
    return out;
  }

  /**
   * Samples newer than `windowSec` seconds, oldest → newest.
   *
   * `now` defaults to the **newest sample's** timestamp rather than the wall clock. That started as
   * a lint fix — `react-hooks/purity` refuses `Date.now()` during render — and turned out to be
   * more correct: if polling stalled two minutes ago, a 5-minute window should still show the last
   * five minutes of *data*, not three minutes of data and a gap.
   */
  since(windowSec: number, now = this.latest()?.ts ?? 0): Sample<T>[] {
    if (windowSec <= 0) return this.toArray();
    const cutoff = now - windowSec * 1000;
    return this.toArray().filter((sample) => sample.ts >= cutoff);
  }

  latest(): Sample<T> | undefined {
    if (this.#size === 0) return undefined;
    return this.#items[(this.#next - 1 + this.#items.length) % this.#items.length];
  }

  /** Grow or shrink while keeping the newest samples — used when a poll interval changes. */
  resize(capacity: number): void {
    const kept = this.toArray().slice(-Math.max(1, capacity));
    this.#items = new Array<Sample<T> | undefined>(Math.max(1, capacity));
    this.#next = 0;
    this.#size = 0;
    for (const sample of kept) this.push(sample);
  }
}

const buffers = new Map<SliceKey, RingBuffer<unknown>>();
/** Capacity is derived per endpoint from its poll interval, so the advertised window holds. */
const capacities = new Map<string, number>();

const DEFAULT_CAPACITY = 450;

/**
 * The shortest history any endpoint keeps, in seconds.
 *
 * Even a board of nothing but gauges retains this much, so that adding a chart later starts it
 * filling from a buffer that already exists rather than from empty.
 */
export const MIN_RETENTION_SEC = 300;

/** The longest window a widget may ask for. Retention never exceeds it. */
export const MAX_WINDOW_SEC = 1800;

/**
 * `capacity = ceil(windowSec / pollIntervalSec)` — 900 samples at 1 s, 450 at 2 s (ref §7.2).
 *
 * Derived rather than configured: a global "history size" setting could only contradict the
 * per-widget windows, either starving a 30-minute chart or buffering for charts nobody added.
 */
export function capacityFor(pollIntervalMs: number, windowSec: number = MAX_WINDOW_SEC): number {
  const intervalSec = Math.max(0.5, pollIntervalMs / 1000);
  return Math.max(2, Math.ceil(windowSec / intervalSec));
}

/**
 * Seconds of history one endpoint must retain: the widest window any of its own widgets asks for,
 * floored at `MIN_RETENTION_SEC` and capped at `MAX_WINDOW_SEC`.
 *
 * Takes the windows already extracted by the caller rather than widget rows, so this module stays
 * independent of the widget catalog.
 */
export function retentionSecFor(requestedWindowsSec: readonly number[]): number {
  let seconds = MIN_RETENTION_SEC;
  for (const window of requestedWindowsSec) {
    if (Number.isFinite(window)) seconds = Math.max(seconds, window);
  }
  return Math.min(seconds, MAX_WINDOW_SEC);
}

export function setEndpointCapacity(endpointId: string, capacity: number): void {
  if (capacities.get(endpointId) === capacity) return;
  capacities.set(endpointId, capacity);
  for (const [key, buffer] of buffers) {
    if (key.startsWith(`${endpointId}:`)) buffer.resize(capacity);
  }
}

function bufferFor(endpointId: string, plugin: PluginName): RingBuffer<unknown> {
  const key = sliceKey(endpointId, plugin);
  let buffer = buffers.get(key);
  if (!buffer) {
    buffer = new RingBuffer<unknown>(capacities.get(endpointId) ?? DEFAULT_CAPACITY);
    buffers.set(key, buffer);
  }
  return buffer;
}

export function getBuffer<T>(endpointId: string, plugin: PluginName): RingBuffer<T> | undefined {
  return buffers.get(sliceKey(endpointId, plugin)) as RingBuffer<T> | undefined;
}

/** Append one snapshot's sections. Returns the slice keys that actually received a sample. */
export function pushSnapshot(endpointId: string, ts: number, plugins: SnapshotPlugins): SliceKey[] {
  const touched: SliceKey[] = [];
  for (const [plugin, value] of Object.entries(plugins) as [PluginName, unknown][]) {
    if (value === undefined) continue;
    bufferFor(endpointId, plugin).push({ ts, value });
    touched.push(sliceKey(endpointId, plugin));
  }
  return touched;
}

/**
 * Drop every buffer belonging to one endpoint — called after it is deleted and its widgets have
 * unmounted. Deleting a *widget* evicts nothing: buffers are per-plugin and may still serve
 * another widget on the same host.
 */
export function evictEndpoint(endpointId: string): void {
  capacities.delete(endpointId);
  for (const key of [...buffers.keys()]) {
    if (key.startsWith(`${endpointId}:`)) buffers.delete(key);
  }
}

/** Drop everything. Tests use it; nothing in the app should need it. */
export function resetBuffers(): void {
  buffers.clear();
  capacities.clear();
}

/** Current sample counts per slice — a debug and test affordance. */
export function bufferSizes(): Record<string, number> {
  return Object.fromEntries([...buffers].map(([key, buffer]) => [key, buffer.size]));
}
