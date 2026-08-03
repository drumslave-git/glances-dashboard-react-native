import { formatFieldValue, formatLooseNumber } from './widgetData';

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
  // Numbers get the shared loose format rather than `String(value)`: a CPU
  // column of 16-digit floats does not line up and cannot be read.
  if (typeof target === 'number') return formatLooseNumber(target);
  return String(target);
}

/**
 * Column drop priority for the Telemetry table. The handoff's rule is that the
 * table **never scrolls horizontally**: when the card is too narrow, columns
 * leave in priority order and the remaining ones still line up.
 *
 * Priority 1 columns survive at any width — a row with no command and no CPU
 * figure is not a process table.
 */
const COLUMN_PRIORITIES: Record<string, number> = {
  pid: 1,
  name: 1,
  cmdline: 1,
  cpu_percent: 1,
  memory_percent: 2,
  memory_info: 2,
  username: 3,
  num_threads: 4,
  status: 4,
  nice: 4,
};

export function processColumnPriority(field: string): number {
  return COLUMN_PRIORITIES[field] ?? 3;
}

/** Which column a process table sorts by when nothing was chosen. */
export const DEFAULT_PROCESS_SORT = 'cpu_percent';

function sortValue(record: Record<string, unknown>, key: string): number | string {
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? value.toLowerCase() : parsed;
  }
  return Number.NEGATIVE_INFINITY;
}

/**
 * Sort descending — biggest consumer first, which is the only ordering a process
 * table is ever read in. Numbers sort numerically, text alphabetically, and text
 * always sorts after numbers so a missing value sinks rather than floats.
 */
export function sortProcesses(
  records: Record<string, unknown>[],
  sortKey: string,
): Record<string, unknown>[] {
  return [...records].sort((a, b) => {
    const left = sortValue(a, sortKey);
    const right = sortValue(b, sortKey);
    if (typeof left === 'number' && typeof right === 'number') return right - left;
    if (typeof left === 'number') return -1;
    if (typeof right === 'number') return 1;
    return String(left).localeCompare(String(right));
  });
}

export interface ProcessRow {
  /** Stable list key: the pid when there is one, otherwise the row index. */
  key: string;
  cells: string[];
  /** The raw pid, for the per-process trend sparkline's history key. */
  pid: string | null;
  /** 0–100, for the inline CPU bar. Null when the payload has no CPU figure. */
  cpuPercent: number | null;
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
  sortKey: string = DEFAULT_PROCESS_SORT,
): ProcessTable {
  const columns = fields && fields.length > 0 ? fields : [...DEFAULT_PROCESS_FIELDS];
  if (!Array.isArray(data)) return { columns, rows: [] };

  const records = data.map((entry) => (entry ?? {}) as Record<string, unknown>);
  const rows = sortProcesses(records, sortKey)
    .slice(0, MAX_PROCESS_ROWS)
    .map((record, index) => {
      const cpu = record.cpu_percent;
      return {
        key: record.pid === undefined || record.pid === null ? String(index) : String(record.pid),
        pid: record.pid === undefined || record.pid === null ? null : String(record.pid),
        // Glances reports per-core percentages, so a busy process can exceed
        // 100; the bar clamps, but the printed number does not.
        cpuPercent: typeof cpu === 'number' && Number.isFinite(cpu) ? cpu : null,
        cells: columns.map((field) => formatProcessCell(record[field], fieldFormatters?.[field])),
      };
    });

  return { columns, rows };
}
