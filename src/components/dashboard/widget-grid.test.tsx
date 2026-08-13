import { DeviceEventEmitter, StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';
import type { PanGesture } from 'react-native-gesture-handler';

import { useEndpointsStore } from '@/state/endpoints';
import { usePreferencesStore } from '@/state/preferences';
import { useWidgetsStore } from '@/state/widgets';
import { DEFAULT_APPEARANCE } from '@/theme/appearance';
import { fireEvent, renderWithProviders, waitFor } from '@/test-utils/render';
import type { WidgetInstance } from '@/types/dashboard';
import type { GridItem } from '@/utils/gridLayout';

import { WidgetGrid } from './widget-grid';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, text: async () => JSON.stringify({ total: 1 }) }) as unknown as typeof fetch;
  useEndpointsStore.setState({ endpoints: [], defaultEndpointId: null });
  useWidgetsStore.setState({ widgets: [] });
  usePreferencesStore.setState({ appearance: DEFAULT_APPEARANCE });
});

afterEach(() => {
  global.fetch = originalFetch;
});

/** A column of widgets at `cpuText`'s own regular footprint — one column, four rows. */
function makeWidgets(count: number): WidgetInstance[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `w-${index + 1}`,
    type: 'cpuText',
    endpointId: 'e1',
    title: `Widget ${index + 1}`,
    config: {},
    x: 0,
    y: index * 4,
    w: 1,
    h: 4,
    createdAt: 0,
  }));
}

/** A grid wide enough for two columns (2 × 302 + 3 × 11 = 637) and tall enough for several rows. */
const GRID_BOX = { x: 0, y: 0, width: 700, height: 800 };

async function renderGrid(widgets: WidgetInstance[], editMode = true, box = GRID_BOX) {
  const onLayoutChange = jest.fn();
  const view = await renderWithProviders(
    <WidgetGrid
      widgets={widgets}
      editMode={editMode}
      onEdit={jest.fn()}
      onRemove={jest.fn()}
      onLayoutChange={onLayoutChange}
    />,
  );
  // Nothing renders until the grid has been measured — the column count is a fact about the box.
  fireEvent(view.getByTestId('widget-grid'), 'layout', { nativeEvent: { layout: box } });
  await waitFor(() => undefined);
  return { ...view, onLayoutChange };
}

/** The committed layout, keyed by widget id. */
const committed = (onLayoutChange: jest.Mock): Map<string, GridItem> =>
  new Map((onLayoutChange.mock.calls.at(-1)?.[0] as GridItem[]).map((item) => [item.id, item]));

/**
 * A drag left in the hand, so the board can be looked at *during* one.
 *
 * `fireGestureHandler` always appends the END — by the time it returns the drag is over and
 * committed — so the two events it would emit up to that point are sent directly instead.
 */
function holdDrag(gestureTestId: string, translationY: number, translationX = 0) {
  const { handlerTag } = getByGestureTestId(gestureTestId);
  const common = { handlerTag, numberOfPointers: 1, x: 0, y: 0, absoluteX: 0, absoluteY: 0 };
  DeviceEventEmitter.emit('onGestureHandlerStateChange', {
    ...common,
    state: State.ACTIVE,
    oldState: State.BEGAN,
    translationX: 0,
    translationY: 0,
  });
  DeviceEventEmitter.emit('onGestureHandlerEvent', {
    ...common,
    state: State.ACTIVE,
    translationX,
    translationY,
  });
}

const rectOf = (element: { props: { style?: unknown } }) =>
  StyleSheet.flatten(element.props.style as never) as {
    left: number;
    top: number;
    width: number;
    height: number;
  };

describe('WidgetGrid', () => {
  it('renders a cell per widget', async () => {
    const widgets = makeWidgets(3);
    const { getByTestId } = await renderGrid(widgets);

    for (const widget of widgets) {
      expect(getByTestId(`widget-cell-${widget.id}`)).toBeTruthy();
    }
  });

  it('places cells at their grid coordinates, gap included', async () => {
    const { getByTestId } = await renderGrid([
      { ...makeWidgets(1)[0], x: 0, y: 0 },
      { ...makeWidgets(2)[1], x: 1, y: 0 },
    ]);

    const first = rectOf(getByTestId('widget-cell-w-1'));
    const second = rectOf(getByTestId('widget-cell-w-2'));

    expect(first.left).toBeLessThan(second.left);
    expect(first.top).toBe(second.top);
    // Columns stretch to fill the measured width exactly, so the second one ends at the far edge.
    expect(second.left + second.width).toBeCloseTo(GRID_BOX.width - 11, 5);
  });

  it('gives a two-column widget twice the width of a one-column one, plus the gap between', async () => {
    const [regular, wide] = makeWidgets(2);
    const { getByTestId } = await renderGrid([regular, { ...wide, w: 2 }]);

    const one = rectOf(getByTestId('widget-cell-w-1')).width;
    const two = rectOf(getByTestId('widget-cell-w-2')).width;
    expect(two).toBeCloseTo(one * 2 + 11, 5);
  });

  it('narrows the whole board to one column when the window cannot hold two', async () => {
    const [regular, wide] = makeWidgets(2);
    const { getByTestId } = await renderGrid([regular, { ...wide, w: 2 }], true, {
      ...GRID_BOX,
      width: 393,
    });

    const one = rectOf(getByTestId('widget-cell-w-1'));
    const two = rectOf(getByTestId('widget-cell-w-2'));
    expect(one.width).toBeCloseTo(two.width, 5);
    // …and the clamped board is not written back: normalizing for a narrow window is a rendering
    // decision, not an edit the user made.
    expect(useWidgetsStore.getState().widgets).toHaveLength(0);
  });

  it('commits a layout when a card is dragged down onto another', async () => {
    const { onLayoutChange } = await renderGrid(makeWidgets(3));

    // A swap needs the card carried a full footprint down: until then the neighbour has nowhere
    // to lift into, and gravity pulls the dragged card straight back where it came from.
    fireGestureHandler<PanGesture>(getByGestureTestId('widget-drag-w-1'), [
      { state: State.BEGAN, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: 360 },
      { state: State.END, translationX: 0, translationY: 360 },
    ]);

    await waitFor(() => expect(onLayoutChange).toHaveBeenCalled());
    const layout = committed(onLayoutChange);
    expect(layout.get('w-1')!.y).toBeGreaterThan(layout.get('w-2')!.y);
  });

  it('drags across columns', async () => {
    const { onLayoutChange } = await renderGrid(makeWidgets(2));

    fireGestureHandler<PanGesture>(getByGestureTestId('widget-drag-w-2'), [
      { state: State.BEGAN, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 320, translationY: -100 },
      { state: State.END, translationX: 320, translationY: -100 },
    ]);

    await waitFor(() => expect(onLayoutChange).toHaveBeenCalled());
    expect(committed(onLayoutChange).get('w-2')).toMatchObject({ x: 1, y: 0 });
  });

  it('marks where a dragged card would land, and leaves the card itself under the pointer', async () => {
    const { getByTestId, queryByTestId } = await renderGrid(makeWidgets(3));
    expect(queryByTestId('widget-drop-target')).toBeNull();

    const anchor = rectOf(getByTestId('widget-cell-w-1'));
    holdDrag('widget-drag-w-1', 360);
    await waitFor(() => expect(queryByTestId('widget-drop-target')).not.toBeNull());

    // The placeholder has moved down the board; the card has not, because it is riding the
    // pointer through its transform and its slot must stay where the press found it.
    expect(rectOf(getByTestId('widget-drop-target')).top).toBeGreaterThan(anchor.top);
    expect(rectOf(getByTestId('widget-cell-w-1')).top).toBe(anchor.top);
  });

  it('holds the dropped arrangement on screen instead of falling back to the old one', async () => {
    // The parent commits to a store and the answer returns a render later. Until it does, the
    // board must keep showing where the card was dropped — the frame of the pre-drag layout is
    // the flash the owner reported.
    const { getByTestId, onLayoutChange } = await renderGrid(makeWidgets(3));

    fireGestureHandler<PanGesture>(getByGestureTestId('widget-drag-w-1'), [
      { state: State.BEGAN, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: 360 },
      { state: State.END, translationX: 0, translationY: 360 },
    ]);

    await waitFor(() => expect(onLayoutChange).toHaveBeenCalled());
    const layout = committed(onLayoutChange);
    const first = rectOf(getByTestId('widget-cell-w-1'));
    const second = rectOf(getByTestId('widget-cell-w-2'));
    expect(layout.get('w-1')!.y).toBeGreaterThan(layout.get('w-2')!.y);
    expect(first.top).toBeGreaterThan(second.top);
  });

  it('commits nothing when a drag goes nowhere', async () => {
    const { onLayoutChange } = await renderGrid(makeWidgets(3));

    fireGestureHandler<PanGesture>(getByGestureTestId('widget-drag-w-2'), [
      { state: State.BEGAN, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: 5 },
      { state: State.END, translationX: 0, translationY: 5 },
    ]);

    await waitFor(() => undefined);
    expect(onLayoutChange).not.toHaveBeenCalled();
  });

  it('does not drag outside edit mode', async () => {
    const { onLayoutChange } = await renderGrid(makeWidgets(3), false);

    fireGestureHandler<PanGesture>(getByGestureTestId('widget-drag-w-1'), [
      { state: State.BEGAN, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: 300 },
      { state: State.END, translationX: 0, translationY: 300 },
    ]);

    await waitFor(() => undefined);
    expect(onLayoutChange).not.toHaveBeenCalled();
  });

  it('resizes from the corner grip', async () => {
    const { onLayoutChange } = await renderGrid(makeWidgets(1));

    fireGestureHandler<PanGesture>(getByGestureTestId('widget-resize-w-1'), [
      { state: State.BEGAN, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 320, translationY: 160 },
      { state: State.END, translationX: 320, translationY: 160 },
    ]);

    await waitFor(() => expect(onLayoutChange).toHaveBeenCalled());
    const resized = committed(onLayoutChange).get('w-1')!;
    expect(resized.w).toBe(2);
    expect(resized.h).toBeGreaterThan(3);
  });

  it('offers no corner grip on a one-column board — that is what the ⋮ footprints are for', async () => {
    const { queryByTestId } = await renderGrid(makeWidgets(1), true, { ...GRID_BOX, width: 393 });
    expect(queryByTestId('widget-grip-w-1')).toBeNull();
  });

  it('offers no corner grip outside edit mode', async () => {
    const { queryByTestId } = await renderGrid(makeWidgets(1), false);
    expect(queryByTestId('widget-grip-w-1')).toBeNull();
  });

  it('resizes to a named footprint from the ⋮ menu', async () => {
    const { getByTestId, onLayoutChange, user } = await renderGrid(makeWidgets(2));

    await user.press(getByTestId('widget-menu-w-1'));
    await user.press(getByTestId('widget-menu-sheet-w-1-size-wide'));

    expect(onLayoutChange).toHaveBeenCalled();
    expect(committed(onLayoutChange).get('w-1')).toMatchObject({ w: 2 });
  });

  it('marks the footprint a widget is already at', async () => {
    const { getByTestId, user } = await renderGrid(makeWidgets(1));

    await user.press(getByTestId('widget-menu-w-1'));
    expect(getByTestId('widget-menu-sheet-w-1-size-regular')).toHaveTextContent(/Current/);
  });

  it('keeps the menu available outside edit mode — only the gestures are gated', async () => {
    const { getByTestId } = await renderGrid(makeWidgets(3), false);
    expect(getByTestId('widget-menu-w-1')).toBeTruthy();
  });

  it('hides widget headers when the appearance says so, leaving the corner mark', async () => {
    usePreferencesStore.setState({
      appearance: { ...DEFAULT_APPEARANCE, hideWidgetHeaders: true },
    });

    const { getByTestId, queryByTestId } = await renderGrid(makeWidgets(1), false);

    expect(queryByTestId('widget-title-w-1')).toBeNull();
    // The mark is what keeps a headerless panel identifiable — and what brings the header back.
    expect(getByTestId('widget-corner-w-1')).toBeTruthy();
  });

  it('brings the header back when the corner mark is pressed', async () => {
    usePreferencesStore.setState({
      appearance: { ...DEFAULT_APPEARANCE, hideWidgetHeaders: true },
    });

    const { getByTestId, user } = await renderGrid(makeWidgets(1), false);
    await user.press(getByTestId('widget-corner-w-1'));

    expect(getByTestId('widget-title-w-1')).toBeTruthy();
  });

  it('shows headers in edit mode whatever the setting says', async () => {
    // The header is what a widget is dragged, sized and configured by: a board you cannot edit
    // because you hid the controls is a trap, not a preference.
    usePreferencesStore.setState({
      appearance: { ...DEFAULT_APPEARANCE, hideWidgetHeaders: true },
    });

    const { getByTestId, queryByTestId } = await renderGrid(makeWidgets(1), true);

    expect(getByTestId('widget-title-w-1')).toBeTruthy();
    expect(queryByTestId('widget-corner-w-1')).toBeNull();
  });
});
