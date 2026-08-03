import { formatFieldValue, formatLooseNumber, getRecordFromPayload } from './widgetData';

/**
 * Turning a Glances payload into the shapes the Telemetry widgets draw: heroes,
 * meters and key/value rows.
 *
 * The redesign is specified against fixed widget types — CPU, MEMORY, GPU — but
 * this app builds widgets over *any* plugin and *any* fields. Rather than lose
 * that, the archetypes are reached by inference: a field that reads like a
 * percentage gets a meter, a lone numeric field becomes the hero, and everything
 * else is a key/value row. Pure, so the inference is testable against the real
 * captured payloads instead of by eye.
 */

export interface FieldReading {
  name: string;
  /** Humanised for display: `memory_percent` → `Memory percent`. */
  label: string;
  /** The numeric value, or null when the field is not a number. */
  value: number | null;
  /** Formatted for display, honouring the field's formatter. */
  text: string;
  /** 0–100 when this field reads as a percentage, else null. */
  percent: number | null;
  /** The unit to hang off a hero numeral, e.g. `%`. */
  unit: string | null;
}

// Field names that mean "a percentage" across the Glances plugins this app
// sees. `proc` and `fan` are the gpu plugin's utilisation and fan-speed keys.
const PERCENT_HINTS = ['percent', 'usage', 'util', 'load', 'proc', 'fan'];

/**
 * Whether a field should be drawn as a meter.
 *
 * Name *and* range both have to agree. `cpu.total` is a percentage; `mem.total`
 * is 132 GB and would otherwise be drawn as a full bar the moment it happened to
 * fall under 100.
 */
export function looksLikePercent(name: string, value: number | null): boolean {
  if (value == null || !Number.isFinite(value) || value < 0 || value > 100) return false;
  const lower = name.toLowerCase();
  if (PERCENT_HINTS.some((hint) => lower.includes(hint))) return true;
  // `cpu` reports its busy fraction as `total`, `user`, `system`, `idle` — all
  // percentages, none of them named like one.
  return ['total', 'user', 'system', 'idle', 'iowait', 'steal', 'nice'].includes(lower);
}

/** `memory_percent` → `Memory percent`. Unknown shapes are left alone. */
export function humaniseField(name: string): string {
  const spaced = name.replace(/[_-]+/g, ' ').trim();
  if (spaced === '') return name;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function displayText(value: unknown, formatter?: string): string {
  if (value === undefined) return '(not found)';
  if (value === null) return '—';
  const spec = formatter?.trim();
  if (spec) return formatFieldValue(value, spec);
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'number') return formatLooseNumber(value);
  return String(value);
}

/**
 * Read the selected fields out of a payload. With no fields selected, every
 * top-level key is read — which is what the reference app's text widget did.
 */
export function readFields(
  data: unknown,
  fields: string[],
  fieldFormatters?: Record<string, string> | null,
): FieldReading[] {
  const record = getRecordFromPayload(data);
  if (!record) return [];

  const keys = fields.length > 0 ? fields : Object.keys(record);
  return keys.map((name) => {
    const raw = record[name];
    const value = toNumber(raw);
    const percent = looksLikePercent(name, value) ? value : null;
    const formatter = fieldFormatters?.[name];
    return {
      name,
      label: humaniseField(name),
      value,
      // A percentage with no formatter is rounded to one decimal. Glances serves
      // full float precision, and `36.442326476857346%` beside a 5pt meter is
      // not a readout — it is noise. An explicit formatter always wins.
      text:
        percent != null && !formatter?.trim()
          ? formatFieldValue(percent, 'round(1)')
          : displayText(raw, formatter),
      percent,
      // A formatted value already carries its own unit ("12.4 GB"); only a bare
      // percentage needs one appended.
      unit: percent != null && !formatter?.trim() ? '%' : null,
    };
  });
}

/**
 * The field a hero numeral should show, if any: exactly one numeric field means
 * the widget is about that number, and the design puts it at hero size.
 */
export function heroReading(readings: FieldReading[]): FieldReading | null {
  const numeric = readings.filter((reading) => reading.value != null);
  return numeric.length === 1 ? numeric[0] : null;
}

/** The first reading that can drive a ring gauge. */
export function gaugeReading(readings: FieldReading[]): FieldReading | null {
  return (
    readings.find((reading) => reading.percent != null) ??
    readings.find((reading) => reading.value != null) ??
    null
  );
}

/**
 * The CPU widget's footer: `+2.1 pt vs window avg`. "pt" rather than "%" is
 * deliberate — the difference between two percentages is percentage *points*,
 * and calling it a percentage would be wrong by a factor of the base.
 */
export function formatDeltaFromAvg(delta: number, percentage: boolean): string {
  if (!Number.isFinite(delta)) return '';
  const sign = delta >= 0 ? '+' : '−';
  const magnitude = Math.abs(delta);
  const rounded = magnitude >= 10 ? magnitude.toFixed(0) : magnitude.toFixed(1);
  return `${sign}${rounded} ${percentage ? 'pt' : ''} vs window avg`.replace('  ', ' ');
}

/** `peak 71.2%` style stat blocks beside or under a hero. */
export function formatStat(value: number, unit: string | null): string {
  const rounded = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);
  return unit ? `${rounded}${unit}` : rounded;
}
