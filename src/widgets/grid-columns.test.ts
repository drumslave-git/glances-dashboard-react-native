import { columnStyle, visibleColumns, type GridColumn } from './grid-columns';

/** Roughly the processes table: a flexible command column and four numeric ones. */
const COLUMNS: GridColumn[] = [
  { key: 'pid', label: 'PID', width: 56, priority: 2 },
  { key: 'name', label: 'Command', priority: 0 },
  { key: 'cpu', label: 'CPU %', width: 70, align: 'right', priority: 0 },
  { key: 'mem', label: 'Mem %', width: 70, align: 'right', priority: 3 },
  { key: 'user', label: 'User', width: 90, priority: 1 },
];

const keys = (list: GridColumn[]) => list.map((column) => column.key);

describe('visibleColumns', () => {
  it('keeps everything when there is room', () => {
    expect(keys(visibleColumns(COLUMNS, 900))).toEqual(['pid', 'name', 'cpu', 'mem', 'user']);
  });

  it('drops the most expendable first', () => {
    // `mem` is priority 3, the most expendable of the five.
    const kept = keys(visibleColumns(COLUMNS, 400));
    expect(kept).not.toContain('mem');
    expect(kept).toContain('name');
    expect(kept).toContain('cpu');
  });

  it('sheds from the right as it narrows, and never drops an essential column', () => {
    // Command and CPU are what make a process row worth reading; they survive every width.
    for (const width of [800, 500, 300, 150, 0]) {
      const kept = keys(visibleColumns(COLUMNS, width));
      expect(kept).toContain('name');
      expect(kept).toContain('cpu');
    }
  });

  it('reduces to the essential columns rather than to nothing', () => {
    expect(keys(visibleColumns(COLUMNS, 10))).toEqual(['name', 'cpu']);
  });

  it('drops in priority order, not in column order', () => {
    // Asserted as the *sequence* of departures rather than against guessed pixel thresholds:
    // mem (3), then pid (2), then user (1) — `user` sits furthest right but is the least
    // expendable of the three, so it outlives both.
    const departures: string[] = [];
    let previous = keys(visibleColumns(COLUMNS, 1000));
    for (let width = 1000; width >= 0; width -= 10) {
      const kept = keys(visibleColumns(COLUMNS, width));
      for (const key of previous) if (!kept.includes(key)) departures.push(key);
      previous = kept;
    }
    expect(departures).toEqual(['mem', 'pid', 'user']);
  });

  it('copes with a table that is all essential', () => {
    const essentialOnly: GridColumn[] = [
      { key: 'a', label: 'A', priority: 0 },
      { key: 'b', label: 'B', width: 200, priority: 0 },
    ];
    expect(keys(visibleColumns(essentialOnly, 20))).toEqual(['a', 'b']);
  });

  it('does not mutate the columns it was given', () => {
    const before = [...COLUMNS];
    visibleColumns(COLUMNS, 100);
    expect(COLUMNS).toEqual(before);
  });
});

describe('columnStyle', () => {
  it('pins a fixed column so the numeric ones do not wrap first', () => {
    expect(columnStyle({ key: 'cpu', label: 'CPU', width: 70, priority: 0 })).toEqual({
      width: 70,
      flexShrink: 0,
    });
  });

  it('lets a flexible column take the remainder', () => {
    expect(columnStyle({ key: 'name', label: 'Command', priority: 0 })).toEqual({
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
    });
  });

  it('honours an explicit share', () => {
    expect(columnStyle({ key: 'name', label: 'Command', flex: 2, priority: 0 }).flexGrow).toBe(2);
  });
});
