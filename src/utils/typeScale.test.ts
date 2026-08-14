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
  heroRowHeight,
  heroUnitFontSize,
  meterRung,
  ratePairFontSize,
  ratePairRowHeight,
  readingSize,
  ringDiameter,
  roleLetterSpacing,
  roleSize,
  SHORT_BELOW_PX,
  sizeClassForWidth,
  sizeModeFor,
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

  it('defaults to the box clamp when no scale is passed', () => {
    expect(heroFontSize(450)).toBe(45);
  });

  it('takes the user scale after the box clamp, under a width ceiling', () => {
    // The owner's 2026-08-12 override of the old "reading channel only" rule.
    expect(heroFontSize(400, 1.2)).toBe(48);
    expect(heroFontSize(900, 2)).toBe(92);
    // A small card caps the scaled hero at ~a quarter of its width.
    expect(heroFontSize(200, 2)).toBeLessThanOrEqual(52);
    // The row reserved for the hero follows the same size.
    expect(heroRowHeight(900, 1)).toBe(Math.round(46 * 0.88) + 12);
    expect(heroRowHeight(900, 2)).toBeGreaterThan(heroRowHeight(900, 1));
  });

  it('sizes a rate pair off the stat channel, both directions alike', () => {
    // Down and up are peers, and a rate is a long string: the pair sits on the *secondary*
    // display numeral, never the hero (owner's review, 2026-08-14).
    expect(ratePairFontSize(623, 1)).toEqual({ size: 26, fitted: false });
    expect(ratePairFontSize(623, 1).size).toBeLessThan(heroFontSize(623, 1));
    // A one-column card still fits both without shrinking.
    expect(ratePairFontSize(306, 1).fitted).toBe(false);
    // Where it cannot, the pair shrinks together instead of truncating a numeral.
    const tight = ratePairFontSize(240, 2);
    expect(tight.fitted).toBe(true);
    expect(tight.size).toBeLessThan(statFontSize(240, 2));
    expect(tight.size).toBeGreaterThanOrEqual(15);
    // The row reserved above the chart follows the pair, label included.
    expect(ratePairRowHeight(26, 9)).toBe(Math.round(26 * 0.95) + 12 + 9 + 2);
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

describe('sizeModeFor', () => {
  it('reports the width tier and the height flag independently', () => {
    expect(sizeModeFor(600, 400)).toEqual({ tier: 'wide', short: false });
    expect(sizeModeFor(600, 150)).toEqual({ tier: 'wide', short: true });
    expect(sizeModeFor(250, 150)).toEqual({ tier: 'compact', short: true });
  });

  it('puts the short boundary in the dead band between the 2-row and 3-row footprints', () => {
    // Dead bands are what stop a widget flickering between presentations as it is resized.
    expect(sizeModeFor(400, SHORT_BELOW_PX - 1).short).toBe(true);
    expect(sizeModeFor(400, SHORT_BELOW_PX).short).toBe(false);
  });
});
