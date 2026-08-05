import type { WidgetSize } from '@/types/dashboard';

/**
 * Replaces the web app's 12-column drag grid. Widgets choose a size preset and
 * the grid decides how many columns fit the current window.
 */

export const WIDGET_SIZES: WidgetSize[] = ['S', 'M', 'L', 'XL'];

/**
 * Column count for a viewport width: 1–2 on phones, 4 on tablets and desktop.
 *
 * Three columns is deliberately skipped. The size presets span 1–4 columns, so
 * on a 3-column grid the default M (span 2) leaves a third of every row empty
 * and nothing can fill it. Even counts let S, M and XL tile exactly.
 */
export function columnsForWidth(width: number): number {
  if (width < 360) return 1;
  if (width < 700) return 2;
  return 4;
}

/** How many columns a size preset wants, before clamping to what is available. */
export function preferredSpanForSize(size: WidgetSize): number {
  switch (size) {
    case 'S':
      return 1;
    case 'M':
      return 2;
    case 'L':
      return 3;
    case 'XL':
      return 4;
  }
}

/** Columns a widget actually occupies, never wider than the grid. */
export function spanForSize(size: WidgetSize, columns: number): number {
  return Math.min(preferredSpanForSize(size), Math.max(1, columns));
}

/** Card height in points. Taller presets give charts and tables room to breathe. */
export function heightForSize(size: WidgetSize): number {
  switch (size) {
    case 'S':
      return 132;
    case 'M':
      return 172;
    case 'L':
      return 232;
    case 'XL':
      return 296;
  }
}

/** Width as a percentage of the grid, for flex-basis. */
export function widthPercentForSize(size: WidgetSize, columns: number): number {
  const safeColumns = Math.max(1, columns);
  return (spanForSize(size, safeColumns) / safeColumns) * 100;
}

/** Cycle through presets when the user taps the resize control. */
export function nextSize(size: WidgetSize): WidgetSize {
  const index = WIDGET_SIZES.indexOf(size);
  return WIDGET_SIZES[(index + 1) % WIDGET_SIZES.length];
}

/**
 * Row height, in points — the unit `WidgetInstance.h` counts.
 *
 * The reference's grid derives this from the viewport so a windowful of rows always fills it
 * exactly (ref §7.4); that arrives with the real grid in M15. Until then it is a constant, chosen
 * so the catalog's declared heights (3 and 4 rows) land close to the M8 presets they replace —
 * a 3-row chart at 172pt, a 4-row table at 232pt.
 */
export const GRID_ROW_HEIGHT = 58;

/** Card height in points for a footprint of `h` rows. */
export function heightForRows(rows: number): number {
  return Math.max(1, Math.round(rows)) * GRID_ROW_HEIGHT;
}

/** Columns a footprint of `w` occupies, never more than the grid has. */
export function spanForWidth(w: number, columns: number): number {
  return Math.min(Math.max(1, Math.round(w)), Math.max(1, columns));
}

/** Width as a percentage of the grid, for flex-basis. */
export function widthPercentForSpan(w: number, columns: number): number {
  const safeColumns = Math.max(1, columns);
  return (spanForWidth(w, safeColumns) / safeColumns) * 100;
}
