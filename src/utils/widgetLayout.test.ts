import {
  columnsForWidth,
  heightForSize,
  nextSize,
  preferredSpanForSize,
  spanForSize,
  widthPercentForSize,
  GRID_ROW_HEIGHT,
  heightForRows,
  spanForWidth,
  widthPercentForSpan,
} from './widgetLayout';

describe('columnsForWidth', () => {
  it('scales from phone to desktop', () => {
    expect(columnsForWidth(320)).toBe(1);
    expect(columnsForWidth(390)).toBe(2); // typical phone
    expect(columnsForWidth(834)).toBe(4); // tablet portrait
    expect(columnsForWidth(1280)).toBe(4); // desktop / tablet landscape
  });

  it('never lands on an odd count above one, so M-sized cards tile', () => {
    // A 3-column grid would leave a third of every row empty, since the default
    // M size spans 2 and nothing narrower can follow it.
    for (const width of [360, 500, 699, 700, 900, 1100, 1600, 2560]) {
      const columns = columnsForWidth(width);
      expect(columns % 2).toBe(0);
    }
  });

  it('fills a row exactly with the default size', () => {
    for (const width of [390, 834, 1280]) {
      const columns = columnsForWidth(width);
      expect(100 % widthPercentForSize('M', columns)).toBe(0);
    }
  });
});

describe('spanForSize', () => {
  it('uses the preset width when the grid is wide enough', () => {
    expect(spanForSize('S', 4)).toBe(1);
    expect(spanForSize('M', 4)).toBe(2);
    expect(spanForSize('L', 4)).toBe(3);
    expect(spanForSize('XL', 4)).toBe(4);
  });

  it('never exceeds the available columns', () => {
    expect(spanForSize('XL', 2)).toBe(2);
    expect(spanForSize('L', 1)).toBe(1);
  });

  it('treats a zero column count as one', () => {
    expect(spanForSize('M', 0)).toBe(1);
  });
});

describe('widthPercentForSize', () => {
  it('gives a full row when the span fills the grid', () => {
    expect(widthPercentForSize('XL', 4)).toBe(100);
    expect(widthPercentForSize('M', 2)).toBe(100);
  });

  it('gives a fraction otherwise', () => {
    expect(widthPercentForSize('S', 2)).toBe(50);
    expect(widthPercentForSize('M', 4)).toBe(50);
    expect(widthPercentForSize('S', 4)).toBe(25);
  });
});

describe('heightForSize', () => {
  it('grows with the preset', () => {
    const heights = (['S', 'M', 'L', 'XL'] as const).map(heightForSize);
    expect(heights).toEqual([...heights].sort((a, b) => a - b));
    expect(new Set(heights).size).toBe(4);
  });
});

describe('preferredSpanForSize', () => {
  it('is monotonic', () => {
    expect(preferredSpanForSize('S')).toBeLessThan(preferredSpanForSize('M'));
    expect(preferredSpanForSize('M')).toBeLessThan(preferredSpanForSize('L'));
    expect(preferredSpanForSize('L')).toBeLessThan(preferredSpanForSize('XL'));
  });
});

describe('nextSize', () => {
  it('cycles back to the start', () => {
    expect(nextSize('S')).toBe('M');
    expect(nextSize('M')).toBe('L');
    expect(nextSize('L')).toBe('XL');
    expect(nextSize('XL')).toBe('S');
  });
});

describe('span geometry', () => {
  it('gives a one-column widget its share of the grid', () => {
    expect(widthPercentForSpan(1, 2)).toBe(50);
    expect(widthPercentForSpan(1, 4)).toBe(25);
  });

  it('lets a wide widget claim two columns', () => {
    expect(widthPercentForSpan(2, 4)).toBe(50);
  });

  it('never spans more columns than the grid has', () => {
    // A wide widget on a phone is simply full width, not an overflow.
    expect(widthPercentForSpan(2, 1)).toBe(100);
    expect(spanForWidth(3, 2)).toBe(2);
  });

  it('turns rows into points', () => {
    expect(heightForRows(3)).toBe(3 * GRID_ROW_HEIGHT);
    // A nonsensical footprint still has to render something.
    expect(heightForRows(0)).toBe(GRID_ROW_HEIGHT);
  });
});
