import { findDropIndex, moveItem, reorderForPointer, type CardRect } from './dragReorder';

/** Two rows of two 100x100 cards, laid out like the wrap grid would. */
const GRID: CardRect[] = [
  { id: 'a', x: 0, y: 0, width: 100, height: 100 },
  { id: 'b', x: 100, y: 0, width: 100, height: 100 },
  { id: 'c', x: 0, y: 100, width: 100, height: 100 },
  { id: 'd', x: 100, y: 100, width: 100, height: 100 },
];

describe('findDropIndex', () => {
  it('finds the card under the pointer', () => {
    expect(findDropIndex(GRID, { x: 50, y: 50 })).toBe(0);
    expect(findDropIndex(GRID, { x: 150, y: 50 })).toBe(1);
    expect(findDropIndex(GRID, { x: 50, y: 150 })).toBe(2);
    expect(findDropIndex(GRID, { x: 150, y: 150 })).toBe(3);
  });

  it('falls back to the nearest card when the pointer is past the grid', () => {
    // Below the last row, on the right: nearest centre is the bottom-right card.
    expect(findDropIndex(GRID, { x: 150, y: 400 })).toBe(3);
    // Above the grid, on the left.
    expect(findDropIndex(GRID, { x: 20, y: -80 })).toBe(0);
  });

  it('handles cards of different sizes, as the size presets produce', () => {
    const mixed: CardRect[] = [
      { id: 'wide', x: 0, y: 0, width: 200, height: 100 },
      { id: 'small', x: 0, y: 100, width: 100, height: 100 },
    ];
    expect(findDropIndex(mixed, { x: 180, y: 20 })).toBe(0);
    expect(findDropIndex(mixed, { x: 50, y: 150 })).toBe(1);
  });

  it('reports nothing to target for an empty grid', () => {
    expect(findDropIndex([], { x: 0, y: 0 })).toBe(-1);
  });
});

describe('moveItem', () => {
  it('moves an item forward', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('moves an item backward', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('returns the same array when nothing moves', () => {
    const items = ['a', 'b'];
    expect(moveItem(items, 1, 1)).toBe(items);
  });

  it('ignores out-of-range moves', () => {
    const items = ['a', 'b'];
    expect(moveItem(items, 5, 0)).toBe(items);
    expect(moveItem(items, 0, 9)).toBe(items);
    expect(moveItem(items, -1, 0)).toBe(items);
  });

  it('does not mutate the input', () => {
    const items = ['a', 'b', 'c'];
    moveItem(items, 0, 2);
    expect(items).toEqual(['a', 'b', 'c']);
  });
});

describe('reorderForPointer', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('moves the dragged card to the card under the pointer', () => {
    expect(reorderForPointer(ids, GRID, 'a', { x: 150, y: 150 })).toEqual(['b', 'c', 'd', 'a']);
  });

  it('leaves the order alone while the pointer is still over the dragged card', () => {
    expect(reorderForPointer(ids, GRID, 'a', { x: 50, y: 50 })).toBe(ids);
  });

  it('moves a card backwards', () => {
    expect(reorderForPointer(ids, GRID, 'd', { x: 50, y: 50 })).toEqual(['d', 'a', 'b', 'c']);
  });

  it('ignores an unknown dragged id', () => {
    expect(reorderForPointer(ids, GRID, 'nope', { x: 50, y: 50 })).toBe(ids);
  });

  it('ignores an empty grid', () => {
    expect(reorderForPointer(ids, [], 'a', { x: 0, y: 0 })).toBe(ids);
  });
});
