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
});

describe('WidgetTypeScreen', () => {
  it('offers every widget kind', async () => {
    const { getByTestId } = await renderWithProviders(<WidgetTypeScreen />);

    for (const kind of ['text', 'donut', 'pie', 'bar', 'processes']) {
      expect(getByTestId(`widget-type-${kind}`)).toBeTruthy();
    }
  });

  it('opens the config screen for an implemented kind', async () => {
    const { getByTestId, user } = await renderWithProviders(<WidgetTypeScreen />);
    await user.press(getByTestId('widget-type-text'));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/widget/[id]',
      params: { id: 'new', kind: 'text' },
    });
  });

  it('opens the config screen for every chart kind', async () => {
    const { getByTestId, user } = await renderWithProviders(<WidgetTypeScreen />);

    for (const kind of ['donut', 'pie', 'bar']) {
      mockReplace.mockClear();
      await user.press(getByTestId(`widget-type-${kind}`));
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/widget/[id]',
        params: { id: 'new', kind },
      });
    }
  });

  it('does not navigate for kinds that are not built yet', async () => {
    const { getByTestId, user } = await renderWithProviders(<WidgetTypeScreen />);
    await user.press(getByTestId('widget-type-processes'));

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('marks unbuilt kinds with the milestone they arrive in', async () => {
    const { getByTestId } = await renderWithProviders(<WidgetTypeScreen />);

    expect(getByTestId('widget-type-processes')).toHaveTextContent(/M4/);
  });

  it('can be cancelled', async () => {
    const { getByTestId, user } = await renderWithProviders(<WidgetTypeScreen />);
    await user.press(getByTestId('widget-type-cancel'));

    expect(mockBack).toHaveBeenCalled();
  });
});
