import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  DEFAULT_APPEARANCE,
  parseAppearance,
  type Appearance,
  type AppearanceKey,
} from '@/theme/appearance';
import { clampReadingScale } from '@/utils/typeScale';

import { asyncStorageJSON, STORAGE_KEYS } from './storage';

/**
 * Display preferences. **Persisted**, unlike the transient chrome state in `ui.ts`: a theme or a
 * font size the user chose should survive a restart, where edit mode and full screen deliberately
 * do not.
 */
export type ThemePreference = 'dark' | 'light' | 'system';

interface PreferencesState {
  theme: ThemePreference;
  summaryStripVisible: boolean;
  /** What the board is painted with. Read through `useAppearance`, never directly. */
  appearance: Appearance;
  hasHydrated: boolean;
  setTheme: (theme: ThemePreference) => void;
  setSummaryStripVisible: (visible: boolean) => void;
  toggleSummaryStrip: () => void;
  /**
   * Change one key, **applied and persisted immediately** — exactly like the theme buttons.
   *
   * The editor used to write a draft that only Save committed, while the theme, the reading scale
   * and the summary strip applied on press. Two apply models in one panel meant the Save/Cancel pair
   * lived at the very bottom of a long scroll and half the controls ignored it (found in the v0.2.0
   * review). Now every control commits on change, the dashboard repaints live, and undo is the
   * per-key Reset beside each field.
   */
  setAppearance: <K extends AppearanceKey>(key: K, value: Appearance[K]) => void;
  /** Put one key back to its default, without touching the rest of the theme. */
  resetAppearanceKey: (key: AppearanceKey) => void;
  resetAppearance: () => void;
}

/** What the board draws. Kept as a named selector because half the app subscribes through it. */
export function selectAppearance(state: Pick<PreferencesState, 'appearance'>): Appearance {
  return state.appearance;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'dark',
      summaryStripVisible: true,
      appearance: DEFAULT_APPEARANCE,
      hasHydrated: false,

      setTheme: (theme) => set({ theme }),
      setSummaryStripVisible: (summaryStripVisible) => set({ summaryStripVisible }),
      toggleSummaryStrip: () =>
        set((state) => ({ summaryStripVisible: !state.summaryStripVisible })),

      setAppearance: (key, value) =>
        set((state) => ({ appearance: { ...state.appearance, [key]: value } })),

      resetAppearanceKey: (key) =>
        set((state) => ({
          appearance: { ...state.appearance, [key]: DEFAULT_APPEARANCE[key] },
        })),

      resetAppearance: () => set({ appearance: { ...DEFAULT_APPEARANCE } }),
    }),
    {
      name: STORAGE_KEYS.preferences,
      storage: asyncStorageJSON(),
      version: 2,
      /**
       * v1 → v2: the reading scale becomes the appearance model's `interfaceScale`.
       *
       * It was always the same number — the reading channel's multiplier — but it now lives with
       * the other things the appearance editor owns, so one Cancel undoes an experiment with the
       * text size as readily as one with the colours.
       */
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        if (version >= 2) {
          return { ...state, appearance: parseAppearance(state['appearance']) };
        }
        const scale = typeof state['readingScale'] === 'number' ? state['readingScale'] : undefined;
        return {
          ...state,
          appearance: parseAppearance({
            ...DEFAULT_APPEARANCE,
            ...(scale === undefined ? {} : { interfaceScale: clampReadingScale(scale) }),
          }),
        };
      },
      partialize: (state) => ({
        theme: state.theme,
        summaryStripVisible: state.summaryStripVisible,
        appearance: state.appearance,
      }),
      onRehydrateStorage: () => (state) => {
        // A hand-edited or downgraded store could hold anything here, and the appearance is the one
        // record that decides whether the app is legible at all.
        if (state) usePreferencesStore.setState({ appearance: parseAppearance(state.appearance) });
        usePreferencesStore.setState({ hasHydrated: true });
      },
    },
  ),
);
