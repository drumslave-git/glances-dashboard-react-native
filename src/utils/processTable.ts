import { formatFieldValue } from './widgetData';

/**
 * Process table shaping, ported from the reference app's `ProcessesTable.tsx`.
 * Pure so the widget itself is only layout.
 */

/** Columns shown when a process widget has no fields configured. */
export const DEFAULT_PROCESS_FIELDS = [
  'name',
  'cpu_percent',
  'memory_percent',
  'username',
] as const;

/** The reference app caps the table at 50 rows; long process lists are unusable otherwise. */
export const MAX_PROCESS_ROWS = 50;

const HEADER_LABELS: Record<string, string> = {
  name: 'Name',
  cmdline: 'Command',
  cpu_percent: 'CPU %',
  memory_percent: 'Mem %',
  username: 'User',
  pid: 'PID',
};

/** Friendly column heading; unknown fields keep their raw key. */
export function getProcessHeaderLabel(field: string): string {
  return HEADER_LABELS[field] ?? field;
}

const COLUMN_WIDTHS: Record<string, number> = {
  name: 140,
  cmdline: 260,
  username: 90,
  pid: 72,
  cpu_percent: 72,
  memory_percent: 72,
  status: 64,
  nice: 56,
  num_threads: 72,
};

/**
 * Header and cells are separate rows, so every column needs a fixed width to
 * line up. Values are chosen for the widest realistic content per field.
 */
export function processColumnWidth(field: string): number {
  return COLUMN_WIDTHS[field] ?? 110;
}

/**
 * Render one cell. Process payloads are not flat — `cmdline` is an array and
 * `memory_info` is a nested object — where the reference app's `String(value)`
 * produced "a,b" and "[object Object]". Joining and JSON-encoding instead keeps
 * both readable, and a `truncate(...)` formatter can then cut them to size.
 */
export function formatProcessCell(value: unknown, formatter?: string): string {
  if (value === undefined || value === null) return '';

  let target: unknown = value;
  if (Array.isArray(value)) {
    target = value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join(' ');
  } else if (typeof value === 'object') {
    target = JSON.stringify(value);
  }

  const spec = formatter?.trim();
  if (spec) return formatFieldValue(target, spec);
  return String(target);
}

export interface ProcessRow {
  /** Stable list key: the pid when there is one, otherwise the row index. */
  key: string;
  cells: string[];
}

export interface ProcessTable {
  columns: string[];
  rows: ProcessRow[];
}

/** Build the columns and rows for a process widget from a `/api/4/processlist` payload. */
export function buildProcessTable(
  data: unknown,
  fields?: string[],
  fieldFormatters?: Record<string, string> | null,
): ProcessTable {
  const columns = fields && fields.length > 0 ? fields : [...DEFAULT_PROCESS_FIELDS];
  if (!Array.isArray(data)) return { columns, rows: [] };

  const rows = data.slice(0, MAX_PROCESS_ROWS).map((entry, index) => {
    const record = (entry ?? {}) as Record<string, unknown>;
    return {
      key: record.pid === undefined || record.pid === null ? String(index) : String(record.pid),
      cells: columns.map((field) => formatProcessCell(record[field], fieldFormatters?.[field])),
    };
  });

  return { columns, rows };
}
