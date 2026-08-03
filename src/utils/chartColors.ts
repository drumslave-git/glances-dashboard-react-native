import { seriesColor, seriesPalette, tokensFor, type ThemeMode } from '@/theme/telemetry';

/**
 * Segment colours for the chart widgets.
 *
 * Originally a verbatim port of the reference app's fifteen saturated primaries,
 * hashed by field name. The Telemetry redesign replaced both halves of that:
 *
 * - **The palette** is now the design's own hue family (see `seriesPalette`).
 *   Mantine's `#be4bdb` and `#fa5252` on a near-black instrument surface read as
 *   noise, not as data.
 * - **Assignment is by position, not by hash.** Hashing gave a three-field chart
 *   three arbitrary — and sometimes identical — hues; the M3 notes recorded
 *   `used` and `free` colliding on `mem` as a known wart. Taking the palette in
 *   order means the first three fields get the three most distinct colours.
 *
 * An explicitly configured colour always wins over all of this.
 */

/** Names that mean "the part that is *not* in use". */
const REMAINDER_FIELDS = ['free', 'available', 'idle', 'remaining'];

/**
 * Names that mean "the part that *is* in use".
 *
 * The cpu plugin's busy fractions are here alongside the obvious ones, so a
 * donut of `user / system / iowait / idle` draws three busy slices against an
 * idle track — which is what that chart is actually about — rather than four
 * slices competing for attention.
 */
const CONSUMED_FIELDS = [
  'used',
  'active',
  'busy',
  'total',
  'user',
  'system',
  'iowait',
  'steal',
  'nice',
];

function isRemainder(name: string): boolean {
  return REMAINDER_FIELDS.includes(name.trim().toLowerCase());
}

function isConsumed(name: string): boolean {
  return CONSUMED_FIELDS.includes(name.trim().toLowerCase());
}

export function isValidHex(color: string | undefined | null): color is string {
  return typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color);
}

/** Palette swatches for the colour picker, in the current theme. */
export function chartPalette(mode: ThemeMode): readonly string[] {
  return seriesPalette(mode);
}

/**
 * Colours for a whole set of segments at once.
 *
 * Seeing every name together is what makes the two useful decisions possible:
 * assigning the palette in order, and recognising a used/free pair. In a
 * used-vs-free split the remainder takes the **track** colour rather than a
 * competing hue, so the chart reads the way the memory ring does — one accent
 * arc against a track — instead of as two rival slices.
 *
 * The remainder rule only applies when a consumed sibling is present: a chart of
 * `free` alone is about free space, and drawing it in the track colour would
 * make it invisible.
 */
export function assignSeriesColors(
  names: readonly string[],
  fieldColors: Record<string, string> | null | undefined,
  mode: ThemeMode,
): string[] {
  const tokens = tokensFor(mode);
  const hasPair = names.some(isConsumed) && names.some(isRemainder);

  // Only fields that actually take a palette entry advance the index, so a
  // track-coloured remainder does not leave a gap in the sequence.
  let next = 0;
  return names.map((name) => {
    const configured = fieldColors?.[name];
    if (isValidHex(configured)) return configured;
    if (hasPair && isRemainder(name)) return tokens.bg.track;
    const color = seriesColor(mode, next);
    next += 1;
    return color;
  });
}

/**
 * One field's colour, without the context of its siblings — the config screen's
 * per-field swatch, and anything that resolves a single segment.
 */
export function getFieldColor(
  fieldName: string,
  fieldColors: Record<string, string> | null | undefined,
  mode: ThemeMode,
): string {
  const configured = fieldColors?.[fieldName];
  if (isValidHex(configured)) return configured;
  return defaultColorForField(fieldName, mode);
}

/**
 * A stable default for a field with no position to go on. Still hashed, because
 * the alternative — always handing out palette[0] — would make every new field
 * in the config screen start out lime.
 */
export function defaultColorForField(fieldName: string, mode: ThemeMode): string {
  let hash = 0;
  for (let i = 0; i < fieldName.length; i++) {
    hash = (hash << 5) - hash + fieldName.charCodeAt(i);
    hash |= 0;
  }
  return seriesColor(mode, Math.abs(hash));
}

/** Initial colour for a newly selected field in the config UI. */
export function randomChartColor(mode: ThemeMode): string {
  const palette = seriesPalette(mode);
  return palette[Math.floor(Math.random() * palette.length)];
}
