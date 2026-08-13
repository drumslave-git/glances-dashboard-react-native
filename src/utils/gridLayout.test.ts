import {
  MIN_COL_WIDTH_PX,
  MIN_ROW_HEIGHT_PX,
  MIN_WIDGET_ROWS,
  cellDelta,
  cellRect,
  clampItem,
  columnWidth,
  columnsForWidth,
  compactLayout,
  contentHeight,
  footprintPx,
  layoutBottom,
  layoutsEqual,
  moveItem,
  normalizeLayout,
  resizeItem,
  rowHeightForViewport,
  spanDelta,
  trackSize,
  tracksFor,
  type GridItem,
} from './gridLayout';

const item = (id: string, x: number, y: number, w = 1, h = 3): GridItem => ({ id, x, y, w, h });

/** Positions only, in reading order — what every layout assertion below compares. */
const positions = (items: GridItem[]) =>
  [...items]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((entry) => `${entry.id}@${entry.x},${entry.y} ${entry.w}x${entry.h}`);

describe('tracks', () => {
  it('fits as many tracks as clear the floor, counting the surround', () => {
    // 1200 = 11 surround + 3 × 302 + 3 × 11 with 47 to spare … a fourth would need 313 more.
    expect(tracksFor(1200, MIN_COL_WIDTH_PX, 11)).toBe(3);
    expect(tracksFor(1300, MIN_COL_WIDTH_PX, 11)).toBe(4);
  });

  it('never reports zero tracks, however narrow the box', () => {
    expect(tracksFor(200, MIN_COL_WIDTH_PX, 11)).toBe(1);
    expect(tracksFor(0, MIN_COL_WIDTH_PX, 11)).toBe(1);
  });

  it('stretches the tracks to fill the box exactly', () => {
    const columns = columnsForWidth(1200, 11);
    const width = columnWidth(1200, columns, 11);
    // n tracks and n+1 gaps land on the measured width, with nothing left over.
    expect(columns * width + (columns + 1) * 11).toBeCloseTo(1200);
    expect(width).toBeGreaterThanOrEqual(MIN_COL_WIDTH_PX);
  });

  it('a phone-width grid is one column', () => {
    expect(columnsForWidth(393, 11)).toBe(1);
  });

  it('a stretched column never renders its widgets compact', () => {
    // The compact breakpoint is 300 (`sizeClassForWidth`). Whatever width the grid measures,
    // a column at the floor must clear it — 290 used to sit under it, and whole desktop
    // windows rendered every widget compact (v0.2.0's missing chart axes).
    for (const width of [620, 950, 1200, 1500, 1526, 1900, 2560]) {
      const columns = columnsForWidth(width, 11);
      expect(columnWidth(width, columns, 11)).toBeGreaterThan(300);
    }
  });

  it('spans a footprint across its tracks and the gaps between them', () => {
    expect(footprintPx(1, 300, 11)).toBe(300);
    expect(footprintPx(2, 300, 11)).toBe(611);
  });

  it('rows fill the viewport and never fall below the floor', () => {
    const gap = 11;
    const height = rowHeightForViewport(800, gap);
    expect(height).toBeGreaterThanOrEqual(MIN_ROW_HEIGHT_PX);
    const rows = tracksFor(800, MIN_ROW_HEIGHT_PX, gap);
    expect(rows * height + (rows + 1) * gap).toBeLessThanOrEqual(800);
    // The row height is the same whatever the layout holds — it is a fact about the viewport.
    expect(rowHeightForViewport(800, gap)).toBe(height);
  });

  it('falls back to the floor before the viewport has been measured', () => {
    expect(rowHeightForViewport(0, 11)).toBe(MIN_ROW_HEIGHT_PX);
  });

  it('places a cell against the surround', () => {
    const rect = cellRect({ x: 1, y: 2, w: 2, h: 3 }, 300, 70, 11);
    expect(rect.left).toBe(11 + 311);
    expect(rect.top).toBe(11 + 2 * 81);
    expect(rect.width).toBe(611);
    expect(rect.height).toBe(3 * 70 + 2 * 11);
  });

  it('measures content depth from the deepest widget, surround included', () => {
    const layout = [item('a', 0, 0, 1, 3), item('b', 1, 2, 1, 4)];
    expect(layoutBottom(layout)).toBe(6);
    expect(contentHeight(layout, 70, 11)).toBe(6 * 81 + 11);
    expect(contentHeight([], 70, 11)).toBe(0);
  });

  it('rounds a translation to the nearest cell, so a card follows at the halfway point', () => {
    expect(cellDelta(160, 0, 300, 70, 11)).toEqual({ dx: 1, dy: 0 });
    expect(cellDelta(150, 0, 300, 70, 11)).toEqual({ dx: 0, dy: 0 });
    expect(cellDelta(0, -120, 300, 70, 11)).toEqual({ dx: 0, dy: -1 });
  });

  it('holds the cell it is already on until the pointer is clear of the boundary', () => {
    // A row is 81px here, so half of one is 40 — inside a hand tremor. Sitting just past the
    // halfway point must not flip the target back and forth; 0.2 of a track further does.
    const current = { dx: 0, dy: 0 };
    expect(cellDelta(0, 45, 300, 70, 11, current)).toEqual({ dx: 0, dy: 0 });
    expect(cellDelta(0, 60, 300, 70, 11, current)).toEqual({ dx: 0, dy: 1 });
    // And the band is symmetric: having moved on, the way back is just as long.
    expect(cellDelta(0, 40, 300, 70, 11, { dx: 0, dy: 1 })).toEqual({ dx: 0, dy: 1 });
    expect(cellDelta(0, 20, 300, 70, 11, { dx: 0, dy: 1 })).toEqual({ dx: 0, dy: 0 });
  });

  it('takes the same band on a resize', () => {
    expect(spanDelta(170, 0, 300, 70, 11, { dx: 0, dy: 0 })).toEqual({ dw: 0, dh: 0 });
    expect(spanDelta(230, 0, 300, 70, 11, { dx: 0, dy: 0 })).toEqual({ dw: 1, dh: 0 });
  });
});

describe('clampItem', () => {
  it('keeps a widget inside the grid', () => {
    expect(clampItem(item('a', 5, 0, 2), 2)).toMatchObject({ x: 0, w: 2 });
    expect(clampItem(item('a', 3, 0, 1), 4)).toMatchObject({ x: 3, w: 1 });
  });

  it('narrows a widget that is wider than the grid', () => {
    expect(clampItem(item('a', 0, 0, 3), 1)).toMatchObject({ x: 0, w: 1 });
  });

  it('refuses a footprint below the short floor', () => {
    expect(clampItem(item('a', 0, 0, 1, 1), 4).h).toBe(MIN_WIDGET_ROWS);
  });

  it('never places a widget above the grid', () => {
    expect(clampItem(item('a', -2, -3), 4)).toMatchObject({ x: 0, y: 0 });
  });
});

describe('compactLayout', () => {
  it('drops every widget as far up as it fits', () => {
    const layout = compactLayout([item('a', 0, 4), item('b', 0, 9)], 2);
    expect(positions(layout)).toEqual(['a@0,0 1x3', 'b@0,3 1x3']);
  });

  it('columns fall independently', () => {
    const layout = compactLayout([item('a', 0, 5), item('b', 1, 9)], 2);
    expect(positions(layout)).toEqual(['a@0,0 1x3', 'b@1,0 1x3']);
  });

  it('separates widgets stored on top of each other', () => {
    const layout = compactLayout([item('a', 0, 0), item('b', 0, 0)], 2);
    expect(positions(layout)).toEqual(['a@0,0 1x3', 'b@0,3 1x3']);
  });

  it('normalizing for one column stacks a wide layout without losing anything', () => {
    const layout = normalizeLayout([item('a', 0, 0, 2, 3), item('b', 2, 0, 1, 4)], 1);
    expect(positions(layout)).toEqual(['a@0,0 1x3', 'b@0,3 1x4']);
  });
});

describe('moveItem', () => {
  it('drops a widget where it was dragged, and gravity takes it from there', () => {
    const layout = moveItem([item('a', 0, 0), item('b', 1, 0)], 'b', 1, 6, 2);
    // Nothing above it in that column, so it falls back to the top.
    expect(positions(layout)).toEqual(['a@0,0 1x3', 'b@1,0 1x3']);
  });

  it('swaps two stacked widgets when the lower one is dragged up', () => {
    const layout = moveItem([item('a', 0, 0), item('b', 0, 3)], 'b', 0, 0, 1);
    expect(positions(layout)).toEqual(['b@0,0 1x3', 'a@0,3 1x3']);
  });

  it('swaps them when the upper one is dragged down — the collider lifts into the vacated space', () => {
    const layout = moveItem([item('a', 0, 0), item('b', 0, 3)], 'a', 0, 3, 1);
    expect(positions(layout)).toEqual(['b@0,0 1x3', 'a@0,3 1x3']);
    // The swap must not deepen the layout: that is what pushing the collider down would cost.
    expect(layoutBottom(layout)).toBe(6);
  });

  it('pushes a widget down when there is no room above it', () => {
    const layout = moveItem(
      [item('a', 0, 0), item('b', 0, 3), item('c', 1, 0, 1, 6)],
      'c',
      0,
      0,
      2,
    );
    expect(positions(layout)).toEqual(['c@0,0 1x6', 'a@0,6 1x3', 'b@0,9 1x3']);
  });

  it('moves across columns', () => {
    const layout = moveItem([item('a', 0, 0), item('b', 0, 3)], 'b', 1, 0, 2);
    expect(positions(layout)).toEqual(['a@0,0 1x3', 'b@1,0 1x3']);
  });

  it('is a no-op for an unknown id, or for a drop that changes nothing', () => {
    const layout = [item('a', 0, 0)];
    expect(moveItem(layout, 'missing', 1, 1, 2)).toEqual(layout);
    expect(moveItem(layout, 'a', 0, 0, 2)).toEqual(layout);
  });
});

describe('resizeItem', () => {
  it('widens a widget and pushes what it now covers out of the way', () => {
    const layout = resizeItem([item('a', 0, 0), item('b', 1, 0)], 'a', 2, 3, 2);
    expect(positions(layout)).toEqual(['a@0,0 2x3', 'b@1,3 1x3']);
  });

  it('shrinking pulls the layout back up', () => {
    const layout = resizeItem([item('a', 0, 0, 1, 6), item('b', 0, 6)], 'a', 1, 3, 2);
    expect(positions(layout)).toEqual(['a@0,0 1x3', 'b@0,3 1x3']);
  });

  it('will not resize below the short floor or wider than the grid', () => {
    const layout = resizeItem([item('a', 0, 0)], 'a', 9, 1, 2);
    expect(positions(layout)).toEqual(['a@0,0 2x2']);
  });
});

describe('layoutsEqual', () => {
  it('compares geometry, not order or identity of the array', () => {
    expect(layoutsEqual([item('a', 0, 0), item('b', 1, 0)], [item('b', 1, 0), item('a', 0, 0)])).toBe(true);
    expect(layoutsEqual([item('a', 0, 0)], [item('a', 0, 1)])).toBe(false);
    expect(layoutsEqual([item('a', 0, 0)], [item('a', 0, 0), item('b', 1, 0)])).toBe(false);
    expect(layoutsEqual([item('a', 0, 0)], [item('c', 0, 0)])).toBe(false);
  });
});

describe('trackSize', () => {
  it('never divides by zero tracks', () => {
    expect(Number.isFinite(trackSize(1000, 0, 11))).toBe(true);
  });
});
