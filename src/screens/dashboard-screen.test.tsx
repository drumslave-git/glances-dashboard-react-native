import { resetServerIdCounter, useServersStore } from '@/state/servers';
import { useWidgetsStore } from '@/state/widgets';
import { renderWithProviders, waitFor } from '@/test-utils/render';
import { resetWidgetIdCounter } from '@/utils/widgetFactory';

import { DashboardScreen } from './dashboard-screen';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

const originalFetch = global.fetch;

function mockGlances(payloads: Record<string, unknown>) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const body = payloads[path];
    if (body === undefined) {
      return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' });
    }
    return Promise.resolve({ ok: true, json: async () => body });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  mockPush.mockClear();
  resetServerIdCounter();
  resetWidgetIdCounter();
  useServersStore.setState({ servers: [], defaultServerId: null });
  useWidgetsStore.setState({ widgets: [] });
});

afterEach(() => {
  global.fetch = originalFetch;
});

function addServerAndWidget(fields?: string[]) {
  const server = useServersStore.getState().addServer({ name: 'NAS', url: '10.0.0.1' });
  const widget = useWidgetsStore.getState().addWidget({ serverId: server.id, metric: 'cpu' });
  useWidgetsStore.getState().updateWidget(widget.id, {
    title: 'CPU',
    ...(fields ? { fields } : {}),
  });
  return { server, widget };
}

describe('DashboardScreen - empty states', () => {
  it('asks for a server when none exist', async () => {
    const { getByTestId } = await renderWithProviders(<DashboardScreen />);

    expect(getByTestId('dashboard-no-servers')).toBeTruthy();
  });

  it('asks for a widget once a server exists', async () => {
    mockGlances({ '/api/4/system': { hostname: 'nas' } });
    useServersStore.getState().addServer({ name: 'NAS', url: '10.0.0.1' });

    const { getByTestId } = await renderWithProviders(<DashboardScreen />);

    expect(getByTestId('dashboard-no-widgets')).toBeTruthy();
  });

  it('routes to the widget type picker', async () => {
    mockGlances({ '/api/4/system': { hostname: 'nas' } });
    useServersStore.getState().addServer({ name: 'NAS', url: '10.0.0.1' });

    const { getByTestId, user } = await renderWithProviders(<DashboardScreen />);
    await user.press(getByTestId('dashboard-add-first-widget'));

    expect(mockPush).toHaveBeenCalledWith('/widget/pick');
  });
});

describe('DashboardScreen - header', () => {
  it('shows the server name and its hostname', async () => {
    mockGlances({ '/api/4/system': { hostname: 'nas', linux_distro: 'Debian 12' } });
    useServersStore.getState().addServer({ name: 'NAS', url: '10.0.0.1' });

    const { getByTestId } = await renderWithProviders(<DashboardScreen />);

    await waitFor(() => expect(getByTestId('dashboard-subtitle')).toHaveTextContent(/nas/));
  });

  it('reports an unreachable server', async () => {
    mockGlances({});
    useServersStore.getState().addServer({ name: 'NAS', url: '10.0.0.1' });

    const { getByTestId } = await renderWithProviders(<DashboardScreen />);

    await waitFor(() => expect(getByTestId('dashboard-subtitle')).toHaveTextContent(/Cannot reach/));
  });

  it('shows the polling cadence', async () => {
    mockGlances({ '/api/4/system': { hostname: 'nas' } });
    useServersStore.getState().addServer({ name: 'NAS', url: '10.0.0.1', refreshMs: 2500 });

    const { getByTestId } = await renderWithProviders(<DashboardScreen />);

    expect(getByTestId('dashboard-refresh')).toHaveTextContent('2.5s refresh');
  });

  it('shows no cadence for a server that is fetched once', async () => {
    mockGlances({ '/api/4/system': { hostname: 'nas' } });
    useServersStore.getState().addServer({ name: 'NAS', url: '10.0.0.1', refreshMs: 0 });

    const { queryByTestId } = await renderWithProviders(<DashboardScreen />);

    expect(queryByTestId('dashboard-refresh')).toBeNull();
  });
});

describe('DashboardScreen - widgets', () => {
  it('renders a widget with live data', async () => {
    mockGlances({
      '/api/4/system': { hostname: 'nas' },
      '/api/4/cpu': { total: 12.5 },
    });
    const { widget } = addServerAndWidget(['total']);

    const { getByTestId } = await renderWithProviders(<DashboardScreen />);

    await waitFor(() =>
      expect(getByTestId(`widget-content-${widget.id}-body`)).toHaveTextContent(/total = 12\.5/),
    );
  });

  it('resolves tokens in the widget title', async () => {
    mockGlances({
      '/api/4/system': { hostname: 'nas' },
      '/api/4/cpu': { total: 12.5 },
    });
    const server = useServersStore.getState().addServer({ name: 'NAS', url: '10.0.0.1' });
    const widget = useWidgetsStore.getState().addWidget({ serverId: server.id, metric: 'cpu' });
    useWidgetsStore.getState().updateWidget(widget.id, { title: 'CPU {{total}}%' });

    const { getByTestId } = await renderWithProviders(<DashboardScreen />);

    await waitFor(() =>
      expect(getByTestId(`widget-title-${widget.id}`)).toHaveTextContent('CPU 12.5%'),
    );
  });

  it('hides edit controls until edit mode is on', async () => {
    mockGlances({ '/api/4/system': {}, '/api/4/cpu': { total: 1 } });
    const { widget } = addServerAndWidget();

    const { queryByTestId, getByTestId, user } = await renderWithProviders(<DashboardScreen />);

    expect(queryByTestId(`widget-remove-${widget.id}`)).toBeNull();

    await user.press(getByTestId('toggle-edit-mode'));

    expect(getByTestId(`widget-remove-${widget.id}`)).toBeTruthy();
  });

  it('removes a widget from edit mode', async () => {
    mockGlances({ '/api/4/system': {}, '/api/4/cpu': { total: 1 } });
    const { widget } = addServerAndWidget();

    const { getByTestId, user } = await renderWithProviders(<DashboardScreen />);
    await user.press(getByTestId('toggle-edit-mode'));
    await user.press(getByTestId(`widget-remove-${widget.id}`));

    expect(useWidgetsStore.getState().widgets).toHaveLength(0);
  });

  it('cycles the widget size', async () => {
    mockGlances({ '/api/4/system': {}, '/api/4/cpu': { total: 1 } });
    const { widget } = addServerAndWidget();

    const { getByTestId, user } = await renderWithProviders(<DashboardScreen />);
    await user.press(getByTestId('toggle-edit-mode'));
    await user.press(getByTestId(`widget-resize-${widget.id}`));

    expect(useWidgetsStore.getState().widgets[0].size).toBe('L');
  });

  it('opens the config screen for a widget', async () => {
    mockGlances({ '/api/4/system': {}, '/api/4/cpu': { total: 1 } });
    const { widget } = addServerAndWidget();

    const { getByTestId, user } = await renderWithProviders(<DashboardScreen />);
    await user.press(getByTestId('toggle-edit-mode'));
    await user.press(getByTestId(`widget-edit-${widget.id}`));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/widget/[id]',
      params: { id: widget.id },
    });
  });
});
