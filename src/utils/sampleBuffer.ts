/**
 * The ring buffer behind every line chart, sparkline and peak/avg readout.
 *
 * Glances serves instantaneous values; the design draws *history*. Per the
 * handoff the history is memory-only and resets on restart, which matches the
 * reference app — so this is deliberately a plain array per series with a cap,
 * not something persisted.
 */

export interface Sample {
  /** Epoch milliseconds. */
  t: number;
  v: number;
}

/** Selectable chart windows, in milliseconds. */
export const TIME_WINDOWS = {
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
} as const;

export type TimeWindow = keyof typeof TIME_WINDOWS;

export const TIME_WINDOW_ORDER: readonly TimeWindow[] = ['5m', '15m', '1h'];

export function isTimeWindow(value: unknown): value is TimeWindow {
  return typeof value === 'string' && value in TIME_WINDOWS;
}

export function nextTimeWindow(window: TimeWindow): TimeWindow {
  const index = TIME_WINDOW_ORDER.indexOf(window);
  return TIME_WINDOW_ORDER[(index + 1) % TIME_WINDOW_ORDER.length];
}

/**
 * An hour at the fastest cadence anyone sensibly polls at. Past this the buffer
 * drops its oldest sample rather than growing without bound.
 */
export const DEFAULT_CAPACITY = 900;

/**
 * Append a sample, dropping the oldest once the cap is reached.
 *
 * Samples that are not newer than the last one are **ignored**, which is what
 * makes it safe for several widgets bound to the same server and endpoint to all
 * report the same poll: they pass the query's `dataUpdatedAt`, so the second and
 * third callers are no-ops rather than duplicate points.
 *
 * Returns the same array reference when nothing changed, so a store built on
 * this does not wake up subscribers for a repeat.
 */
export function pushSample(
  buffer: readonly Sample[] | undefined,
  sample: Sample,
  capacity = DEFAULT_CAPACITY,
): Sample[] {
  const current = buffer ?? [];
  if (!Number.isFinite(sample.v) || !Number.isFinite(sample.t)) return current as Sample[];

  const last = current[current.length - 1];
  if (last && sample.t <= last.t) return current as Sample[];

  const next = [...current, sample];
  return next.length > capacity ? next.slice(next.length - capacity) : next;
}

/**
 * The tail of a buffer inside a time window, measured back from the newest
 * sample rather than from the wall clock.
 *
 * This is both purer — no `Date.now()` during render — and more honest: if
 * polling stalled two minutes ago, a 5-minute window should still show the last
 * five minutes of *data*, not three minutes of data and a two-minute gap.
 */
export function recentSamples(
  buffer: readonly Sample[] | undefined,
  windowMs: number,
): Sample[] {
  if (!buffer || buffer.length === 0) return [];
  return samplesWithin(buffer, windowMs, buffer[buffer.length - 1].t);
}

/** The tail of a buffer inside a time window ending at `now`. */
export function samplesWithin(
  buffer: readonly Sample[] | undefined,
  windowMs: number,
  now: number,
): Sample[] {
  if (!buffer || buffer.length === 0) return [];
  const cutoff = now - windowMs;
  // Buffers are append-only and ordered, so the window is always a suffix.
  const start = buffer.findIndex((sample) => sample.t >= cutoff);
  return start === -1 ? [] : buffer.slice(start);
}

export interface SeriesStats {
  peak: number;
  min: number;
  avg: number;
  latest: number;
  /** Latest minus the window average — the CPU widget's footer readout. */
  deltaFromAvg: number;
  count: number;
}

export function seriesStats(samples: readonly Sample[]): SeriesStats | null {
  if (samples.length === 0) return null;

  let peak = samples[0].v;
  let min = samples[0].v;
  let total = 0;
  for (const sample of samples) {
    if (sample.v > peak) peak = sample.v;
    if (sample.v < min) min = sample.v;
    total += sample.v;
  }
  const avg = total / samples.length;
  const latest = samples[samples.length - 1].v;

  return { peak, min, avg, latest, deltaFromAvg: latest - avg, count: samples.length };
}

/**
 * Y domain for a series. Percentages get a fixed 0–100 so the line does not
 * rescale under its own gridlines every poll; everything else follows the data
 * with a little headroom.
 */
export function seriesDomain(
  samples: readonly Sample[],
  { percentage = false }: { percentage?: boolean } = {},
): [number, number] {
  if (percentage) return [0, 100];
  if (samples.length === 0) return [0, 1];

  let max = samples[0].v;
  for (const sample of samples) if (sample.v > max) max = sample.v;
  if (max <= 0) return [0, 1];
  return [0, max * 1.1];
}

/**
 * Evenly spaced tick labels across a window — the handoff's five time labels
 * under the chart. Fewer samples than ticks yields fewer labels rather than
 * repeating one.
 */
export function timeAxisTicks(samples: readonly Sample[], count = 5): Sample[] {
  if (samples.length === 0) return [];
  if (samples.length <= count) return [...samples];

  const ticks: Sample[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.round((i * (samples.length - 1)) / (count - 1));
    ticks.push(samples[index]);
  }
  return ticks;
}

/** `14:26` — the axis label format in the design. */
export function formatClock(epochMs: number): string {
  const date = new Date(epochMs);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
