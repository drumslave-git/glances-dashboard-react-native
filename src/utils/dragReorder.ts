/**
 * Drop-target maths for the dashboard's drag reorder.
 *
 * The grid is a wrap flow of variable-width cards (S/M/L/XL span 1–4 columns),
 * which is why no off-the-shelf sortable list fits: they assume uniform rows or
 * a uniform grid. Working from measured rectangles handles any layout the flow
 * produces, and keeps the decision pure enough to test without a gesture.
 */

export interface CardRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

function contains(rect: CardRect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function centerDistanceSquared(rect: CardRect, point: Point): number {
  const dx = rect.x + rect.width / 2 - point.x;
  const dy = rect.y + rect.height / 2 - point.y;
  return dx * dx + dy * dy;
}

/**
 * Which card the pointer is over, as an index into `rects`.
 *
 * A pointer between cards (the gaps, or past the last row) still has to land
 * somewhere, so it falls back to the nearest card centre — dragging below the
 * grid therefore targets the last card rather than doing nothing.
 * Returns -1 only when there is nothing to target.
 */
export function findDropIndex(rects: CardRect[], point: Point): number {
  if (rects.length === 0) return -1;

  const hit = rects.findIndex((rect) => contains(rect, point));
  if (hit !== -1) return hit;

  let nearest = 0;
  let nearestDistance = centerDistanceSquared(rects[0], point);
  for (let index = 1; index < rects.length; index += 1) {
    const distance = centerDistanceSquared(rects[index], point);
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/** Move one item to a new index, returning a new array. Out-of-range moves are ignored. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return items;
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * The order the grid should show mid-drag: the dragged card moved to whichever
 * position the pointer is over. `rects` must be in the same order as `ids`.
 */
export function reorderForPointer(
  ids: string[],
  rects: CardRect[],
  draggingId: string,
  point: Point,
): string[] {
  const from = ids.indexOf(draggingId);
  if (from === -1) return ids;

  const to = findDropIndex(rects, point);
  if (to === -1) return ids;

  return moveItem(ids, from, to);
}
