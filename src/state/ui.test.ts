import { useUiStore } from './ui';

beforeEach(() => {
  useUiStore.setState({ editMode: false, immersive: false });
});

describe('useUiStore', () => {
  it('starts with both modes off', () => {
    expect(useUiStore.getState()).toMatchObject({ editMode: false, immersive: false });
  });

  it('toggles edit mode', () => {
    useUiStore.getState().toggleEditMode();
    expect(useUiStore.getState().editMode).toBe(true);
    useUiStore.getState().toggleEditMode();
    expect(useUiStore.getState().editMode).toBe(false);
  });

  it('sets edit mode directly', () => {
    useUiStore.getState().setEditMode(true);
    expect(useUiStore.getState().editMode).toBe(true);
  });

  it('leaves edit mode when entering immersive mode', () => {
    useUiStore.getState().setEditMode(true);
    useUiStore.getState().enterImmersive();

    expect(useUiStore.getState()).toMatchObject({ immersive: true, editMode: false });
  });

  it('exits immersive mode without turning edit mode back on', () => {
    useUiStore.getState().setEditMode(true);
    useUiStore.getState().enterImmersive();
    useUiStore.getState().exitImmersive();

    expect(useUiStore.getState()).toMatchObject({ immersive: false, editMode: false });
  });
});
