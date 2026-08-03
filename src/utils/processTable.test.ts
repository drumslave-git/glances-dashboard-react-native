import { processListFixture } from '@/__fixtures__/glances';

import {
  buildProcessTable,
  DEFAULT_PROCESS_FIELDS,
  formatProcessCell,
  getProcessHeaderLabel,
  MAX_PROCESS_ROWS,
  processColumnWidth,
} from './processTable';

describe('getProcessHeaderLabel', () => {
  it('gives the known process fields friendly labels', () => {
    expect(getProcessHeaderLabel('cpu_percent')).toBe('CPU %');
    expect(getProcessHeaderLabel('memory_percent')).toBe('Mem %');
    expect(getProcessHeaderLabel('username')).toBe('User');
    expect(getProcessHeaderLabel('cmdline')).toBe('Command');
    expect(getProcessHeaderLabel('pid')).toBe('PID');
    expect(getProcessHeaderLabel('name')).toBe('Name');
  });

  it('falls back to the raw key', () => {
    expect(getProcessHeaderLabel('num_threads')).toBe('num_threads');
  });
});

describe('processColumnWidth', () => {
  it('gives the command column more room than a numeric one', () => {
    expect(processColumnWidth('cmdline')).toBeGreaterThan(processColumnWidth('cpu_percent'));
  });

  it('has a width for unknown fields', () => {
    expect(processColumnWidth('whatever')).toBeGreaterThan(0);
  });
});

describe('formatProcessCell', () => {
  it('renders scalars as strings', () => {
    expect(formatProcessCell('root')).toBe('root');
    expect(formatProcessCell(12.5)).toBe('12.5');
    expect(formatProcessCell(0)).toBe('0');
  });

  it('renders nothing for missing values', () => {
    expect(formatProcessCell(undefined)).toBe('');
    expect(formatProcessCell(null)).toBe('');
  });

  it('joins an array cmdline with spaces', () => {
    expect(formatProcessCell(['/sbin/init', '--switched-root'])).toBe('/sbin/init --switched-root');
  });

  it('json-encodes a nested object rather than showing [object Object]', () => {
    expect(formatProcessCell({ rss: 12, vms: 34 })).toBe('{"rss":12,"vms":34}');
  });

  it('applies a formatter to scalars', () => {
    expect(formatProcessCell(12.80514761848463, 'round(1)')).toBe('12.8');
    expect(formatProcessCell(16969019392, 'gb')).toBe('15.80 GB');
  });

  it('applies a formatter to a joined cmdline', () => {
    expect(formatProcessCell(['/usr/bin/node', '--inspect'], 'truncate(10,end)')).toBe('/usr/bin/…');
  });
});

describe('buildProcessTable', () => {
  it('uses the reference default columns when none are configured', () => {
    const { columns } = buildProcessTable(processListFixture);
    expect(columns).toEqual([...DEFAULT_PROCESS_FIELDS]);
  });

  it('builds a row per process in column order', () => {
    const { rows } = buildProcessTable(processListFixture, ['name', 'username', 'pid']);
    expect(rows).toHaveLength(2);
    expect(rows[0].cells).toEqual(['llama-server', 'root', '3144580']);
    expect(rows[1].cells).toEqual(['systemd', 'root', '1']);
  });

  it('keys rows by pid', () => {
    const { rows } = buildProcessTable(processListFixture);
    expect(rows.map((row) => row.key)).toEqual(['3144580', '1']);
  });

  it('falls back to the index when a process has no pid', () => {
    const { rows } = buildProcessTable([{ name: 'a' }, { name: 'b' }]);
    expect(rows.map((row) => row.key)).toEqual(['0', '1']);
  });

  it('applies per-column formatters', () => {
    const { rows } = buildProcessTable(processListFixture, ['name', 'memory_percent'], {
      memory_percent: 'round(2)',
    });
    expect(rows[0].cells).toEqual(['llama-server', '12.81']);
  });

  it(`caps the table at ${MAX_PROCESS_ROWS} rows`, () => {
    const many = Array.from({ length: 120 }, (_, index) => ({ name: `p${index}`, pid: index }));
    expect(buildProcessTable(many).rows).toHaveLength(MAX_PROCESS_ROWS);
  });

  it('returns no rows but keeps the columns for a non-array payload', () => {
    const table = buildProcessTable({ not: 'a list' }, ['name']);
    expect(table).toEqual({ columns: ['name'], rows: [] });
  });

  it('renders missing fields as blank cells', () => {
    const { rows } = buildProcessTable([{ name: 'a', pid: 1 }], ['name', 'username']);
    expect(rows[0].cells).toEqual(['a', '']);
  });
});
