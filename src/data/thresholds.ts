/**
 * Glances threshold levels (ref §7.5).
 *
 * Limits arrive on the endpoint status as a flat `<plugin>_<stat>_<level>` map — `cpu_total_warning:
 * 75`, `mem_critical: 90` — flattened by `probe.ts` from `/api/4/all/limits`. They are the
 * *server's* opinion, read from its own `glances.conf`, which is why nothing here invents a
 * threshold: a host with no published limit for a stat is not a host at 0%.
 *
 * This module classifies only. Binding a level to a colour belongs with the components that paint
 * one, because the answer differs by surface (a meter fill, a chip, a chart line) and by theme.
 */

export type ThresholdLevel = 'ok' | 'careful' | 'warning' | 'critical';

/**
 * The design's name for what a level should be drawn in.
 *
 * `ok` is **`accent`, not a green**. On this palette the accent *is* the healthy colour, and
 * spending green on "fine" would leave two colours saying the same thing while the accent said
 * nothing — green then stays free for the one place it carries its own meaning, upload against a
 * cyan download.
 */
export type ThresholdTone = 'accent' | 'info' | 'warning' | 'error';

type Limits = Record<string, number> | undefined;

/**
 * Classify a value against `<key>_careful|warning|critical`.
 *
 * Falls back to `ok` when the server published no limits for this stat, and when the value is
 * absent — a metric a vendor does not report is not a metric in trouble.
 */
export function thresholdLevel(limits: Limits, key: string, value: number | null | undefined): ThresholdLevel {
  if (value === null || value === undefined || !Number.isFinite(value) || !limits) return 'ok';

  const critical = limits[`${key}_critical`];
  const warning = limits[`${key}_warning`];
  const careful = limits[`${key}_careful`];

  if (critical !== undefined && value >= critical) return 'critical';
  if (warning !== undefined && value >= warning) return 'warning';
  if (careful !== undefined && value >= careful) return 'careful';
  return 'ok';
}

export function thresholdTone(level: ThresholdLevel): ThresholdTone {
  switch (level) {
    case 'critical':
      return 'error';
    case 'warning':
      return 'warning';
    case 'careful':
      return 'info';
    default:
      return 'accent';
  }
}

/**
 * A per-item threshold, which the sensors plugin carries on each reading rather than in the
 * endpoint's limits map — a fan and a CPU core do not share a scale, so a global key could not
 * describe either.
 */
export function sensorThresholdLevel(
  value: number | null | undefined,
  warning: number | undefined,
  critical: number | undefined,
): ThresholdLevel {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'ok';
  if (critical !== undefined && value >= critical) return 'critical';
  if (warning !== undefined && value >= warning) return 'warning';
  return 'ok';
}
