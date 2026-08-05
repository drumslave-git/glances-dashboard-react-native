/**
 * Throughput formatting and the "which few" rule the io widgets share.
 *
 * Pure, and tested, because both halves are easy to get subtly wrong: a rate is not a total, and a
 * host with forty bind mounts or a dozen docker interfaces will bury the two rows anyone wanted.
 */

/** Bytes per second, or bits per second when the user asked for bits. */
export type RateUnit = 'bytes' | 'bits';

const BYTE_STEPS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
const BIT_STEPS = ['b', 'Kb', 'Mb', 'Gb', 'Tb', 'Pb'];

function scale(value: number, steps: string[]): string {
  let n = Math.abs(value);
  let i = 0;
  while (n >= 1024 && i < steps.length - 1) {
    n /= 1024;
    i += 1;
  }
  const sign = value < 0 ? '-' : '';
  // Two decimals below 10, one below 100, none above — the same "cap, don't pad" rule
  // `formatLooseNumber` follows, so a rate never jitters its own width by more than a digit.
  const decimals = n < 10 ? 2 : n < 100 ? 1 : 0;
  return `${sign}${n.toFixed(decimals)} ${steps[i]}`;
}

/**
 * A rate, per second.
 *
 * `null` — which is what the normalizer reports on the server's first refresh, before any rate
 * fields exist — renders as a dash rather than as zero. "No reading yet" and "no traffic" are
 * different, and on a network chart the difference is a spike.
 */
export function formatRate(bytesPerSec: number | null | undefined, unit: RateUnit = 'bytes'): string {
  if (bytesPerSec == null || !Number.isFinite(bytesPerSec)) return '—';
  return unit === 'bits'
    ? `${scale(bytesPerSec * 8, BIT_STEPS)}/s`
    : `${scale(bytesPerSec, BYTE_STEPS)}/s`;
}

/** A lifetime total — the `_gauge` counter. Never a rate, so it carries no `/s`. */
export function formatTotal(bytes: number | null | undefined, unit: RateUnit = 'bytes'): string {
  if (bytes == null || !Number.isFinite(bytes)) return '—';
  return unit === 'bits' ? scale(bytes * 8, BIT_STEPS) : scale(bytes, BYTE_STEPS);
}

/**
 * A span of seconds as `H:MM:SS` — process CPU time and how long an event has been running.
 *
 * Deliberately **not** wrapped to a clock and deliberately not the uptime formatter's `2d 3h`: a
 * process that has burned 26 hours of CPU has burned 26 hours, and rendering that as `2:00:00`
 * would be a different number. Hours simply keep counting (ref §7.4).
 */
export function formatElapsed(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const whole = Math.floor(seconds);
  const minutes = Math.floor((whole % 3600) / 60);
  return `${Math.floor(whole / 3600)}:${String(minutes).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

/** `1.9%`, or a dash. The percent sign belongs to the value here — these sit in unlabelled cells. */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

/**
 * Which items a widget shows when its config names none.
 *
 * "The busiest few", by the combined rate — the reference's own fallback. A selection always wins
 * outright: an explicit choice that currently reads zero must stay on screen, or the widget would
 * silently swap out the interface someone is watching the moment it went quiet.
 *
 * Ordering is by activity and then by name, so two idle interfaces do not trade places on every
 * poll just because both read zero.
 */
export function pickBusiest<T>(
  items: readonly T[],
  selected: readonly string[],
  nameOf: (item: T) => string,
  activityOf: (item: T) => number,
  limit: number,
): T[] {
  if (selected.length > 0) {
    const wanted = new Set(selected);
    return items.filter((item) => wanted.has(nameOf(item)));
  }
  return [...items]
    .sort((a, b) => activityOf(b) - activityOf(a) || nameOf(a).localeCompare(nameOf(b)))
    .slice(0, Math.max(1, limit));
}

/**
 * Mounts a containerised host reports that nobody asked about.
 *
 * A Glances in a container sees the host filesystem through bind mounts and reports the *same*
 * device a dozen times over. Showing every one of them buries the real disks, so duplicates of a
 * device are collapsed to their shortest path — the closest thing to the real mount point — unless
 * the user asked for all of them.
 */
export function dedupeMounts<T>(
  items: readonly T[],
  deviceOf: (item: T) => string | null,
  pathOf: (item: T) => string,
  showEvery: boolean,
): T[] {
  if (showEvery) return [...items];
  const byDevice = new Map<string, T>();
  const out: T[] = [];
  for (const item of items) {
    const device = deviceOf(item);
    if (!device) {
      out.push(item);
      continue;
    }
    const existing = byDevice.get(device);
    if (!existing || pathOf(item).length < pathOf(existing).length) byDevice.set(device, item);
  }
  return [...out, ...byDevice.values()];
}

/**
 * A mount path shortened from the **left**.
 *
 * Mount paths differ at the end and agree at the start, so head-truncation — which is what a label
 * that runs out of room does by default — turns `/host_mnt/disks/disk14TB` and
 * `/host_mnt/disks/disk1TB_1` into two rows that both read `/host_mnt/dis…`. Keeping the tail keeps
 * the part that identifies the row; the leading `…` says something was dropped.
 */
export function shortenMountPath(path: string, maxLength = 22): string {
  if (path.length <= maxLength) return path;
  const segments = path.split('/').filter(Boolean);
  for (let take = 2; take <= segments.length; take += 1) {
    const candidate = `…/${segments.slice(-take).join('/')}`;
    if (candidate.length > maxLength) {
      // One fewer segment than the one that overflowed, but never fewer than the last.
      return `…/${segments.slice(-Math.max(1, take - 1)).join('/')}`;
    }
  }
  return path;
}
