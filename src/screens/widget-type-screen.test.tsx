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

  it('opens the config screen for every kind', async () => {
    const { getByTestId, user } = await renderWithProviders(<WidgetTypeScreen />);

    for (const kind of ['text', 'donut', 'pie', 'bar', 'processes']) {
      mockReplace.mockClear();
      await user.press(getByTestId(`widget-type-${kind}`));
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/widget/[id]',
        params: { id: 'new', kind },
      });
    }
  });

  it('can be cancelled', async () => {
    const { getByTestId, user } = await renderWithProviders(<WidgetTypeScreen />);
    await user.press(getByTestId('widget-type-cancel'));

    expect(mockBack).toHaveBeenCalled();
  });
});
