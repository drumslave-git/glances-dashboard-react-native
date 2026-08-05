import { resetEndpointIdCounter, useEndpointsStore } from '@/state/endpoints';
import { renderWithProviders } from '@/test-utils/render';

import { WidgetTypeScreen } from './widget-type-screen';

const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }),
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockBack.mockClear();
  resetEndpointIdCounter();
  useEndpointsStore.setState({ endpoints: [], defaultEndpointId: null });
  useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1' });
});

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

  it('hands the chosen type and endpoint to the config screen', async () => {
    const { getByTestId, user } = await renderWithProviders(<WidgetTypeScreen />);
    await user.press(getByTestId('widget-metric-memory'));
    await user.press(getByTestId('widget-variant-memoryGauge'));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/widget/[id]',
      params: { id: 'new', type: 'memoryGauge', endpointId: 's-1' },
    });
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
