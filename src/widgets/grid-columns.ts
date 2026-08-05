/**
 * Which columns a table can afford, and how wide each one is.
 *
 * Pure, because this is the part of the reference's table ladder that is a *decision* rather than a
 * rendering: "columns drop by priority — command and CPU always survive, pid holds to regular"
 * (ref §7.4). Deciding it in the component would make it three separate near-copies across
 * processes, containers and alerts.
 */

export interface GridColumn {
  key: string;
  label: string;
  /** Fixed width in points. Omit to share the leftover space with the other flexible columns. */
  width?: number;
  /** Share of the remainder, when `width` is absent. Defaults to 1. */
  flex?: number;
  align?: 'left' | 'right';
  /**
   * How expendable the column is: **higher drops first**, and `0` never drops at all.
   *
   * A priority-0 column is what makes the row identifiable — the command, the mount, the container
   * name — and a table whose rows cannot be told apart is worse than a narrower one.
   */
  priority: number;
  /** Sorting by this column is offered. */
  sortable?: boolean;
}

/** Space a fixed column needs, including the gap that follows it. */
const COLUMN_GAP = 10;

/** What the flexible columns need between them before dropping anything else is pointless. */
const MIN_FLEX_WIDTH = 90;

/**
 * The columns that fit `available` points, dropping the least important first.
 *
 * Priority 0 columns always survive, even when nothing fits: a row reduced to an unreadable stub is
 * still more use than a table that renders nothing, and the alternative — clipping mid-column — is
 * the one thing the handoff forbids.
 */
export function visibleColumns(columns: readonly GridColumn[], available: number): GridColumn[] {
  const essential = columns.filter((column) => column.priority === 0);
  let kept = [...columns];

  const widthOf = (list: GridColumn[]) =>
    list.reduce((sum, column) => sum + (column.width ?? 0) + COLUMN_GAP, 0) +
    (list.some((column) => column.width === undefined) ? MIN_FLEX_WIDTH : 0);

  while (kept.length > essential.length && widthOf(kept) > available) {
    // The most expendable goes; ties break on the later column, so a table sheds from the right,
    // which is the direction someone reading left-to-right notices least.
    let victimIndex = -1;
    let worst = 0;
    kept.forEach((column, index) => {
      if (column.priority === 0) return;
      if (column.priority >= worst) {
        worst = column.priority;
        victimIndex = index;
      }
    });
    if (victimIndex === -1) break;
    kept = kept.filter((_, index) => index !== victimIndex);
  }

  return kept.length > 0 ? kept : essential;
}

/**
 * How wide one flexible column actually lands, in points.
 *
 * Needed because one cell has to shorten its own text rather than let the text layer do it: a
 * mount path has to lose its *head*, and `ellipsizeMode="head"` is a no-op on web, where React
 * Native DOM has only CSS `text-overflow`. Shortening to a fixed character budget instead was the
 * first attempt and it cannot work — the budget has to match the pixels, and the pixels depend on
 * which columns survived.
 */
export function flexibleColumnWidth(columns: readonly GridColumn[], available: number): number {
  let fixed = 0;
  let shares = 0;
  for (const column of columns) {
    fixed += COLUMN_GAP;
    if (column.width === undefined) shares += column.flex ?? 1;
    else fixed += column.width;
  }
  if (shares === 0) return 0;
  return Math.max(0, (available - fixed) / shares);
}

/** The flex style for one column — a fixed width, or a share of what is left. */
export function columnStyle(column: GridColumn): {
  width?: number;
  flexGrow?: number;
  flexShrink: number;
  flexBasis?: number;
} {
  if (column.width !== undefined) {
    // Fixed columns must not shrink, or the numeric ones start wrapping while the name column
    // still has room — which reads as a rendering fault rather than as a narrow panel.
    return { width: column.width, flexShrink: 0 };
  }
  return { flexGrow: column.flex ?? 1, flexShrink: 1, flexBasis: 0 };
}
