import { usePreferencesStore } from '@/state/preferences';
import { resetServerIdCounter, useServersStore } from '@/state/servers';
import { useWidgetsStore } from '@/state/widgets';
import { renderWithProviders } from '@/test-utils/render';
import { heroFontSize } from '@/utils/typeScale';
import { resetWidgetIdCounter } from '@/utils/widgetFactory';

import { SettingsScreen } from './settings-screen';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  resetServerIdCounter();
  resetWidgetIdCounter();
  useServersStore.setState({ servers: [], defaultServerId: null });
  useWidgetsStore.setState({ widgets: [] });
});

function addServer(name: string, url = '10.0.0.1') {
  return useServersStore.getState().addServer({ name, url });
}

describe('SettingsScreen', () => {
  it('shows an empty state when no servers exist', async () => {
    const { getByTestId } = await renderWithProviders(<SettingsScreen />);

    expect(getByTestId('servers-empty')).toBeTruthy();
  });

  it('lists servers with their address and refresh interval', async () => {
    addServer('NAS');
    const { getByText } = await renderWithProviders(<SettingsScreen />);

    expect(getByText('NAS')).toBeTruthy();
    expect(getByText('http://10.0.0.1:61208')).toBeTruthy();
    expect(getByText('every 5s')).toBeTruthy();
  });

  it('marks the default server', async () => {
    const first = addServer('A');
    addServer('B');

    const { getByTestId, queryByTestId } = await renderWithProviders(<SettingsScreen />);

    expect(getByTestId(`server-default-${first.id}`)).toBeTruthy();
    expect(queryByTestId('server-default-s-2')).toBeNull();
  });

  it('switches the default server', async () => {
    addServer('A');
    const second = addServer('B');

    const { getByTestId, user } = await renderWithProviders(<SettingsScreen />);
    await user.press(getByTestId(`server-make-default-${second.id}`));

    expect(useServersStore.getState().defaultServerId).toBe(second.id);
  });

  it('requires confirmation before deleting, and warns about widgets', async () => {
    const server = addServer('A');
    useWidgetsStore.getState().addWidget({ serverId: server.id, metric: 'cpu' });

    const { getByTestId, getByText, user } = await renderWithProviders(<SettingsScreen />);
    await user.press(getByTestId(`server-delete-${server.id}`));

    expect(getByText('Delete this server and its 1 widget?')).toBeTruthy();
    expect(useServersStore.getState().servers).toHaveLength(1);
  });

  it('deletes the server and its widgets once confirmed', async () => {
    const server = addServer('A');
    useWidgetsStore.getState().addWidget({ serverId: server.id, metric: 'cpu' });
    useWidgetsStore.getState().addWidget({ serverId: 'other', metric: 'mem' });

    const { getByTestId, user } = await renderWithProviders(<SettingsScreen />);
    await user.press(getByTestId(`server-delete-${server.id}`));
    await user.press(getByTestId(`server-confirm-delete-${server.id}`));

    expect(useServersStore.getState().servers).toHaveLength(0);
    expect(useWidgetsStore.getState().widgets.map((w) => w.serverId)).toEqual(['other']);
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
    const server = addServer('A');

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

  it('recolours an endpoint, and the change sticks to the server', async () => {
    const server = useServersStore.getState().addServer({ name: 'NAS', url: '10.0.0.1' });

    const { getByTestId, user } = await renderWithProviders(<SettingsScreen />);
    await user.press(getByTestId(`server-accent-${server.id}-2`));

    expect(useServersStore.getState().servers[0].accentIndex).toBe(2);
  });
});
