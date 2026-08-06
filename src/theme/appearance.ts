/**
 * The appearance model: the layer of the design the **user** owns (ref §7.6).
 *
 * The Telemetry tokens decide what the app looks like; this decides what the user is allowed to
 * change about it — the canvas and panel colours, the spacing and corners of a widget, the size of
 * the reading channel, and whether widget headers are on show.
 *
 * Three rules run through it, and they are the reference's:
 *
 * - **Every colour is themed and translucent.** A single hex would be wrong in one of the two
 *   schemes, so both halves are always stored, each with its own alpha. Alpha is not a separate
 *   "transparency" setting — it is part of the colour, which is what lets a translucent widget
 *   blend over the grid and a translucent grid blend over the desktop.
 * - **Every size belongs to the display channel.** The reference writes them in `rem` so they track
 *   its font scale; React Native has no `rem`, and this app has already ruled that widget geometry
 *   must not follow the user's text setting (M8) — a 46pt hero inside a 450pt card is what that
 *   rule exists to prevent. So sizes are points the user sets directly, and the interface scale
 *   moves the reading channel alone.
 * - **Parsed per key.** One unreadable field falls back on its own rather than resetting the whole
 *   theme, and a key added by a later version fills in from the defaults.
 */
import { z } from 'zod';

import { GEOMETRY, tokensFor, type ThemeMode } from '@/theme/telemetry';
import { clampReadingScale, READING_SCALE_DEFAULT } from '@/utils/typeScale';

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #rrggbb colour')
  // Stored values are compared as strings, so one casing avoids pointless "changed" diffs.
  .transform((value) => value.toLowerCase());

/** One scheme's half of a themed colour: an opaque hex plus its own opacity. */
export const colorStopSchema = z.object({
  color: hex,
  alpha: z.number().min(0).max(1),
});
export type ColorStop = z.infer<typeof colorStopSchema>;

export const themedColorSchema = z.object({
  light: colorStopSchema,
  dark: colorStopSchema,
});
export type ThemedColor = z.infer<typeof themedColorSchema>;

/** A size in points, clamped so a stray value cannot make the dashboard unusable. */
const size = (max: number) => z.number().min(0).max(max);

export const borderSchema = z.object({
  /** Points — `0` means no border at all. */
  width: size(6),
  color: themedColorSchema,
});
export type BorderAppearance = z.infer<typeof borderSchema>;

export const appearanceSchema = z.object({
  /**
   * The reading channel's multiplier — labels, chips, table rows, footers, axis ticks. Never hero
   * numerals or gauge centres, which size off their widget box (`utils/typeScale.ts`).
   */
  interfaceScale: z.number().min(0.5).max(3),
  /** Behind the grid, over the window background. */
  gridBackground: themedColorSchema,
  /** Default for every widget card; one widget may override it. */
  widgetBackground: themedColorSchema,
  /** Points — widget corner radius. */
  widgetRadius: size(24),
  /** Points — one value: the gap between cells *and* the surround, which must not drift apart. */
  gridGap: size(40),
  /** Points — the inner padding of a widget's header and body. */
  widgetPadding: size(40),
  widgetBorder: borderSchema,
  /**
   * Headers leave the panel the way the toolbar leaves the board in full screen: an endpoint-
   * coloured corner mark keeps the widget identifiable and brings the header back on demand. Edit
   * mode ignores it — the header is what a widget is dragged and configured by.
   */
  hideWidgetHeaders: z.boolean(),
});
export type Appearance = z.infer<typeof appearanceSchema>;

/**
 * The defaults **are** the design's own surfaces and metrics — this is what a fresh install looks
 * like, so they are read from the tokens rather than copied beside them.
 *
 * Both colours are fully opaque. Alpha is where the desktop window's transparency becomes visible,
 * and a dashboard that shipped translucent would look broken on a compositor that cannot honour it
 * — so translucency is offered, not assumed.
 */
export const DEFAULT_APPEARANCE: Appearance = {
  interfaceScale: READING_SCALE_DEFAULT,
  gridBackground: {
    light: { color: tokensFor('light').bg.app, alpha: 1 },
    dark: { color: tokensFor('dark').bg.app, alpha: 1 },
  },
  widgetBackground: {
    // The widget surface is a two-stop gradient in the design. The default records its *end*
    // colour and `widgetSurface` keeps the gradient while the value is untouched — see there.
    light: { color: tokensFor('light').bg.widget[1], alpha: 1 },
    dark: { color: tokensFor('dark').bg.widget[1], alpha: 1 },
  },
  widgetRadius: GEOMETRY.radius.widget,
  gridGap: GEOMETRY.gridGap,
  widgetPadding: GEOMETRY.widgetPadding.left,
  widgetBorder: {
    width: 1,
    color: {
      light: { color: tokensFor('light').border.hairline, alpha: 1 },
      dark: { color: tokensFor('dark').border.hairline, alpha: 1 },
    },
  },
  hideWidgetHeaders: false,
};

/** Per-widget overrides. `null` means "inherit the global value". */
export const widgetAppearanceSchema = z.object({
  background: themedColorSchema.nullable(),
});
export type WidgetAppearance = z.infer<typeof widgetAppearanceSchema>;

export const DEFAULT_WIDGET_APPEARANCE: WidgetAppearance = { background: null };

/** The keys the editor offers, in the order it offers them. */
export const APPEARANCE_KEYS = [
  'interfaceScale',
  'gridBackground',
  'widgetBackground',
  'widgetRadius',
  'gridGap',
  'widgetPadding',
  'widgetBorder',
  'hideWidgetHeaders',
] as const satisfies readonly (keyof Appearance)[];

export type AppearanceKey = (typeof APPEARANCE_KEYS)[number];

/**
 * Parse stored appearance **per key**, so one unreadable field falls back on its own instead of
 * resetting the whole theme — the same tolerance a widget config gets.
 */
export function parseAppearance(raw: unknown): Appearance {
  const source: Record<string, unknown> =
    raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const merged: Appearance = { ...DEFAULT_APPEARANCE };
  for (const [key, schema] of Object.entries(appearanceSchema.shape)) {
    const parsed = schema.safeParse(source[key]);
    if (parsed.success) (merged as Record<string, unknown>)[key] = parsed.data;
  }
  // The scale has floors of its own, and they are the ones the type scale enforces.
  merged.interfaceScale = clampReadingScale(merged.interfaceScale);
  return merged;
}

export function parseWidgetAppearance(raw: unknown): WidgetAppearance {
  const parsed = widgetAppearanceSchema.safeParse(raw ?? DEFAULT_WIDGET_APPEARANCE);
  return parsed.success ? parsed.data : { ...DEFAULT_WIDGET_APPEARANCE };
}

/** `true` when a widget's appearance carries nothing worth storing. */
export function isDefaultWidgetAppearance(value: WidgetAppearance | null | undefined): boolean {
  return !value || value.background === null;
}

export function sameThemedColor(a: ThemedColor, b: ThemedColor): boolean {
  return (['light', 'dark'] as const).every(
    (scheme) => a[scheme].color === b[scheme].color && a[scheme].alpha === b[scheme].alpha,
  );
}

/** Whether one setting still holds its default — what greys out its own reset button. */
export function isDefaultAppearanceKey(appearance: Appearance, key: AppearanceKey): boolean {
  const value = appearance[key];
  const fallback = DEFAULT_APPEARANCE[key];
  if (key === 'widgetBorder') {
    const a = value as BorderAppearance;
    const b = fallback as BorderAppearance;
    return a.width === b.width && sameThemedColor(a.color, b.color);
  }
  if (typeof value === 'object' && value !== null) {
    return sameThemedColor(value as ThemedColor, fallback as ThemedColor);
  }
  return value === fallback;
}

export function isDefaultAppearance(appearance: Appearance): boolean {
  return APPEARANCE_KEYS.every((key) => isDefaultAppearanceKey(appearance, key));
}

/** `#rrggbb` + alpha → the `rgba()` string React Native understands on every platform. */
export function cssColor({ color, alpha }: ColorStop): string {
  const value = Number.parseInt(color.slice(1), 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  // An opaque colour stays a plain hex: it is what every screenshot and test already expects, and
  // `rgba(…, 1)` would only be a longer way of saying the same thing.
  return alpha >= 1 ? color : `rgba(${r}, ${g}, ${b}, ${round(alpha)})`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function colorFor(color: ThemedColor, mode: ThemeMode): string {
  return cssColor(color[mode]);
}

/** Whether anything the user can see through is actually translucent. */
export function hasTranslucency(appearance: Appearance, widgets: (WidgetAppearance | null)[] = []): boolean {
  const stops = [
    appearance.gridBackground,
    appearance.widgetBackground,
    appearance.widgetBorder.color,
    ...widgets.flatMap((entry) => (entry?.background ? [entry.background] : [])),
  ];
  return stops.some((color) => color.light.alpha < 1 || color.dark.alpha < 1);
}

/**
 * The two stops a widget card is painted with.
 *
 * The design's panel is a **gradient**, and losing it the moment someone opens the appearance tab
 * would be a downgrade nobody asked for — so an untouched `widgetBackground` keeps the gradient and
 * any other value paints flat. A flat fill is expressed as the same colour twice rather than as a
 * second code path, so the surface component stays one component.
 */
export function widgetSurface(
  appearance: Appearance,
  mode: ThemeMode,
  override?: ThemedColor | null,
): readonly [string, string] {
  const color = override ?? appearance.widgetBackground;
  if (!override && sameThemedColor(color, DEFAULT_APPEARANCE.widgetBackground)) {
    return tokensFor(mode).bg.widget;
  }
  const resolved = colorFor(color, mode);
  return [resolved, resolved];
}
