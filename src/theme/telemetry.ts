/**
 * The "Telemetry" design system, ported from the redesign handoff.
 *
 * Two token sets — `2a` dark and `2b` light — that are the *same* system:
 * identical layout, type scale and component anatomy, different values. Nothing
 * in this file is platform-specific, so it stays pure TS and unit tested; the
 * contrast floor in particular is enforced by `telemetry.test.ts` rather than by
 * eyeballing screenshots.
 *
 * Hard rule from the handoff, worth repeating where it will be read: **there is
 * no grey text in this design.** Every text colour clears 4.5:1 against its
 * surface. Hierarchy comes from size, weight, letter-spacing and accent colour —
 * never from fading text toward the background.
 */

export type ThemeMode = 'dark' | 'light';

/** Named accents. One hue per metric family, re-used as the endpoint palette. */
export type AccentName = 'lime' | 'cyan' | 'amber';

/** Surfaces the design specifies as two-stop gradients. */
export type Gradient = readonly [string, string];

export interface TelemetryTokens {
  mode: ThemeMode;
  bg: {
    /** Window background behind the grid. */
    app: string;
    /** Toolbar. */
    chrome: Gradient;
    /** Summary strip. */
    rail: string;
    /** Widget surface. */
    widget: Gradient;
    /** Meter and bar tracks. */
    track: string;
    /** Sheets and dialogs — the widget surface, flattened. */
    sheet: string;
  };
  border: {
    /** Widget border, 1px. */
    widget: string;
    /** One step up, for the pressed/hovered widget. */
    widgetRaised: string;
    /** Toolbar and rail dividers. */
    chrome: string;
    /** In-widget separators. */
    hairline: string;
    /** Chart gridlines — a touch brighter than a hairline. */
    gridline: string;
    /** Table row separators. */
    row: string;
    /** Generic chip outline. */
    chip: string;
    /** Outlined button. */
    control: string;
  };
  text: {
    /** Hero numbers, body. */
    primary: string;
    /** Secondary metric values. */
    strong: string;
    /** Widget labels, meter labels. */
    secondary: string;
    /** Units, footer readouts. */
    tertiary: string;
    /** Micro-labels, PIDs. */
    dim: string;
    /** Axis ticks, the overflow glyph — the floor, never dimmer. */
    faint: string;
    /** Text on a filled accent button. */
    onAccent: string;
  };
  chart: {
    /** Dashed rule at the newest sample. */
    marker: string;
    /** Mirrored chart's centre baseline. */
    baseline: string;
    /** Ring gauge bezel ticks. */
    bezel: string;
    /** Per-process trend sparkline. */
    spark: string;
  };
  /** CPU/GPU meter fill. A real gradient in dark, flat in light. */
  meterFill: Gradient;
  /** Six thermal histogram bars, by band. */
  thermalBands: readonly [string, string, string, string, string, string];
}

const DARK: TelemetryTokens = {
  mode: 'dark',
  bg: {
    app: '#07080a',
    chrome: ['#0d1011', '#0a0c0d'],
    rail: '#090b0c',
    widget: ['#0e1112', '#0b0d0e'],
    track: '#171b1c',
    sheet: '#0d1011',
  },
  border: {
    widget: '#1c2022',
    widgetRaised: '#262b2d',
    chrome: '#191d1e',
    hairline: '#15181a',
    gridline: '#191d1e',
    row: '#131616',
    chip: '#202524',
    control: '#22282a',
  },
  text: {
    primary: '#f4f7ef',
    strong: '#f4f7ef',
    secondary: '#dbe2d6',
    tertiary: '#c2cabf',
    dim: '#adb6ae',
    faint: '#9aa39c',
    onAccent: '#07080a',
  },
  chart: {
    marker: '#3d4a2b',
    baseline: '#1c2021',
    bezel: '#1a1e1f',
    spark: '#5e8a2e',
  },
  meterFill: ['#5e8a2e', '#b6f24a'],
  thermalBands: ['#2a2f26', '#4a5c2c', '#8fbf3f', '#d9a13c', '#4a5c2c', '#2a2f26'],
};

const LIGHT: TelemetryTokens = {
  mode: 'light',
  bg: {
    app: '#eceae4',
    chrome: ['#fbfaf8', '#fbfaf8'],
    rail: '#f7f5f0',
    widget: ['#fbfaf8', '#fbfaf8'],
    track: '#e9e6dd',
    sheet: '#fbfaf8',
  },
  border: {
    widget: '#e2dfd6',
    widgetRaised: '#d6d3ca',
    chrome: '#d6d3ca',
    hairline: '#eae7de',
    gridline: '#e7e4db',
    row: '#f0ede5',
    chip: '#e2dfd6',
    control: '#d6d3ca',
  },
  text: {
    primary: '#15171a',
    strong: '#22242a',
    secondary: '#3a382f',
    tertiary: '#46443d',
    dim: '#525049',
    faint: '#57554d',
    onAccent: '#fbfaf8',
  },
  chart: {
    marker: '#c3cdb0',
    baseline: '#e2dfd6',
    bezel: '#e0ddd4',
    spark: '#8ba85e',
  },
  // Flat in light: the bright dark-mode lime is a stroke/fill colour only.
  meterFill: ['#3c6610', '#3c6610'],
  thermalBands: ['#ddd9cd', '#b9c79b', '#7fa53c', '#a06a12', '#b9c79b', '#ddd9cd'],
};

export const TELEMETRY_TOKENS: Record<ThemeMode, TelemetryTokens> = {
  dark: DARK,
  light: LIGHT,
};

export function tokensFor(mode: ThemeMode): TelemetryTokens {
  return TELEMETRY_TOKENS[mode];
}

/**
 * Accent values per mode.
 *
 * `stroke` is the value for strokes and fills; `text` is the value that is safe
 * to *print* — in light mode the two differ, because the bright dark-mode accents
 * fail the contrast floor as text on a bone-white surface.
 */
export interface AccentValues {
  stroke: string;
  text: string;
  /**
   * The accent as a solid *fill* under `text.onAccent` — the primary action
   * button, the logo tile. It parts company with `stroke` in light mode, where a
   * fill bright enough to read as lime cannot also carry white text at 4.5:1.
   */
  fill: string;
  /** Endpoint chip skin. */
  chip: { text: string; border: string; bg: string };
}

const ACCENT_VALUES: Record<ThemeMode, Record<AccentName, AccentValues>> = {
  dark: {
    lime: {
      stroke: '#b6f24a',
      text: '#b6f24a',
      fill: '#b6f24a',
      chip: { text: '#a8d95e', border: '#23301f', bg: '#0e1310' },
    },
    cyan: {
      stroke: '#58aec9',
      text: '#58aec9',
      fill: '#58aec9',
      chip: { text: '#6fb8d0', border: '#1c2a30', bg: '#0d1215' },
    },
    amber: {
      stroke: '#d9a13c',
      text: '#d9a13c',
      fill: '#d9a13c',
      chip: { text: '#cf9c3d', border: '#2e2618', bg: '#14110c' },
    },
  },
  light: {
    lime: {
      stroke: '#4e831a',
      text: '#3c6610',
      // The handoff's own light logo tile, and the only lime that carries
      // `#fbfaf8` at 4.5:1 — `#4e831a` reaches 4.39 and is a stroke colour only.
      fill: '#3f6b12',
      chip: { text: '#3f6b12', border: '#d3ddc0', bg: '#f1f6e6' },
    },
    cyan: {
      stroke: '#1d6f8b',
      text: '#1d6f8b',
      fill: '#1d6f8b',
      chip: { text: '#1d6f8b', border: '#c4dae2', bg: '#eef6f9' },
    },
    amber: {
      stroke: '#a06a12',
      text: '#7d520c',
      fill: '#7d520c',
      chip: { text: '#8a5a0e', border: '#e4d6b8', bg: '#faf3e4' },
    },
  },
};

/** Assignment order for endpoints, cycling when there are more than three. */
export const ACCENT_ORDER: readonly AccentName[] = ['lime', 'cyan', 'amber'];

/** Endpoints store an index rather than a colour, so a theme switch re-resolves. */
export function accentNameForIndex(accentIndex: number): AccentName {
  const length = ACCENT_ORDER.length;
  // Negative and fractional indices come from persisted data, which is user data.
  const safe = Number.isFinite(accentIndex) ? Math.trunc(accentIndex) : 0;
  return ACCENT_ORDER[((safe % length) + length) % length];
}

export function accent(mode: ThemeMode, name: AccentName): AccentValues {
  return ACCENT_VALUES[mode][name];
}

export function accentForIndex(mode: ThemeMode, accentIndex: number): AccentValues {
  return accent(mode, accentNameForIndex(accentIndex));
}

/** Geometry, in points. The handoff's pixel values map 1:1 onto RN points. */
export const GEOMETRY = {
  radius: {
    window: 7,
    widget: 5,
    control: 4,
    chip: 3,
    pill: 999,
    bar: 3,
  },
  /** 11px gutter, 15px padding around the grid. */
  gridGap: 11,
  gridPadding: 15,
  widgetPadding: { top: 15, right: 17, bottom: 11, left: 17 },
  toolbarHeight: 56,
  toolbarPaddingX: 18,
  summaryCellPadding: { vertical: 12, horizontal: 18 },
  /** Hard minimum widget box. */
  minWidget: { width: 260, height: 150 },
  /** Below this diameter the ring gauge degrades to a horizontal bar. */
  minRingDiameter: 72,
  /** Track heights. */
  meterTrack: 5,
  processCpuTrack: 4,
} as const;

/**
 * Motion durations, in milliseconds. Deliberately sparse — the handoff specifies
 * mount-only draw-ins plus one breathing halo, and nothing else.
 */
export const MOTION = {
  chartDrawIn: 1800,
  ringDrawIn: 1600,
  markerBreathe: 2200,
  /** cubic-bezier(.2,.8,.2,1) */
  easing: [0.2, 0.8, 0.2, 1] as const,
} as const;

/* ------------------------------------------------------------------ *
 * Contrast
 *
 * The handoff makes 4.5:1 a hard requirement rather than a guideline, so the
 * maths lives here and the token table is checked against it in the tests.
 * ------------------------------------------------------------------ */

/** Parse `#rgb` or `#rrggbb` into 0–255 channels. Throws on anything else. */
export function parseHex(hex: string): [number, number, number] {
  const value = hex.trim().replace(/^#/, '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a hex colour: ${hex}`);
  }
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * `rgba(accent, .26)` — the chart area fills. Written out rather than relying on
 * `#rrggbbaa`, which Skia accepts but React Native's colour parser does not
 * handle consistently across platforms.
 */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

/** WCAG relative luminance. */
export function relativeLuminance(hex: string): number {
  const channels = parseHex(hex).map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Worst-case contrast against a gradient surface: both stops are on screen, so
 * the floor has to hold for whichever stop is least favourable.
 */
export function contrastAgainstSurface(text: string, surface: string | Gradient): number {
  if (typeof surface === 'string') return contrastRatio(text, surface);
  return Math.min(contrastRatio(text, surface[0]), contrastRatio(text, surface[1]));
}

/** The floor every text colour in this design must clear. */
export const CONTRAST_FLOOR = 4.5;
