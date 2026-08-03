import {
  READING_SCALE_MAX,
  READING_SCALE_MIN,
  TYPE,
  chartRung,
  clampReadingScale,
  fittingRowCount,
  gaugeUnitFontSize,
  gaugeValueFontSize,
  headerRung,
  heroFontSize,
  heroUnitFontSize,
  meterRung,
  readingSize,
  ringDiameter,
  roleLetterSpacing,
  roleSize,
  sizeClassForWidth,
  statClusterRung,
  statFontSize,
  statUnitFontSize,
  visibleColumns,
  type TableColumn,
} from './typeScale';

describe('size classes', () => {
  it('follows the handoff boundaries', () => {
    expect(sizeClassForWidth(299)).toBe('compact');
    expect(sizeClassForWidth(300)).toBe('regular');
    expect(sizeClassForWidth(520)).toBe('regular');
    expect(sizeClassForWidth(521)).toBe('wide');
  });
});

describe('reading channel', () => {
  it('scales with the user setting', () => {
    expect(readingSize(10, 1)).toBe(10);
    expect(readingSize(10, 1.3)).toBe(13);
  });

  it('holds the floor rather than shrinking below it', () => {
    expect(readingSize(10, 0.85, 9)).toBe(9);
    expect(readingSize(12, 0.85, 11)).toBe(11);
  });

  it('clamps a setting that came from persisted user data', () => {
    expect(clampReadingScale(0.1)).toBe(READING_SCALE_MIN);
    expect(clampReadingScale(99)).toBe(READING_SCALE_MAX);
    expect(clampReadingScale(Number.NaN)).toBe(1);
  });

  it('never shrinks metric type below 11 or micro-labels below 9', () => {
    for (const scale of [0.85, 1, 1.3, 1.6]) {
      expect(roleSize('metric', scale)).toBeGreaterThanOrEqual(11);
      expect(roleSize('micro', scale)).toBeGreaterThanOrEqual(9);
      expect(roleSize('row', scale)).toBeGreaterThanOrEqual(11);
    }
  });

  it('tracks letter-spacing with the scaled size', () => {
    expect(roleLetterSpacing('label', 1)).toBeCloseTo(TYPE.label.letterSpacing, 2);
    expect(roleLetterSpacing('label', 1.5)).toBeCloseTo(TYPE.label.letterSpacing * 1.5, 1);
    expect(roleLetterSpacing('metric', 1.5)).toBe(0);
  });
});

describe('display channel', () => {
  it('sizes the hero off the widget box, clamped to 26–46', () => {
    expect(heroFontSize(200)).toBe(26);
    expect(heroFontSize(400)).toBe(40);
    expect(heroFontSize(900)).toBe(46);
  });

  it('keeps the unit at the handoff ratio', () => {
    expect(heroUnitFontSize(460)).toBe(19);
  });

  it('ignores the user scale entirely', () => {
    // There is no scale parameter to pass — that is the point. A 450pt card
    // renders the same hero whatever the reading setting says.
    expect(heroFontSize(450)).toBe(45);
  });

  it('sizes network stat numerals and gauge centres off their own boxes', () => {
    expect(statFontSize(200)).toBe(18);
    expect(statFontSize(600)).toBe(26);
    expect(statUnitFontSize(600)).toBe(12);
    expect(statUnitFontSize(600)).toBeLessThan(statFontSize(600));
    expect(gaugeValueFontSize(158)).toBe(32);
    expect(gaugeValueFontSize(72)).toBe(15);
    expect(gaugeUnitFontSize(158)).toBe(15);
  });
});

describe('header ladder', () => {
  it('drops state chips, then the chip itself, as the box shrinks', () => {
    expect(headerRung('wide')).toBe('full');
    expect(headerRung('regular')).toBe('chip');
    expect(headerRung('compact')).toBe('dot');
  });
});

describe('chart ladder', () => {
  it('steps down a rung at a time', () => {
    expect(chartRung('wide', 156)).toBe('full');
    expect(chartRung('regular', 156)).toBe('grid');
    expect(chartRung('compact', 156)).toBe('sparkline');
  });

  it('lets height override the width class', () => {
    expect(chartRung('wide', 40)).toBe('sparkline');
    expect(chartRung('wide', 20)).toBe('pulse');
    expect(chartRung('wide', 4)).toBe('none');
  });
});

describe('stat cluster ladder', () => {
  it('goes inline only when the widget is wide', () => {
    expect(statClusterRung('wide', 100)).toBe('inline');
    expect(statClusterRung('regular', 100)).toBe('footer');
    expect(statClusterRung('compact', 100)).toBe('footer');
  });

  it('drops entirely when there is no room', () => {
    expect(statClusterRung('wide', 10)).toBe('none');
  });
});

describe('meter ladder', () => {
  it('gives each meter its own track while there is room', () => {
    expect(meterRung(3, 120)).toBe('stacked');
    expect(meterRung(3, 60)).toBe('inline');
    expect(meterRung(3, 30)).toBe('value');
  });

  it('treats an empty set as nothing to draw', () => {
    expect(meterRung(0, 200)).toBe('value');
  });
});

describe('ring gauge', () => {
  it('caps at the reference diameter and fits the smaller axis', () => {
    expect(ringDiameter(400, 300)).toBe(158);
    expect(ringDiameter(120, 300)).toBe(104);
  });

  it('returns null below the 72pt floor, where the ring becomes a bar', () => {
    expect(ringDiameter(80, 60)).toBeNull();
    expect(ringDiameter(60, 300)).toBeNull();
  });
});

describe('table columns', () => {
  const columns: TableColumn[] = [
    { key: 'pid', priority: 1, width: 54 },
    { key: 'command', priority: 1, width: 140 },
    { key: 'trend', priority: 3, width: 78 },
    { key: 'cpu', priority: 1, width: 132 },
    { key: 'mem', priority: 2, width: 84 },
    { key: 'time', priority: 4, width: 70 },
  ];

  it('keeps priority-1 columns even when they do not fit — never scrolls', () => {
    const kept = visibleColumns(columns, 100).map((column) => column.key);
    expect(kept).toEqual(['pid', 'command', 'cpu']);
  });

  it('adds optional columns by priority as width allows', () => {
    expect(visibleColumns(columns, 420).map((c) => c.key)).toEqual(['pid', 'command', 'cpu', 'mem']);
    expect(visibleColumns(columns, 500).map((c) => c.key)).toEqual([
      'pid',
      'command',
      'trend',
      'cpu',
      'mem',
    ]);
    expect(visibleColumns(columns, 600).map((c) => c.key)).toEqual([
      'pid',
      'command',
      'trend',
      'cpu',
      'mem',
      'time',
    ]);
  });

  it('returns columns in the caller order, not priority order', () => {
    const kept = visibleColumns(columns, 600);
    expect(kept.map((c) => c.key)).toEqual(columns.map((c) => c.key));
  });
});

describe('row fitting', () => {
  it('never counts a row it would have to cut in half', () => {
    expect(fittingRowCount(100, 30)).toBe(3);
    expect(fittingRowCount(89, 30)).toBe(2);
  });

  it('caps at the requested maximum and copes with a zero row height', () => {
    expect(fittingRowCount(1000, 30)).toBe(8);
    expect(fittingRowCount(1000, 30, 5)).toBe(5);
    expect(fittingRowCount(100, 0)).toBe(0);
  });
});
