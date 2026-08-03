/**
 * Ported verbatim from the reference web app (src/utils/chartColors.ts) so that
 * an existing dashboard keeps the same colours.
 */

/** Palette of hex colors for chart segments (deterministic default per field name). Exported for ColorPicker swatches. */
export const CHART_PALETTE = [
  '#228be6', '#20c997', '#fd7e14', '#be4bdb', '#fa5252',
  '#40c057', '#fab005', '#e64980', '#7950f2', '#15aabf',
  '#868e96', '#2f9e44', '#f76707', '#5c7cfa', '#cc5de8',
];

/** Deterministic default color for a field name (no config). */
export function defaultColorForField(fieldName: string): string {
  let hash = 0;
  for (let i = 0; i < fieldName.length; i++) {
    hash = ((hash << 5) - hash) + fieldName.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CHART_PALETTE.length;
  return CHART_PALETTE[index];
}

/** Resolve segment color: use configured or deterministic default. */
export function getFieldColor(fieldName: string, fieldColors?: Record<string, string> | null): string {
  const configured = fieldColors?.[fieldName];
  if (configured && /^#[0-9A-Fa-f]{6}$/.test(configured)) return configured;
  return defaultColorForField(fieldName);
}

/** Random hex color for when a new field is first selected (used in config UI). */
export function randomChartColor(): string {
  return CHART_PALETTE[Math.floor(Math.random() * CHART_PALETTE.length)];
}
