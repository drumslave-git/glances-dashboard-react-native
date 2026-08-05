import { usePreferencesStore } from '@/state/preferences';
import { resetEndpointIdCounter, useEndpointsStore } from '@/state/endpoints';
import { resetWidgetIdCounter, useWidgetsStore } from '@/state/widgets';
import { renderWithProviders } from '@/test-utils/render';
import { heroFontSize } from '@/utils/typeScale';


import { SettingsScreen } from './settings-screen';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  resetEndpointIdCounter();
  resetWidgetIdCounter();
  useEndpointsStore.setState({ endpoints: [], defaultEndpointId: null });
  useWidgetsStore.setState({ widgets: [] });
});

function addEndpoint(name: string, url = '10.0.0.1') {
  return useEndpointsStore.getState().addEndpoint({ name, url });
}

describe('SettingsScreen', () => {
  it('shows an empty state when no servers exist', async () => {
    const { getByTestId } = await renderWithProviders(<SettingsScreen />);

    expect(getByTestId('endpoints-empty')).toBeTruthy();
  });

  it('lists servers with their address and refresh interval', async () => {
    addEndpoint('NAS');
    const { getByText } = await renderWithProviders(<SettingsScreen />);

    expect(getByText('NAS')).toBeTruthy();
    expect(getByText('http://10.0.0.1:61208')).toBeTruthy();
    // The default cadence is now the reference's 2 s, not the old 5 s.
    expect(getByText('every 2s')).toBeTruthy();
  });

  it('marks the default server', async () => {
    const first = addEndpoint('A');
    addEndpoint('B');

    const { getByTestId, queryByTestId } = await renderWithProviders(<SettingsScreen />);

    expect(getByTestId(`server-default-${first.id}`)).toBeTruthy();
    expect(queryByTestId('server-default-s-2')).toBeNull();
  });

  it('switches the default server', async () => {
    addEndpoint('A');
    const second = addEndpoint('B');

    const { getByTestId, user } = await renderWithProviders(<SettingsScreen />);
    await user.press(getByTestId(`server-make-default-${second.id}`));

    expect(useEndpointsStore.getState().defaultEndpointId).toBe(second.id);
  });

  it('requires confirmation before deleting, and warns about widgets', async () => {
    const server = addEndpoint('A');
    useWidgetsStore.getState().addWidget({ type: 'cpuText', endpointId: server.id });

    const { getByTestId, getByText, user } = await renderWithProviders(<SettingsScreen />);
    await user.press(getByTestId(`server-delete-${server.id}`));

    expect(getByText('Delete this endpoint and its 1 widget?')).toBeTruthy();
    expect(useEndpointsStore.getState().endpoints).toHaveLength(1);
  });

  it('deletes the server and its widgets once confirmed', async () => {
    const server = addEndpoint('A');
    useWidgetsStore.getState().addWidget({ type: 'cpuText', endpointId: server.id });
    useWidgetsStore.getState().addWidget({ type: 'memoryText', endpointId: 'other' });

    const { getByTestId, user } = await renderWithProviders(<SettingsScreen />);
    await user.press(getByTestId(`server-delete-${server.id}`));
    await user.press(getByTestId(`server-confirm-delete-${server.id}`));

    expect(useEndpointsStore.getState().endpoints).toHaveLength(0);
    expect(useWidgetsStore.getState().widgets.map((w) => w.endpointId)).toEqual(['other']);
  });

  it('navigates to the add-server form', async () => {
    const { getByTestId, user } = await renderWithProviders(<SettingsScreen />);
    await user.press(getByTestId('add-server'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/settings/server/[id]',
      params: { id: 'new' },
    });
  });

  it('navigates to the edit form for a server', async () => {
    const server = addEndpoint('A');

    const { getByTestId, user } = await renderWithProviders(<SettingsScreen />);
    await user.press(getByTestId(`server-edit-${server.id}`));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/settings/server/[id]',
      params: { id: server.id },
    });
  });
});


describe('SettingsScreen — appearance', () => {
  beforeEach(() => {
    usePreferencesStore.setState({ theme: 'dark', readingScale: 1, summaryStripVisible: true });
  });

  it('switches the theme', async () => {
    const { getByTestId, user } = await renderWithProviders(<SettingsScreen />);

    await user.press(getByTestId('theme-light'));

    expect(usePreferencesStore.getState().theme).toBe('light');
  });

  it('sets the reading-channel scale, and only that channel', async () => {
    const { getByTestId, user } = await renderWithProviders(<SettingsScreen />);

    await user.press(getByTestId('reading-scale-large'));

    expect(usePreferencesStore.getState().readingScale).toBe(1.2);
    // Hero numerals size off the widget box, so nothing here can reach them —
    // see utils/typeScale.ts. This is a contract, not an implementation detail.
    expect(heroFontSize(400)).toBe(40);
  });

  it('toggles the summary strip', async () => {
    const { getByTestId, user } = await renderWithProviders(<SettingsScreen />);

    await user.press(getByTestId('toggle-summary-strip'));

    expect(usePreferencesStore.getState().summaryStripVisible).toBe(false);
  });

  it('recolours an endpoint, and the change sticks', async () => {
    const endpoint = useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1' });
    // A new endpoint has no accent — the chip shows its state instead.
    expect(endpoint.color).toBeNull();

    const { getByTestId, user } = await renderWithProviders(<SettingsScreen />);
    await user.press(getByTestId(`server-accent-${endpoint.id}-cyan`));

    expect(useEndpointsStore.getState().endpoints[0].color).toBe('cyan');
  });

  it('clears the accent again, which is its reset', async () => {
    const endpoint = useEndpointsStore
      .getState()
      .addEndpoint({ name: 'NAS', url: '10.0.0.1', color: 'amber' });

    const { getByTestId, user } = await renderWithProviders(<SettingsScreen />);
    await user.press(getByTestId(`server-accent-${endpoint.id}-none`));

    expect(useEndpointsStore.getState().endpoints[0].color).toBeNull();
  });

  it('pauses an endpoint without deleting it or its widgets', async () => {
    // Pausing has to be visibly different from a failure, and must not cost the board its widgets.
    const endpoint = useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1' });
    useWidgetsStore.getState().addWidget({ type: 'cpuText', endpointId: endpoint.id });

    const { getByTestId, user } = await renderWithProviders(<SettingsScreen />);
    await user.press(getByTestId(`server-toggle-enabled-${endpoint.id}`));

    expect(useEndpointsStore.getState().endpoints[0].enabled).toBe(false);
    expect(useWidgetsStore.getState().widgets).toHaveLength(1);
    expect(getByTestId(`server-state-${endpoint.id}`)).toHaveTextContent(/Paused/);
  });
});
