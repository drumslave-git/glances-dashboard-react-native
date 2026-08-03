import type { WidgetSize } from '@/types/dashboard';

/**
 * Replaces the web app's 12-column drag grid. Widgets choose a size preset and
 * the grid decides how many columns fit the current window.
 */

export const WIDGET_SIZES: WidgetSize[] = ['S', 'M', 'L', 'XL'];

/** Column count for a viewport width: 1–2 on phones, 3–4 on tablets and desktop. */
export function columnsForWidth(width: number): number {
  if (width < 360) return 1;
  if (width < 700) return 2;
  if (width < 1100) return 3;
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
