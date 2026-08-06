import { feedStore } from '@/data/feed-store';
import { resetEndpointIdCounter, useEndpointsStore } from '@/state/endpoints';
import { resetWidgetIdCounter, useWidgetsStore } from '@/state/widgets';
import { fireEvent, renderWithProviders, waitFor } from '@/test-utils/render';

import { WidgetTypeScreen } from './widget-type-screen';

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockDismissAll = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    back: mockBack,
    dismissAll: mockDismissAll,
    push: jest.fn(),
  }),
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockBack.mockClear();
  mockDismissAll.mockClear();
  resetEndpointIdCounter();
  resetWidgetIdCounter();
  useEndpointsStore.setState({ endpoints: [], defaultEndpointId: null });
  useWidgetsStore.setState({ widgets: [] });
  useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1' });
});

/**
 * Render the picker and give its list a width.
 *
 * The preview cards mount real widget bodies, which size off a measured box — so until the list
 * reports one there is nothing to draw and the cards render their text alone.
 */
async function renderPicker() {
  const view = await renderWithProviders(<WidgetTypeScreen />);
  return { ...view, measure: async () => {
    fireEvent(view.getByTestId('widget-metric-cpu'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 700, height: 400 } },
    });
    await waitFor(() => undefined);
  } };
}

describe('WidgetTypeScreen — step one, the metric', () => {
  it('lists the metrics grouped, not a flat list of renderings', async () => {
    // The flat list this replaced asked one question that was really two.
    const { getByTestId } = await renderWithProviders(<WidgetTypeScreen />);

    for (const metric of ['cpu', 'percpu', 'memory', 'load', 'system', 'summary']) {
      expect(getByTestId(`widget-metric-${metric}`)).toBeTruthy();
    }
  });

  it('says how many renderings each metric has', async () => {
    const { getByTestId } = await renderWithProviders(<WidgetTypeScreen />);
    expect(getByTestId('widget-metric-cpu')).toHaveTextContent(/3 styles/);
    // System info has exactly one rendering, and "1 styles" reads like a bug.
    expect(getByTestId('widget-metric-system')).toHaveTextContent(/1 style(?!s)/);
  });

  it('asks for an endpoint first when there is none', async () => {
    useEndpointsStore.setState({ endpoints: [], defaultEndpointId: null });
    const { getByTestId } = await renderWithProviders(<WidgetTypeScreen />);
    expect(getByTestId('widget-type-no-endpoints')).toBeTruthy();
  });
});

describe('WidgetTypeScreen — step two, the rendering', () => {
  it('offers the renderings of the chosen metric', async () => {
    const { getByTestId, user } = await renderWithProviders(<WidgetTypeScreen />);
    await user.press(getByTestId('widget-metric-cpu'));

    for (const type of ['cpu', 'cpuGauge', 'cpuText']) {
      expect(getByTestId(`widget-variant-${type}`)).toBeTruthy();
    }
  });

  it('previews each rendering against the live feed', async () => {
    const endpointId = useEndpointsStore.getState().endpoints[0].id;
    feedStore.getState().ingest({
      endpointId,
      ts: Date.now(),
      plugins: { cpu: { total: 12.5, user: 4, system: 2, idle: 93.5 } },
    });

    const { getByTestId, user, measure } = await renderPicker();
    // The layout event has to land on an element that is mounted in both steps.
    await measure();
    await user.press(getByTestId('widget-metric-cpu'));

    expect(getByTestId('widget-variant-preview-cpuText')).toHaveTextContent(/12\.5/);
  });

  it('offers the three footprints once a rendering is chosen, and places the chosen one', async () => {
    const { getByTestId, queryByTestId, user, measure } = await renderPicker();
    await measure();
    await user.press(getByTestId('widget-metric-memory'));

    expect(queryByTestId('widget-size-cards')).toBeNull();
    await user.press(getByTestId('widget-variant-memoryGauge'));
    expect(getByTestId('widget-size-wide')).toBeTruthy();

    await user.press(getByTestId('widget-size-wide'));
    await user.press(getByTestId('widget-type-add'));

    const [widget] = useWidgetsStore.getState().widgets;
    expect(widget).toMatchObject({ type: 'memoryGauge', endpointId: 's-1', w: 2 });
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('places the regular footprint by default', async () => {
    const { getByTestId, user, measure } = await renderPicker();
    await measure();
    await user.press(getByTestId('widget-metric-memory'));
    await user.press(getByTestId('widget-variant-memoryGauge'));
    await user.press(getByTestId('widget-type-add'));

    expect(useWidgetsStore.getState().widgets[0]).toMatchObject({ w: 1 });
  });

  it('can add and go straight to the options', async () => {
    const { getByTestId, user, measure } = await renderPicker();
    await measure();
    await user.press(getByTestId('widget-metric-cpu'));
    await user.press(getByTestId('widget-variant-cpu'));
    await user.press(getByTestId('widget-type-add-configure'));

    const [widget] = useWidgetsStore.getState().widgets;
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/widget/[id]',
      params: { id: widget.id },
    });
  });

  it('saves a global rendering against no endpoint at all', async () => {
    const { getByTestId, user, measure } = await renderPicker();
    await measure();
    await user.press(getByTestId('widget-metric-alerts'));
    await user.press(getByTestId('widget-variant-alerts'));
    await user.press(getByTestId('widget-type-add'));

    expect(useWidgetsStore.getState().widgets[0]).toMatchObject({ endpointId: null });
  });

  it('goes back to the metrics', async () => {
    const { getByTestId, queryByTestId, user } = await renderWithProviders(<WidgetTypeScreen />);
    await user.press(getByTestId('widget-metric-cpu'));
    expect(queryByTestId('widget-metric-cpu')).toBeNull();

    await user.press(getByTestId('widget-type-back'));
    expect(getByTestId('widget-metric-cpu')).toBeTruthy();
  });
});

describe('WidgetTypeScreen', () => {
  it('can be cancelled', async () => {
    const { getByTestId, user } = await renderWithProviders(<WidgetTypeScreen />);
    await user.press(getByTestId('widget-type-cancel'));

    expect(mockBack).toHaveBeenCalled();
  });
});
