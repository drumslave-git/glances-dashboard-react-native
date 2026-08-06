import { create } from 'zustand';

/**
 * Transient dashboard chrome state. Deliberately **not** persisted: coming back to the app in full
 * screen with no visible way out, or in edit mode with a resize grip on every card, would both be
 * unpleasant surprises.
 *
 * "Full screen" rather than the old "immersive": it is the reference's own word for it (ref §7.1),
 * and on web and desktop it is now literally that — the browser's fullscreen is requested with it.
 */
interface UiState {
  editMode: boolean;
  fullScreen: boolean;
  setEditMode: (editMode: boolean) => void;
  toggleEditMode: () => void;
  enterFullScreen: () => void;
  exitFullScreen: () => void;
  toggleFullScreen: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  editMode: false,
  fullScreen: false,

  setEditMode: (editMode) => set({ editMode }),
  toggleEditMode: () => set((state) => ({ editMode: !state.editMode })),

  // Editing chrome has no place in a display-only view, so entering full screen leaves edit mode
  // behind rather than hiding a still-active state.
  enterFullScreen: () => set({ fullScreen: true, editMode: false }),
  exitFullScreen: () => set({ fullScreen: false }),
  toggleFullScreen: () =>
    set((state) =>
      state.fullScreen ? { fullScreen: false } : { fullScreen: true, editMode: false },
    ),
}));
