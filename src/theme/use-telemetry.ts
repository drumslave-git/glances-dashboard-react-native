import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { usePreferencesStore } from '@/state/preferences';
import {
  accent as accentValues,
  accentForIndex,
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
  /** The reading-channel multiplier. Never apply it to a hero numeral. */
  scale: number;
  /** Reading-channel font size for a named role, floors already applied. */
  size: (role: TypeRole) => number;
  /** Letter-spacing for a named role, tracking its scaled size. */
  tracking: (role: TypeRole) => number;
  /** The accent a server is bound to, by its persisted `accentIndex`. */
  accentFor: (accentIndex: number) => AccentValues;
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

export function useTelemetry(): Telemetry {
  const mode = useThemeMode();
  const scale = usePreferencesStore((state) => state.readingScale);

  return useMemo(
    () => ({
      mode,
      t: tokensFor(mode),
      scale,
      size: (role: TypeRole) => roleSize(role, scale),
      tracking: (role: TypeRole) => roleLetterSpacing(role, scale),
      accentFor: (accentIndex: number) => accentForIndex(mode, accentIndex),
      accent: (name: AccentName) => accentValues(mode, name),
    }),
    [mode, scale],
  );
}
