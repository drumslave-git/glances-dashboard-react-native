import { getRecordFromPayload } from './widgetData';

/**
 * The six summary-strip cells, derived from live Glances payloads.
 *
 * Pure so the formatting is testable without a server: every function here takes
 * `unknown` because that is genuinely what comes back — a plugin the server does
 * not run returns nothing, and one behind a proxy can return an error body.
 * A cell with no data shows an em dash rather than disappearing, so the strip
 * does not reflow every time a plugin blinks.
 */

export const NO_VALUE = '—';

export interface SummaryCell {
  key: string;
  label: string;
  value: string;
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** `31d 12h`, `12h 04m`, `4m`. */
export function formatUptime(payload: unknown): string {
  // Glances has served both `{ seconds }` and a rendered string here depending on
  // version and proxy, so accept either rather than guessing.
  const asString = typeof payload === 'string' ? payload : null;
  const record = getRecordFromPayload(payload);
  const seconds = num(record?.seconds);

  if (seconds == null) {
    if (!asString) return NO_VALUE;
    // "31 days, 12:34:56" → "31d 12h"
    const match = /^(?:(\d+)\s+days?,\s*)?(\d+):(\d+):(\d+)/.exec(asString.trim());
    if (!match) return asString;
    const [, days, hours, minutes] = match;
    return formatDuration(
      (Number(days ?? 0) * 86400) + (Number(hours) * 3600) + (Number(minutes) * 60),
    );
  }

  return formatDuration(seconds);
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return NO_VALUE;
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}m`;
}

/** `1.92 / 1.44 / 1.10` — the three load averages, two decimals, tabular. */
export function formatLoad(payload: unknown): string {
  const record = getRecordFromPayload(payload);
  if (!record) return NO_VALUE;
  const values = [record.min1, record.min5, record.min15].map(num);
  if (values.some((value) => value == null)) return NO_VALUE;
  return values.map((value) => (value as number).toFixed(2)).join(' / ');
}

/** `412 · 3 run`. */
export function formatProcessCount(payload: unknown): string {
  const record = getRecordFromPayload(payload);
  if (!record) return NO_VALUE;
  const total = num(record.total);
  if (total == null) return NO_VALUE;
  const running = num(record.running);
  return running == null ? String(total) : `${total} · ${running} run`;
}

/**
 * `1.2 / 3.6 TB` — used over total across every mounted filesystem, in one unit.
 *
 * Summing every entry is deliberate: on a containerised Glances the *first* `fs`
 * entry is a bind mount rather than a real disk, so "the first element" — which
 * is what the widget logic does elsewhere — would report something meaningless
 * here.
 */
export function formatDisk(payload: unknown): string {
  if (!Array.isArray(payload)) return NO_VALUE;

  let used = 0;
  let size = 0;
  const seen = new Set<string>();
  for (const entry of payload) {
    const record = getRecordFromPayload(entry);
    if (!record) continue;
    const device = str(record.device_name) ?? str(record.mnt_point);
    // Bind mounts repeat a device; counting it twice would double the total.
    if (device != null && seen.has(device)) continue;
    if (device != null) seen.add(device);

    const entryUsed = num(record.used);
    const entrySize = num(record.size);
    if (entryUsed == null || entrySize == null) continue;
    used += entryUsed;
    size += entrySize;
  }

  if (size <= 0) return NO_VALUE;
  const unit = pickByteUnit(size);
  return `${(used / unit.divisor).toFixed(1)} / ${(size / unit.divisor).toFixed(1)} ${unit.suffix}`;
}

const BYTE_UNITS = [
  { suffix: 'TB', divisor: 1024 ** 4 },
  { suffix: 'GB', divisor: 1024 ** 3 },
  { suffix: 'MB', divisor: 1024 ** 2 },
  { suffix: 'KB', divisor: 1024 },
  { suffix: 'B', divisor: 1 },
];

export function pickByteUnit(bytes: number): { suffix: string; divisor: number } {
  for (const unit of BYTE_UNITS) {
    if (bytes >= unit.divisor) return unit;
  }
  return BYTE_UNITS[BYTE_UNITS.length - 1];
}

/** `8.39 / 123 GB` style pairs, both sides in the larger value's unit. */
export function formatBytesPair(used: number | null, total: number | null): string {
  if (used == null || total == null || total <= 0) return NO_VALUE;
  const unit = pickByteUnit(total);
  const usedText = (used / unit.divisor).toFixed(used / unit.divisor < 10 ? 2 : 1);
  const totalText = (total / unit.divisor).toFixed(0);
  return `${usedText} / ${totalText} ${unit.suffix}`;
}

export interface SummarySources {
  system?: unknown;
  uptime?: unknown;
  load?: unknown;
  processCount?: unknown;
  fs?: unknown;
}

/** The strip, in the handoff's order. */
export function buildSummaryCells(sources: SummarySources): SummaryCell[] {
  const system = getRecordFromPayload(sources.system);

  return [
    { key: 'host', label: 'Host', value: str(system?.hostname) ?? NO_VALUE },
    { key: 'uptime', label: 'Uptime', value: formatUptime(sources.uptime) },
    { key: 'kernel', label: 'Kernel', value: str(system?.os_version) ?? NO_VALUE },
    { key: 'load', label: 'Load avg', value: formatLoad(sources.load) },
    { key: 'processes', label: 'Processes', value: formatProcessCount(sources.processCount) },
    { key: 'disk', label: 'Disk', value: formatDisk(sources.fs) },
  ];
}
