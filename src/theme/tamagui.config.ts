import { defaultConfig } from '@tamagui/config/v5';
import { createFont, createTamagui } from 'tamagui';

import { accent, tokensFor, type ThemeMode, type TelemetryTokens } from './telemetry';

/**
 * App-wide Tamagui configuration, carrying the "Telemetry" design system.
 *
 * Two things live here rather than at call sites:
 *
 * 1. **Fonts.** The design is Space Grotesk for anything that reads as language
 *    and JetBrains Mono for anything that reads as a number — every metric, PID,
 *    command, timestamp and axis label. `$mono` is a first-class family for that
 *    reason, not a fallback.
 * 2. **Themes.** Tamagui's `bg` prop only accepts theme tokens, so the surfaces
 *    have to *be* tokens. The stock v5 dark/light themes are kept and extended
 *    rather than replaced, so stock components still find the ~237 keys they
 *    expect while the Telemetry surfaces sit alongside them.
 *
 * Anything that has to vary per *endpoint* (accent colours, chip skins) is
 * resolved at render time through `useTelemetry()` instead — a theme cannot know
 * which machine a widget is bound to.
 */

const spaceGrotesk = createFont({
  family: 'SpaceGrotesk_400Regular',
  size: defaultConfig.fonts.body.size,
  lineHeight: defaultConfig.fonts.body.lineHeight,
  weight: defaultConfig.fonts.body.weight,
  letterSpacing: defaultConfig.fonts.body.letterSpacing,
  face: {
    300: { normal: 'SpaceGrotesk_300Light' },
    400: { normal: 'SpaceGrotesk_400Regular' },
    500: { normal: 'SpaceGrotesk_500Medium' },
    600: { normal: 'SpaceGrotesk_600SemiBold' },
    700: { normal: 'SpaceGrotesk_700Bold' },
  },
});

const jetBrainsMono = createFont({
  family: 'JetBrainsMono_400Regular',
  size: defaultConfig.fonts.body.size,
  lineHeight: defaultConfig.fonts.body.lineHeight,
  weight: defaultConfig.fonts.body.weight,
  letterSpacing: defaultConfig.fonts.body.letterSpacing,
  face: {
    400: { normal: 'JetBrainsMono_400Regular' },
    500: { normal: 'JetBrainsMono_500Medium' },
    600: { normal: 'JetBrainsMono_600SemiBold' },
    700: { normal: 'JetBrainsMono_700Bold' },
  },
});

/** The Telemetry surfaces and text roles, as Tamagui theme keys. */
function telemetryThemeKeys(mode: ThemeMode) {
  const t: TelemetryTokens = tokensFor(mode);
  const lime = accent(mode, 'lime');

  return {
    // Stock keys, repointed at Telemetry values so unstyled components land in
    // the right place instead of on Tamagui's default greys.
    background: t.bg.widget[1],
    backgroundHover: t.bg.widget[0],
    backgroundPress: t.bg.track,
    backgroundFocus: t.bg.widget[0],
    color: t.text.primary,
    colorHover: t.text.primary,
    colorPress: t.text.secondary,
    colorFocus: t.text.primary,
    borderColor: t.border.widget,
    borderColorHover: t.border.widgetRaised,
    borderColorPress: t.border.widgetRaised,
    borderColorFocus: t.border.widgetRaised,
    placeholderColor: t.text.faint,

    // Telemetry surfaces.
    appBg: t.bg.app,
    chromeBg: t.bg.chrome[1],
    chromeBgTop: t.bg.chrome[0],
    railBg: t.bg.rail,
    widgetBg: t.bg.widget[1],
    widgetBgTop: t.bg.widget[0],
    trackBg: t.bg.track,
    sheetBg: t.bg.sheet,

    // Telemetry rules.
    hairline: t.border.hairline,
    gridline: t.border.gridline,
    rowBorder: t.border.row,
    chipBorder: t.border.chip,
    controlBorder: t.border.control,
    borderRaised: t.border.widgetRaised,
    chromeBorder: t.border.chrome,

    // Telemetry text. No greys: every one of these clears 4.5:1 on its surface,
    // which `telemetry.test.ts` asserts.
    textPrimary: t.text.primary,
    textStrong: t.text.strong,
    textSecondary: t.text.secondary,
    textTertiary: t.text.tertiary,
    textDim: t.text.dim,
    textFaint: t.text.faint,
    onAccent: t.text.onAccent,

    // The primary action accent. Per-endpoint accents come from `useTelemetry`.
    accent: lime.stroke,
    accentText: lime.text,
    accentFill: lime.fill,
  };
}

const themes = {
  ...defaultConfig.themes,
  dark: { ...defaultConfig.themes.dark, ...telemetryThemeKeys('dark') },
  light: { ...defaultConfig.themes.light, ...telemetryThemeKeys('light') },
};

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  fonts: {
    ...defaultConfig.fonts,
    body: spaceGrotesk,
    heading: spaceGrotesk,
    mono: jetBrainsMono,
  },
  themes,
});

export type AppTamaguiConfig = typeof tamaguiConfig;

declare module 'tamagui' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}
