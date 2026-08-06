import { useUiStore } from './ui';

beforeEach(() => {
  useUiStore.setState({ editMode: false, fullScreen: false });
});

describe('useUiStore', () => {
  it('starts with both modes off', () => {
    expect(useUiStore.getState()).toMatchObject({ editMode: false, fullScreen: false });
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

  it('leaves edit mode when entering full screen', () => {
    useUiStore.getState().setEditMode(true);
    useUiStore.getState().enterFullScreen();

    expect(useUiStore.getState()).toMatchObject({ fullScreen: true, editMode: false });
  });

  it('exits full screen without turning edit mode back on', () => {
    useUiStore.getState().setEditMode(true);
    useUiStore.getState().enterFullScreen();
    useUiStore.getState().exitFullScreen();

    expect(useUiStore.getState()).toMatchObject({ fullScreen: false, editMode: false });
  });

  it('toggles full screen, and the toggle in also leaves edit mode', () => {
    useUiStore.getState().setEditMode(true);
    useUiStore.getState().toggleFullScreen();
    expect(useUiStore.getState()).toMatchObject({ fullScreen: true, editMode: false });

    useUiStore.getState().setEditMode(true);
    useUiStore.getState().toggleFullScreen();
    // Leaving is only leaving: it does not undo an edit mode the user turned on since.
    expect(useUiStore.getState()).toMatchObject({ fullScreen: false, editMode: true });
  });
});
