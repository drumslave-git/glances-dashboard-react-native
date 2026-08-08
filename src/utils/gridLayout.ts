/**
 * The dashboard grid's arithmetic and its layout algebra (ref §7.4).
 *
 * Two halves, both pure:
 *
 * - **Tracks.** How many columns and rows fit a measured box, and what one of them is worth in
 *   pixels. Columns are **coarse — one widget wide**: the floor sits just under the compact
 *   breakpoint, so an ordinary widget spans exactly one column and a wide one claims two. The grid
 *   fits as many columns as clear the floor and stretches them to fill the measured width exactly,
 *   which is what makes a row of widgets end at the window's edge instead of leaving a strip no
 *   span can reach. Rows use the same rule against the scroll viewport, because height is where
 *   widgets genuinely differ.
 * - **Layout.** Moving and resizing over `{x, y, w, h}` with vertical gravity, which is the part
 *   `react-grid-layout` does for the reference and nothing does for React Native. Collisions are
 *   resolved the way RGL resolves them — a widget dragged down over another lifts it into the space
 *   just vacated, rather than shoving it further down and leaving a hole.
 *
 * These are **px deliberately**: widget boxes belong to the display channel. If the tracks followed
 * the user's reading scale, turning text up would push every widget across its own size breakpoints
 * — the reading channel re-laying-out the display channel, which is the coupling the two channels
 * exist to forbid.
 */

/**
 * Just **over** `sizeClassForWidth`'s 300pt compact boundary, so a column can never stretch to a
 * width that renders its widgets compact. The first cut of this floor was 290 — just *under* the
 * boundary — and that was wrong in practice: for a whole band of window widths every column
 * settled between 290 and 300, and the entire board silently degraded to the compact rendering
 * (no gridlines, no axis labels) while the picker had previewed the regular one at 360. Compact
 * now happens only where it was meant to: a window narrower than a single column.
 */
export const MIN_COL_WIDTH_PX = 302;
export const MIN_ROW_HEIGHT_PX = 70;

/** The floor a widget may be resized to: one column, and two rows — the short state. */
export const MIN_WIDGET_COLS = 1;
export const MIN_WIDGET_ROWS = 2;

/**
 * What a size card assumes a column is worth — mid-stretch, the width a placed column usually has.
 * Cards must not preview at the floor: there every one-column card would measure compact, and the
 * "Regular" card would show the wrong presentation of the thing being chosen.
 */
export const PREVIEW_COL_WIDTH_PX = 360;

/** A placed rectangle in grid units. `WidgetInstance` is one of these plus everything else. */
export interface GridItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * How many tracks fit `available` px with every track at least `min` px. The gap is also the
 * padding at both edges, so `n` tracks carry `n + 1` of it. Never zero: a window narrower than one
 * minimum track still has to hold a grid.
 */
export function tracksFor(available: number, min: number, gap: number): number {
  return Math.max(1, Math.floor((available - gap) / (min + gap)));
}

/**
 * The size at which `tracks` tracks exactly fill `available` px — the remainder of the floor
 * division above is spread back over the tracks rather than left as dead space at the edge.
 */
export function trackSize(available: number, tracks: number, gap: number): number {
  const count = Math.max(1, tracks);
  return (available - (count + 1) * gap) / count;
}

/** The px a footprint of `units` tracks spans: the tracks, plus the `units - 1` gaps between them. */
export function footprintPx(units: number, track: number, gap: number): number {
  const count = Math.max(1, units);
  return count * track + (count - 1) * gap;
}

/** Columns for a measured grid width. */
export function columnsForWidth(width: number, gap: number): number {
  return tracksFor(width, MIN_COL_WIDTH_PX, gap);
}

/** One column's width, stretched to fill the measured width exactly. */
export function columnWidth(width: number, columns: number, gap: number): number {
  return Math.max(1, trackSize(width, columns, gap));
}

/**
 * Row height from the **scroll viewport's** height — not the grid's own, which is whatever its rows
 * add up to.
 *
 * A windowful is however many rows clear the floor, and those rows stretch to fill it exactly, so
 * entering full screen hands the toolbar's height back to the rows instead of leaving dead space.
 * The height must not depend on the depth of the layout: fitting the deepest row to the window
 * would mean every widget added shrinks every widget already placed. A layout deeper than a
 * windowful is simply taller than the window, and is reached by scrolling.
 */
export function rowHeightForViewport(available: number, gap: number): number {
  if (available <= 0) return MIN_ROW_HEIGHT_PX;
  const rows = tracksFor(available, MIN_ROW_HEIGHT_PX, gap);
  return Math.max(1, Math.floor(trackSize(available, rows, gap)));
}

/** Where a cell sits in the grid's own coordinates, gap included as the surround. */
export function cellRect(
  item: Pick<GridItem, 'x' | 'y' | 'w' | 'h'>,
  colWidth: number,
  rowHeight: number,
  gap: number,
): { left: number; top: number; width: number; height: number } {
  return {
    left: gap + item.x * (colWidth + gap),
    top: gap + item.y * (rowHeight + gap),
    width: footprintPx(item.w, colWidth, gap),
    height: footprintPx(item.h, rowHeight, gap),
  };
}

/** The first row below every placed widget — the layout's depth in grid units. */
export function layoutBottom(items: readonly GridItem[]): number {
  return items.reduce((bottom, item) => Math.max(bottom, item.y + item.h), 0);
}

/** How tall the scrollable content is, surround included. */
export function contentHeight(items: readonly GridItem[], rowHeight: number, gap: number): number {
  const rows = layoutBottom(items);
  return rows === 0 ? 0 : rows * (rowHeight + gap) + gap;
}

/**
 * A drag translation in cells. Rounded rather than floored, so a card follows the finger at the
 * halfway point of a track instead of only once it has fully crossed one.
 */
export function cellDelta(
  translationX: number,
  translationY: number,
  colWidth: number,
  rowHeight: number,
  gap: number,
): { dx: number; dy: number } {
  return {
    dx: Math.round(translationX / (colWidth + gap)),
    dy: Math.round(translationY / (rowHeight + gap)),
  };
}

/** A resize translation in cells, by the same rule. */
export function spanDelta(
  translationX: number,
  translationY: number,
  colWidth: number,
  rowHeight: number,
  gap: number,
): { dw: number; dh: number } {
  const { dx, dy } = cellDelta(translationX, translationY, colWidth, rowHeight, gap);
  return { dw: dx, dh: dy };
}

/** Whole units, inside the grid, never below the minimum footprint. */
export function clampItem<T extends GridItem>(item: T, columns: number): T {
  const cols = Math.max(1, Math.floor(columns));
  const w = Math.min(cols, Math.max(MIN_WIDGET_COLS, Math.round(item.w)));
  const h = Math.max(MIN_WIDGET_ROWS, Math.round(item.h));
  const x = Math.min(cols - w, Math.max(0, Math.round(item.x)));
  const y = Math.max(0, Math.round(item.y));
  return { ...item, x, y, w, h };
}

function overlaps(a: GridItem, b: GridItem): boolean {
  if (a.id === b.id) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function firstCollision(item: GridItem, against: readonly GridItem[]): GridItem | undefined {
  return against.find((other) => overlaps(item, other));
}

/** Reading order: top row first, then left to right. `lead` wins its row, which is how a drag lands. */
function sortByPosition(items: readonly GridItem[], lead?: string): GridItem[] {
  return [...items].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    if (lead !== undefined && (a.id === lead || b.id === lead)) return a.id === lead ? -1 : 1;
    if (a.x !== b.x) return a.x - b.x;
    return a.id < b.id ? -1 : 1;
  });
}

/**
 * Vertical gravity: every widget falls as far up as it can without overlapping one already placed.
 *
 * There is no "leave a gap above" in this grid, deliberately — the same rule react-grid-layout
 * applies. A hole in the middle of a dashboard is almost always a layout that lost an argument with
 * a resize, not something anyone arranged.
 */
export function compactLayout(items: readonly GridItem[], columns: number, lead?: string): GridItem[] {
  const placed: GridItem[] = [];
  for (const item of sortByPosition(items, lead)) {
    const candidate = clampItem(item, columns);
    // Push clear of anything it starts inside, then fall.
    while (firstCollision(candidate, placed)) candidate.y += 1;
    while (candidate.y > 0 && !firstCollision({ ...candidate, y: candidate.y - 1 }, placed)) {
      candidate.y -= 1;
    }
    placed.push(candidate);
  }
  return placed;
}

/** What the grid renders: a stored layout made legal for the column count it is being drawn at. */
export function normalizeLayout(items: readonly GridItem[], columns: number): GridItem[] {
  return compactLayout(items, columns);
}

/**
 * Make room for `moving` among `rest`.
 *
 * A collider is **lifted into the space the moving widget just vacated** when that space is free,
 * and pushed below it otherwise. Without the lift, dragging a widget down past its neighbour would
 * push the neighbour further down and leave a hole where the drag started — the layout would grow a
 * row every time two widgets swapped.
 */
function resolveCollisions(
  rest: readonly GridItem[],
  moving: GridItem,
  columns: number,
  liftAllowed: boolean,
): GridItem[] {
  const colliders = sortByPosition(rest).filter((item) => overlaps(item, moving));
  if (colliders.length === 0) return [...rest];

  /**
   * One displacement for the whole group, measured from the topmost collider, so widgets pushed
   * out of the way keep their order among themselves. Sending each of them to the row just below
   * the moving widget would stack them in the order they happened to be visited, which inverts a
   * column whenever two widgets are displaced at once.
   */
  const delta = moving.y + moving.h - Math.min(...colliders.map((entry) => entry.y));
  let result = [...rest];

  for (const collider of colliders) {
    const current = result.find((item) => item.id === collider.id);
    // An earlier push may already have carried this one clear.
    if (!current || !overlaps(current, moving)) continue;

    const others = result.filter((item) => item.id !== current.id);
    const lifted = { ...current, y: Math.max(0, moving.y - current.h) };

    if (liftAllowed && lifted.y < current.y && !firstCollision(lifted, [...others, moving])) {
      result = [...others, lifted];
      continue;
    }

    // Below the moving widget, and whatever that displaces moves too.
    const pushed = { ...current, y: current.y + delta };
    result = [...resolveCollisions(others, pushed, columns, false), pushed];
  }

  return result;
}

/** Drop `id` at `(x, y)`. Returns the whole layout, compacted. */
export function moveItem(
  items: readonly GridItem[],
  id: string,
  x: number,
  y: number,
  columns: number,
): GridItem[] {
  const target = items.find((item) => item.id === id);
  if (!target) return [...items];

  const moved = clampItem({ ...target, x, y }, columns);
  if (moved.x === target.x && moved.y === target.y) return [...items];

  const rest = items.filter((item) => item.id !== id);
  // Only a downward drag can lift a collider into vacated space; dragging up vacates nothing.
  const resolved = resolveCollisions(rest, moved, columns, moved.y > target.y);
  return compactLayout([moved, ...resolved], columns, id);
}

/** Give `id` a footprint of `w × h`. Returns the whole layout, compacted. */
export function resizeItem(
  items: readonly GridItem[],
  id: string,
  w: number,
  h: number,
  columns: number,
): GridItem[] {
  const target = items.find((item) => item.id === id);
  if (!target) return [...items];

  const resized = clampItem({ ...target, w, h }, columns);
  if (resized.w === target.w && resized.h === target.h) return [...items];

  const rest = items.filter((item) => item.id !== id);
  // A widget growing has vacated nothing, so colliders can only go down.
  const resolved = resolveCollisions(rest, resized, columns, false);
  return compactLayout([resized, ...resolved], columns, id);
}

/** Whether two layouts place every widget identically. Ids not in both count as a difference. */
export function layoutsEqual(a: readonly GridItem[], b: readonly GridItem[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((item) => [item.id, item]));
  return a.every((item) => {
    const other = byId.get(item.id);
    return other !== undefined && other.x === item.x && other.y === item.y && other.w === item.w && other.h === item.h;
  });
}
