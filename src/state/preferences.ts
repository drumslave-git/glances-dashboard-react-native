import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { clampReadingScale, READING_SCALE_DEFAULT } from '@/utils/typeScale';

import { asyncStorageJSON, STORAGE_KEYS } from './storage';

/**
 * Display preferences. **Persisted**, unlike the transient chrome state in
 * `ui.ts`: a theme or a font size the user chose should survive a restart, where
 * edit mode and immersive mode deliberately do not.
 */
export type ThemePreference = 'dark' | 'light' | 'system';

interface PreferencesState {
  theme: ThemePreference;
  /**
   * The *reading* channel multiplier — labels, chips, table rows, footers, axis
   * ticks. It deliberately does not reach hero numerals or gauge centre values,
   * which size off their widget box instead. See `utils/typeScale.ts`.
   */
  readingScale: number;
  summaryStripVisible: boolean;
  hasHydrated: boolean;
  setTheme: (theme: ThemePreference) => void;
  setReadingScale: (readingScale: number) => void;
  setSummaryStripVisible: (visible: boolean) => void;
  toggleSummaryStrip: () => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'dark',
      readingScale: READING_SCALE_DEFAULT,
      summaryStripVisible: true,
      hasHydrated: false,

      setTheme: (theme) => set({ theme }),
      // Clamped on the way in as well as on the way out, so a bad value never
      // reaches storage in the first place.
      setReadingScale: (readingScale) => set({ readingScale: clampReadingScale(readingScale) }),
      setSummaryStripVisible: (summaryStripVisible) => set({ summaryStripVisible }),
      toggleSummaryStrip: () =>
        set((state) => ({ summaryStripVisible: !state.summaryStripVisible })),
    }),
    {
      name: STORAGE_KEYS.preferences,
      storage: asyncStorageJSON(),
      version: 1,
      partialize: (state) => ({
        theme: state.theme,
        readingScale: state.readingScale,
        summaryStripVisible: state.summaryStripVisible,
      }),
      onRehydrateStorage: () => (state) => {
        // A hand-edited or downgraded store could hold anything here.
        if (state) usePreferencesStore.setState({ readingScale: clampReadingScale(state.readingScale) });
        usePreferencesStore.setState({ hasHydrated: true });
      },
    },
  ),
);
