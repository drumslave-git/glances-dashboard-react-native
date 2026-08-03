import { getFieldColor } from './chartColors';

/**
 * Ported verbatim from the reference web app (src/utils/widgetData.ts). Behaviour
 * here is the contract the widgets are built against — change it only deliberately.
 */

/** Extract the first record from a Glances payload (array → first element, object → as-is). */
export function getRecordFromPayload(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    const first = data[0] as Record<string, unknown> | undefined;
    return first ?? null;
  }
  if (data !== null && typeof data === 'object') {
    return data as Record<string, unknown>;
  }
  return null;
}

const TITLE_TOKEN_REGEX = /\{\{([^}]+)\}\}/g;

/** Parse token content into field name and optional formatter (e.g. "mem:round(2)"). */
function parseTokenSpec(spec: string): { field: string; formatter: string | null } {
  const trimmed = spec.trim();
  const colon = trimmed.indexOf(':');
  if (colon === -1) return { field: trimmed, formatter: null };
  return {
    field: trimmed.slice(0, colon).trim(),
    formatter: trimmed.slice(colon + 1).trim() || null,
  };
}

/**
 * Format a value using a formatter spec.
 * Formatters: round(n), bytes, kb, mb, gb, shorten, truncate(maxLen,start|middle|end)
 */
export function formatFieldValue(value: unknown, formatterSpec: string): string {
  const spec = formatterSpec.trim().toLowerCase();
  const num =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN;

  if (spec.startsWith('round(')) {
    const match = /round\s*\(\s*(\d+)\s*\)/.exec(spec);
    const decimals = match ? Math.min(20, Math.max(0, parseInt(match[1], 10))) : 0;
    if (Number.isNaN(num)) return String(value);
    return num.toFixed(decimals);
  }

  if (spec === 'bytes' || spec === 'kb' || spec === 'mb' || spec === 'gb') {
    if (Number.isNaN(num)) return String(value);
    const bytes = num;
    if (spec === 'bytes') {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    if (spec === 'kb') return `${(bytes / 1024).toFixed(2)} KB`;
    if (spec === 'mb') return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (spec === 'gb') return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  if (spec === 'shorten') {
    if (Number.isNaN(num)) return String(value);
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    // Deliberate fix vs the reference app, which divided the signed value while
    // also prefixing the sign and so rendered "-1500" as "--1.5k".
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
    if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
    return String(num);
  }

  if (spec.startsWith('truncate(')) {
    const match = /truncate\s*\(\s*(\d+)\s*,\s*(start|middle|end)\s*\)/.exec(spec);
    const maxLen = match ? Math.max(1, parseInt(match[1], 10)) : 10;
    const where = (match && (match[2] === 'start' || match[2] === 'middle' || match[2] === 'end') ? match[2] : 'end') as 'start' | 'middle' | 'end';
    const str = value === null || value === undefined ? '' : String(value);
    if (str.length <= maxLen) return str;
    const ellipsis = '…';
    if (where === 'start') return ellipsis + str.slice(-(maxLen - 1));
    if (where === 'end') return str.slice(0, maxLen - 1) + ellipsis;
    const keep = maxLen - 1;
    const half = Math.floor(keep / 2);
    return str.slice(0, half) + ellipsis + str.slice(-(keep - half));
  }

  return String(value);
}

/**
 * Replace {{fieldName}} and {{fieldName:formatter}} tokens with values from the
 * current metric data. Unknown fields are left as-is so the user can see the typo.
 * Example: "VRAM {{mem:round(2)}}%" with data { mem: 3.34 } → "VRAM 3.34%"
 */
export function resolveTitleTokens(title: string, data: unknown): string {
  const record = getRecordFromPayload(data);
  if (!record) return title;
  return title.replace(TITLE_TOKEN_REGEX, (_, spec: string) => {
    const { field, formatter } = parseTokenSpec(spec);
    const value = record[field];
    if (value === undefined) return `{{${spec}}}`;
    if (formatter) return formatFieldValue(value, formatter);
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  });
}

/** Build the text body for a text widget from payload + selected fields. */
export function getTextBody(
  data: unknown,
  fields: string[],
  fieldFormatters?: Record<string, string> | null,
): string {
  const record = getRecordFromPayload(data);
  if (record && fields.length > 0) {
    const lines: string[] = [];
    for (const field of fields) {
      const value = record[field];
      if (value === undefined) {
        lines.push(`${field} = (not found)`);
      } else if (typeof value === 'object') {
        lines.push(`${field} = ${JSON.stringify(value, null, 2)}`);
      } else {
        const fmt = fieldFormatters?.[field]?.trim();
        const display = fmt ? formatFieldValue(value, fmt) : String(value);
        lines.push(`${field} = ${display}`);
      }
    }
    return lines.join('\n');
  }
  return JSON.stringify(data, null, 2);
}

/**
 * How an unformatted number is printed in the Telemetry UI.
 *
 * **A deliberate deviation from the reference app**, which used `String(value)`
 * throughout. Glances serves full float precision, so that rendered
 * `85.40915631665675` in a table cell and beside a 5pt meter — unreadable at any
 * size, and impossible to line up in a tabular column. Integers are left exactly
 * as they are, and an explicit field formatter always wins over this.
 */
export function formatLooseNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  // A *cap* on decimals, not a pad: `12.5` stays `12.5` rather than becoming
  // `12.50`. Tabular figures already line the columns up without the padding.
  return String(Number(value.toFixed(Math.abs(value) >= 100 ? 1 : 2)));
}

export interface ChartSegment {
  name: string;
  value: number;
  color: string;
  /** When set, used as the segment label (e.g. formatted value) instead of name. */
  displayLabel?: string;
}

/** Build chart segments from payload + fields + fieldColors. */
export function getChartData(
  data: unknown,
  fields: string[],
  fieldColors?: Record<string, string> | null,
  splitPercentageIntoUsedFree?: boolean,
  fieldFormatters?: Record<string, string> | null,
): ChartSegment[] {
  const record = getRecordFromPayload(data);
  if (!record) return [];

  const keys = fields.length > 0 ? fields : Object.keys(record);
  const segments = keys
    .map((field) => {
      const value = record[field];
      const num =
        typeof value === 'number'
          ? value
          : typeof value === 'string'
            ? Number.parseFloat(value)
            : Number.NaN;
      if (Number.isNaN(num)) return null;
      const fmt = fieldFormatters?.[field]?.trim();
      const displayLabel = fmt ? formatFieldValue(value, fmt) : undefined;
      return {
        name: field,
        value: num,
        color: getFieldColor(field, fieldColors),
        ...(displayLabel !== undefined && { displayLabel }),
      };
    })
    .filter((item): item is ChartSegment => item !== null);

  if (
    splitPercentageIntoUsedFree &&
    segments.length === 1 &&
    segments[0].value >= 0 &&
    segments[0].value <= 100
  ) {
    const used = segments[0];
    const freeValue = 100 - used.value;
    const usedFmt = fieldFormatters?.[used.name]?.trim();
    return [
      {
        name: 'Used',
        value: used.value,
        color: used.color,
        displayLabel: usedFmt ? formatFieldValue(used.value, usedFmt) : undefined,
      },
      { name: 'Free', value: freeValue, color: getFieldColor('free', fieldColors) },
    ];
  }

  return segments;
}
