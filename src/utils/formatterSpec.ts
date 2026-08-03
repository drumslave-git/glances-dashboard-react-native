/**
 * The formatter *editor's* model. `formatFieldValue` in widgetData.ts consumes
 * formatter strings like "round(2)" or "truncate(10,middle)"; a picker needs
 * those strings taken apart and put back together, which is what this does.
 *
 * Parsing is deliberately forgiving in the same way the formatter itself is:
 * anything unrecognised reads back as "no formatter" rather than throwing.
 */

export type FormatterKind =
  | 'none'
  | 'round'
  | 'bytes'
  | 'kb'
  | 'mb'
  | 'gb'
  | 'shorten'
  | 'truncate';

export type TruncatePosition = 'start' | 'middle' | 'end';

export interface ParsedFormatter {
  kind: FormatterKind;
  /** Decimal places for round(n). */
  decimals: number;
  /** Maximum length for truncate(len, where). */
  length: number;
  position: TruncatePosition;
}

export const DEFAULT_DECIMALS = 2;
export const DEFAULT_LENGTH = 10;

export const MAX_DECIMALS = 20;

export const FORMATTER_OPTIONS: { kind: FormatterKind; label: string }[] = [
  { kind: 'none', label: 'None' },
  { kind: 'round', label: 'Round' },
  { kind: 'bytes', label: 'Bytes' },
  { kind: 'kb', label: 'KB' },
  { kind: 'mb', label: 'MB' },
  { kind: 'gb', label: 'GB' },
  { kind: 'shorten', label: 'Shorten' },
  { kind: 'truncate', label: 'Truncate' },
];

export const TRUNCATE_POSITIONS: TruncatePosition[] = ['start', 'middle', 'end'];

const BASE: ParsedFormatter = {
  kind: 'none',
  decimals: DEFAULT_DECIMALS,
  length: DEFAULT_LENGTH,
  position: 'end',
};

/** Take a stored formatter spec apart into editor state. */
export function parseFormatterSpec(spec?: string | null): ParsedFormatter {
  const lower = spec?.trim().toLowerCase();
  if (!lower) return { ...BASE };

  if (lower.startsWith('round(')) {
    const match = /^round\s*\(\s*(\d+)\s*\)$/.exec(lower);
    if (!match) return { ...BASE };
    return {
      ...BASE,
      kind: 'round',
      decimals: Math.min(MAX_DECIMALS, Number.parseInt(match[1], 10)),
    };
  }

  if (lower === 'bytes' || lower === 'kb' || lower === 'mb' || lower === 'gb') {
    return { ...BASE, kind: lower };
  }

  if (lower === 'shorten') return { ...BASE, kind: 'shorten' };

  if (lower.startsWith('truncate(')) {
    const match = /^truncate\s*\(\s*(\d+)\s*,\s*(start|middle|end)\s*\)$/.exec(lower);
    if (!match) return { ...BASE };
    return {
      ...BASE,
      kind: 'truncate',
      length: Math.max(1, Number.parseInt(match[1], 10)),
      position: match[2] as TruncatePosition,
    };
  }

  return { ...BASE };
}

/** Put editor state back together. `null` means "store no formatter for this field". */
export function buildFormatterSpec(parsed: ParsedFormatter): string | null {
  switch (parsed.kind) {
    case 'round':
      return `round(${Math.min(MAX_DECIMALS, Math.max(0, parsed.decimals))})`;
    case 'bytes':
    case 'kb':
    case 'mb':
    case 'gb':
    case 'shorten':
      return parsed.kind;
    case 'truncate':
      return `truncate(${Math.max(1, parsed.length)},${parsed.position})`;
    default:
      return null;
  }
}

/** One-line summary of a field's formatter, for the collapsed editor row. */
export function describeFormatter(spec?: string | null): string {
  const parsed = parseFormatterSpec(spec);
  const option = FORMATTER_OPTIONS.find((entry) => entry.kind === parsed.kind);
  if (parsed.kind === 'none') return 'None';
  if (parsed.kind === 'round') return `Round ${parsed.decimals}`;
  if (parsed.kind === 'truncate') return `Truncate ${parsed.length} ${parsed.position}`;
  return option?.label ?? 'None';
}

/** Set or clear one field's formatter, returning a new map. */
export function setFieldFormatter(
  formatters: Record<string, string>,
  field: string,
  spec: string | null,
): Record<string, string> {
  if (spec === null) {
    const { [field]: _removed, ...rest } = formatters;
    return rest;
  }
  return { ...formatters, [field]: spec };
}

/** Drop entries for fields that are no longer selected. */
export function pickFormatters(
  formatters: Record<string, string>,
  fields: string[],
): Record<string, string> {
  return Object.fromEntries(
    fields.filter((field) => field in formatters).map((field) => [field, formatters[field]]),
  );
}
