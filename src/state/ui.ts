import { create } from 'zustand';

/**
 * Transient dashboard chrome state. Deliberately **not** persisted: coming back
 * to the app in immersive mode with no visible way out, or in edit mode with
 * remove buttons on every card, would both be unpleasant surprises.
 */
interface UiState {
  editMode: boolean;
  immersive: boolean;
  setEditMode: (editMode: boolean) => void;
  toggleEditMode: () => void;
  enterImmersive: () => void;
  exitImmersive: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  editMode: false,
  immersive: false,

  setEditMode: (editMode) => set({ editMode }),
  toggleEditMode: () => set((state) => ({ editMode: !state.editMode })),

  // Editing chrome has no place in a display-only view, so entering immersive
  // mode leaves edit mode behind rather than hiding a still-active state.
  enterImmersive: () => set({ immersive: true, editMode: false }),
  exitImmersive: () => set({ immersive: false }),
}));
