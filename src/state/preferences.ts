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
  /**
   * The appearance being edited, or `null`.
   *
   * The editor writes the **draft** on every keystroke and the dashboard behind it repaints live —
   * so there is no preview surface to keep in step with the real thing, and Cancel is just
   * clearing this. Deliberately not persisted: an abandoned experiment must not come back.
   */
  appearanceDraft: Appearance | null;
  hasHydrated: boolean;
  setTheme: (theme: ThemePreference) => void;
  setSummaryStripVisible: (visible: boolean) => void;
  toggleSummaryStrip: () => void;
  /** Start editing from whatever is on screen now. */
  beginAppearanceEdit: () => void;
  /** Change one key of the draft, starting one if the editor has not already. */
  setAppearanceDraft: <K extends AppearanceKey>(key: K, value: Appearance[K]) => void;
  /** Put one key back to its default, without touching the rest of the theme. */
  resetAppearanceKey: (key: AppearanceKey) => void;
  resetAppearance: () => void;
  commitAppearance: () => void;
  cancelAppearance: () => void;
}

/** Everything reads the draft first, so an editor's changes are what the board draws. */
export function selectAppearance(state: Pick<PreferencesState, 'appearance' | 'appearanceDraft'>): Appearance {
  return state.appearanceDraft ?? state.appearance;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      summaryStripVisible: true,
      appearance: DEFAULT_APPEARANCE,
      appearanceDraft: null,
      hasHydrated: false,

      setTheme: (theme) => set({ theme }),
      setSummaryStripVisible: (summaryStripVisible) => set({ summaryStripVisible }),
      toggleSummaryStrip: () =>
        set((state) => ({ summaryStripVisible: !state.summaryStripVisible })),

      beginAppearanceEdit: () => {
        if (get().appearanceDraft) return;
        set((state) => ({ appearanceDraft: { ...state.appearance } }));
      },

      setAppearanceDraft: (key, value) =>
        set((state) => ({
          appearanceDraft: { ...(state.appearanceDraft ?? state.appearance), [key]: value },
        })),

      resetAppearanceKey: (key) =>
        set((state) => ({
          appearanceDraft: {
            ...(state.appearanceDraft ?? state.appearance),
            [key]: DEFAULT_APPEARANCE[key],
          },
        })),

      resetAppearance: () => set({ appearanceDraft: { ...DEFAULT_APPEARANCE } }),

      commitAppearance: () =>
        set((state) =>
          state.appearanceDraft
            ? { appearance: state.appearanceDraft, appearanceDraft: null }
            : { appearanceDraft: null },
        ),

      cancelAppearance: () => set({ appearanceDraft: null }),
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
