import { State } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';
import type { PanGesture } from 'react-native-gesture-handler';

import { useServersStore } from '@/state/servers';
import { useWidgetsStore } from '@/state/widgets';
import { fireEvent, renderWithProviders, waitFor } from '@/test-utils/render';
import type { WidgetConfig } from '@/types/dashboard';

import { WidgetGrid } from './widget-grid';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, text: async () => JSON.stringify({ total: 1 }) }) as unknown as typeof fetch;
  useServersStore.setState({ servers: [], defaultServerId: null });
  useWidgetsStore.setState({ widgets: [] });
});

afterEach(() => {
  global.fetch = originalFetch;
});

function makeWidgets(count: number): WidgetConfig[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `w-${index + 1}`,
    serverId: 's-1',
    title: `Widget ${index + 1}`,
    kind: 'text' as const,
    metric: 'cpu',
    endpointPath: '/api/4/cpu',
    size: 'M' as const,
    order: index,
  }));
}

/**
 * One card per row, 100pt tall, matching what the flow layout would produce.
 *
 * Each `fireEvent` opens its own act scope, and firing several back to back
 * overlaps them — which wedges the renderer for every later test in the file,
 * so each one is awaited before the next.
 */
async function layoutAsColumn(getByTestId: (id: string) => unknown, widgets: WidgetConfig[]) {
  for (const [index, widget] of widgets.entries()) {
    fireEvent(getByTestId(`widget-cell-${widget.id}`) as never, 'layout', {
      nativeEvent: { layout: { x: 0, y: index * 100, width: 200, height: 100 } },
    });
    await waitFor(() => undefined);
  }
}

async function renderGrid(widgets: WidgetConfig[], editMode = true) {
  const onReorder = jest.fn();
  const view = await renderWithProviders(
    <WidgetGrid
      widgets={widgets}
      editMode={editMode}
      onEdit={jest.fn()}
      onRemove={jest.fn()}
      onResize={jest.fn()}
      onCycleTimeWindow={jest.fn()}
      onReorder={onReorder}
    />,
  );
  await layoutAsColumn(view.getByTestId, widgets);
  return { ...view, onReorder };
}

describe('WidgetGrid', () => {
  it('renders a cell per widget', async () => {
    const widgets = makeWidgets(3);
    const { getByTestId } = await renderGrid(widgets);

    for (const widget of widgets) {
      expect(getByTestId(`widget-cell-${widget.id}`)).toBeTruthy();
    }
  });

  it('commits a new order when a card is dragged down onto another', async () => {
    const widgets = makeWidgets(3);
    const { onReorder } = await renderGrid(widgets);

    // Drag the first card down by two rows, onto the third.
    fireGestureHandler<PanGesture>(getByGestureTestId('widget-drag-w-1'), [
      { state: State.BEGAN, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: 200 },
      { state: State.END, translationX: 0, translationY: 200 },
    ]);

    await waitFor(() => expect(onReorder).toHaveBeenCalledWith(['w-2', 'w-3', 'w-1']));
  });

  it('commits a new order when a card is dragged up', async () => {
    const widgets = makeWidgets(3);
    const { onReorder } = await renderGrid(widgets);

    fireGestureHandler<PanGesture>(getByGestureTestId('widget-drag-w-3'), [
      { state: State.BEGAN, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: -200 },
      { state: State.END, translationX: 0, translationY: -200 },
    ]);

    await waitFor(() => expect(onReorder).toHaveBeenCalledWith(['w-3', 'w-1', 'w-2']));
  });

  it('commits the unchanged order when a drag goes nowhere', async () => {
    const widgets = makeWidgets(3);
    const { onReorder } = await renderGrid(widgets);

    fireGestureHandler<PanGesture>(getByGestureTestId('widget-drag-w-2'), [
      { state: State.BEGAN, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: 5 },
      { state: State.END, translationX: 0, translationY: 5 },
    ]);

    await waitFor(() => expect(onReorder).toHaveBeenCalledWith(['w-1', 'w-2', 'w-3']));
  });

  it('does not reorder outside edit mode', async () => {
    const widgets = makeWidgets(3);
    const { onReorder } = await renderGrid(widgets, false);

    fireGestureHandler<PanGesture>(getByGestureTestId('widget-drag-w-1'), [
      { state: State.BEGAN, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: 200 },
      { state: State.END, translationX: 0, translationY: 200 },
    ]);

    await waitFor(() => undefined);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('offers moving through the ⋮ menu on every platform', async () => {
    const { getByTestId, onReorder, user } = await renderGrid(makeWidgets(3));

    await user.press(getByTestId('widget-menu-w-1'));
    await user.press(getByTestId('widget-menu-sheet-w-1-move-later'));

    expect(onReorder).toHaveBeenCalledWith(['w-2', 'w-1', 'w-3']);
  });

  it('moves a widget earlier from the menu', async () => {
    const { getByTestId, onReorder, user } = await renderGrid(makeWidgets(3));

    await user.press(getByTestId('widget-menu-w-3'));
    await user.press(getByTestId('widget-menu-sheet-w-3-move-earlier'));

    expect(onReorder).toHaveBeenCalledWith(['w-1', 'w-3', 'w-2']);
  });

  it('disables the move that would run off the end of the order', async () => {
    const { getByTestId, onReorder, user } = await renderGrid(makeWidgets(3));

    await user.press(getByTestId('widget-menu-w-1'));
    await user.press(getByTestId('widget-menu-sheet-w-1-move-earlier'));

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('keeps the menu available outside edit mode — only dragging is gated', async () => {
    const { getByTestId } = await renderGrid(makeWidgets(3), false);

    expect(getByTestId('widget-menu-w-1')).toBeTruthy();
  });
});
