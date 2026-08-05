/**
 * The two font-size channels of the Telemetry design, plus the degrade ladders
 * that decide what a widget drops when it stops fitting.
 *
 * **Font scaling has two channels, and mixing them is what broke the first
 * implementation of this design.**
 *
 * - The *reading* channel — labels, chips, table rows, footers, axis ticks —
 *   scales with the user's font-size setting.
 * - The *display* channel — hero numerals and gauge centre values — sizes off the
 *   **widget box** and ignores the user's setting entirely. A 46pt hero
 *   multiplied to ~90pt inside a 450pt card is what makes the board fall apart.
 *
 * The web original expressed the display channel with `clamp()` over container
 * queries. React Native has neither, so every breakpoint here is a function of a
 * measured box — which is the same idea, and happens to be easier to test.
 */

/** Widget size classes. Measured on the widget, never on the window. */
export type WidgetSizeClass = 'compact' | 'regular' | 'wide';

/** compact < 300 · regular 300–520 · wide > 520. */
export function sizeClassForWidth(width: number): WidgetSizeClass {
  if (width < 300) return 'compact';
  if (width <= 520) return 'regular';
  return 'wide';
}

/**
 * Below this a panel has no room for a body worth the name, whatever its width (ref §7.4).
 *
 * It sits in the dead band between the two-row footprint's tallest stretch and the three-row
 * minimum. Dead bands are what stop a widget flickering between presentations as it is resized.
 */
export const SHORT_BELOW_PX = 200;

/**
 * The measured size mode: a **width** tier and an independent **height** flag.
 *
 * `short` composes with any tier rather than being a fourth tier, because the two axes degrade
 * different things — width sheds chips and columns, height sheds the body. A chart at
 * `wide + short` is still wide in every respect except that it has become a pulse strip.
 */
export interface SizeMode {
  tier: WidgetSizeClass;
  short: boolean;
}

export function sizeModeFor(width: number, height: number): SizeMode {
  return { tier: sizeClassForWidth(width), short: height < SHORT_BELOW_PX };
}

/** User font-size multiplier bounds. Wider than this stops being legible either way. */
export const READING_SCALE_MIN = 0.85;
export const READING_SCALE_MAX = 1.6;
export const READING_SCALE_DEFAULT = 1;

export function clampReadingScale(scale: number): number {
  if (!Number.isFinite(scale)) return READING_SCALE_DEFAULT;
  return Math.min(READING_SCALE_MAX, Math.max(READING_SCALE_MIN, scale));
}

/**
 * Reading-channel size: the base size times the user's multiplier, never below
 * `min`. The handoff's floors are 11pt for metric type and 9pt for micro-labels,
 * which is what `TYPE.*.min` encodes.
 */
export function readingSize(base: number, scale: number, min = 0): number {
  const scaled = base * clampReadingScale(scale);
  return Math.round(Math.max(min, scaled) * 10) / 10;
}

/** The named reading-channel roles, with their bases and floors. */
export const TYPE = {
  /** Section/widget labels: 10pt, 600, .18em, uppercase. */
  label: { size: 10, min: 9, letterSpacing: 1.8, weight: '600' },
  /** Micro-labels (PEAK, AVG, THREADS, column heads): 9pt, .16em, uppercase. */
  micro: { size: 9, min: 9, letterSpacing: 1.44, weight: '600' },
  /** Chips. */
  chip: { size: 9, min: 9, letterSpacing: 0.9, weight: '500' },
  /** Metric values that are not the hero — meter values, key/value rows. */
  metric: { size: 12, min: 11, letterSpacing: 0, weight: '500' },
  /** Summary strip and secondary readouts. */
  readout: { size: 13.5, min: 11, letterSpacing: 0, weight: '500' },
  /** Table rows. */
  row: { size: 11.5, min: 11, letterSpacing: 0, weight: '400' },
  /** Footer one-liners. */
  footer: { size: 9.5, min: 9, letterSpacing: 0, weight: '400' },
  /** Chart axis ticks. */
  axis: { size: 9, min: 9, letterSpacing: 0, weight: '400' },
  /** Device line under a widget header. */
  device: { size: 10, min: 9, letterSpacing: 0, weight: '400' },
} as const;

export type TypeRole = keyof typeof TYPE;

export function roleSize(role: TypeRole, scale: number): number {
  const spec = TYPE[role];
  return readingSize(spec.size, scale, spec.min);
}

/**
 * Letter-spacing is part of how this design expresses hierarchy without fading
 * text, so it tracks the scaled size rather than staying at its base value.
 */
export function roleLetterSpacing(role: TypeRole, scale: number): number {
  const spec = TYPE[role];
  if (spec.letterSpacing === 0) return 0;
  return Math.round((spec.letterSpacing * (roleSize(role, scale) / spec.size)) * 100) / 100;
}

function clamp(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/* ------------------------------------------------------------------ *
 * Display channel — sizes off the box, never off the user's setting.
 * ------------------------------------------------------------------ */

/** Hero numeral: `clamp(26, 10cqw, 46)`. */
export function heroFontSize(widgetWidth: number): number {
  return Math.round(clamp(26, widgetWidth * 0.1, 46));
}

/** The unit rides the hero at the handoff's 19/46 ratio. */
export function heroUnitFontSize(widgetWidth: number): number {
  return Math.round(heroFontSize(widgetWidth) * (19 / 46));
}

/** Secondary display numerals (network throughput): 26 at the reference width. */
export function statFontSize(widgetWidth: number): number {
  return Math.round(clamp(18, widgetWidth * 0.062, 26));
}

export function statUnitFontSize(widgetWidth: number): number {
  return Math.round(clamp(9, statFontSize(widgetWidth) * (12 / 26), 12));
}

/** Ring gauge centre value: 32 inside the reference 158pt ring. */
export function gaugeValueFontSize(diameter: number): number {
  return Math.round(clamp(15, diameter * (32 / 158), 32));
}

export function gaugeUnitFontSize(diameter: number): number {
  return Math.round(clamp(9, gaugeValueFontSize(diameter) * (15 / 32), 15));
}

/* ------------------------------------------------------------------ *
 * Degrade ladders
 * ------------------------------------------------------------------ */

/**
 * Header ladder: full label + endpoint chip + state chips → state chips move
 * into the ⋮ menu → the endpoint chip becomes a bare colour dot.
 *
 * The endpoint chip never truncates and is the last thing to go, because it is
 * the only thing identifying which machine the number came from.
 */
export type HeaderRung = 'full' | 'chip' | 'dot';

export function headerRung(sizeClass: WidgetSizeClass): HeaderRung {
  switch (sizeClass) {
    case 'wide':
      return 'full';
    case 'regular':
      return 'chip';
    case 'compact':
      return 'dot';
  }
}

/**
 * Chart ladder: full (grid + axis + marker) → grid only → bare sparkline →
 * 3pt pulse strip → removed.
 *
 * Height decides first: a chart with no room is a pulse strip whatever the
 * width. The handoff's `min-height: 48px` for the chart flex child is the line
 * between a sparkline and a pulse.
 */
export type ChartRung = 'full' | 'grid' | 'sparkline' | 'pulse' | 'none';

export function chartRung(
  sizeClass: WidgetSizeClass,
  availableHeight: number,
): ChartRung {
  if (availableHeight < 10) return 'none';
  if (availableHeight < 34) return 'pulse';
  if (availableHeight < 48 || sizeClass === 'compact') return 'sparkline';
  if (sizeClass === 'regular') return 'grid';
  return 'full';
}

/** Hero stat cluster: inline beside the hero → a single footer line → dropped. */
export type StatClusterRung = 'inline' | 'footer' | 'none';

export function statClusterRung(
  sizeClass: WidgetSizeClass,
  availableHeight: number,
): StatClusterRung {
  if (availableHeight < 24) return 'none';
  return sizeClass === 'wide' ? 'inline' : 'footer';
}

/** Meters: label above track → single inline row → label + value only. */
export type MeterRung = 'stacked' | 'inline' | 'value';

/**
 * A stacked meter needs roughly 30pt per entry (label line, track, gap); an
 * inline one about 18pt. Below that the track is dropped and only the numbers
 * remain, which the handoff prefers to a track too short to read.
 */
export function meterRung(count: number, availableHeight: number): MeterRung {
  if (count <= 0) return 'value';
  const per = availableHeight / count;
  if (per >= 30) return 'stacked';
  if (per >= 18) return 'inline';
  return 'value';
}

/**
 * Ring gauge diameter for a box, or `null` when the ring should become a
 * horizontal bar instead. The handoff's floor is 72pt.
 */
export function ringDiameter(width: number, height: number): number | null {
  // The value below the ring and the bezel both need room, hence the insets.
  const diameter = Math.floor(Math.min(width - 16, height - 8));
  if (diameter < 72) return null;
  return Math.min(diameter, 158);
}

/**
 * Table columns, dropped by priority as width runs out. The handoff's priorities
 * are PID(1) COMMAND(1) CPU(1) MEM(2) TREND(3) TIME(4), and the rule is
 * absolute: **never horizontal-scroll**, so priority-1 columns survive even when
 * they overflow.
 */
export interface TableColumn {
  key: string;
  priority: number;
  width: number;
}

export function visibleColumns(columns: TableColumn[], availableWidth: number): TableColumn[] {
  const essential = columns.filter((column) => column.priority <= 1);
  let used = essential.reduce((total, column) => total + column.width, 0);

  const optional = [...columns.filter((column) => column.priority > 1)].sort(
    (a, b) => a.priority - b.priority,
  );
  const kept = new Set(essential.map((column) => column.key));
  for (const column of optional) {
    if (used + column.width > availableWidth) break;
    used += column.width;
    kept.add(column.key);
  }

  // Preserve the caller's column order rather than the priority order.
  return columns.filter((column) => kept.has(column.key));
}

/**
 * How many rows fit without cutting one in half. A widget must never grow an
 * internal scrollbar or show a partial row.
 */
export function fittingRowCount(availableHeight: number, rowHeight: number, max = 8): number {
  if (rowHeight <= 0) return 0;
  return Math.max(0, Math.min(max, Math.floor(availableHeight / rowHeight)));
}
