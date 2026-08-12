import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { selectAppearance, usePreferencesStore } from '@/state/preferences';
import type { Appearance } from '@/theme/appearance';
import {
  accent as accentValues,
  tokensFor,
  type AccentName,
  type AccentValues,
  type TelemetryTokens,
  type ThemeMode,
} from '@/theme/telemetry';
import { roleLetterSpacing, roleSize, type TypeRole } from '@/utils/typeScale';

/**
 * The design system, resolved for the current theme and the user's reading
 * scale. One hook rather than a context provider: every input is already a
 * store or a platform hook, and a provider would only add a place to forget.
 */
export interface Telemetry {
  mode: ThemeMode;
  /** Surfaces, rules and text colours. */
  t: TelemetryTokens;
  /** The user's font-size multiplier. Display numerals apply it through `typeScale`'s clamps. */
  scale: number;
  /** Reading-channel font size for a named role, floors already applied. */
  size: (role: TypeRole) => number;
  /** Letter-spacing for a named role, tracking its scaled size. */
  tracking: (role: TypeRole) => number;
  /**
   * The accent an endpoint is bound to, by its persisted name.
   *
   * Takes a name rather than the old index: an endpoint's colour is now optional and named
   * (`GlancesEndpoint.color`), so callers decide what `null` means for them — identity elements
   * go colourless, a chart line falls back to the primary accent.
   */
  accentFor: (name: AccentName) => AccentValues;
  /** A metric-family accent by name — lime for CPU, cyan for network, amber for GPU. */
  accent: (name: AccentName) => AccentValues;
}

/** The resolved mode, following the system setting when the user chose 'system'. */
export function useThemeMode(): ThemeMode {
  const preference = usePreferencesStore((state) => state.theme);
  const system = useColorScheme();
  if (preference === 'system') return system === 'light' ? 'light' : 'dark';
  return preference;
}

/**
 * What the board is painted with.
 *
 * Nothing reads `preferences.appearance` directly. The editor writes the store on every change and
 * every surface in the app re-resolves from it — which is what makes the dashboard beside the
 * settings panel the live preview, with nothing to commit and nothing to keep in step.
 */
export function useAppearance(): Appearance {
  return usePreferencesStore(selectAppearance);
}

export function useTelemetry(): Telemetry {
  const mode = useThemeMode();
  const scale = useAppearance().interfaceScale;

  return useMemo(
    () => ({
      mode,
      t: tokensFor(mode),
      scale,
      size: (role: TypeRole) => roleSize(role, scale),
      tracking: (role: TypeRole) => roleLetterSpacing(role, scale),
      accentFor: (name: AccentName) => accentValues(mode, name),
      accent: (name: AccentName) => accentValues(mode, name),
    }),
    [mode, scale],
  );
}
