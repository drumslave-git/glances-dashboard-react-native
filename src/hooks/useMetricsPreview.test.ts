import { renderHook, waitFor } from '@testing-library/react-native';

import { poller } from '@/data/poller';
import type { PluginName } from '@/types/glances';

import { useMetricsPreview } from './useMetricsPreview';

describe('useMetricsPreview', () => {
  const setPreview = jest.spyOn(poller, 'setPreview').mockImplementation(() => undefined);

  beforeEach(() => setPreview.mockClear());
  afterAll(() => setPreview.mockRestore());

  it('asks the poller for the plugins a screen needs', async () => {
    await renderHook(() => useMetricsPreview('e1', ['gpu']));
    expect(setPreview).toHaveBeenCalledWith({ endpointId: 'e1', plugins: ['gpu'] });
  });

  it('clears the request when the screen closes', async () => {
    // A standing request that could accumulate would leave an endpoint polling /gpu for ever
    // because a screen was closed the wrong way.
    const { unmount } = await renderHook(() => useMetricsPreview('e1', ['gpu']));
    unmount();
    // RNTL 14 needs the flush; asserting straight after `unmount` reads the state before the
    // effect cleanup has been committed.
    await waitFor(() => undefined);
    expect(setPreview).toHaveBeenLastCalledWith({ endpointId: null, plugins: [] });
  });

  it('does not re-request when the same names arrive in a fresh array', async () => {
    const { rerender } = await renderHook<void, { plugins: PluginName[] }>(
      ({ plugins }) => useMetricsPreview('e1', plugins),
      { initialProps: { plugins: ['gpu'] } },
    );
    // A fresh array of the same names: the hook keys on the joined names, not on identity.
    rerender({ plugins: ['gpu'] });
    expect(setPreview).toHaveBeenCalledTimes(1);
  });

  it('asks for nothing when there is no endpoint or no plugins', async () => {
    await renderHook(() => useMetricsPreview(null, ['gpu']));
    await renderHook(() => useMetricsPreview('e1', []));
    expect(setPreview).not.toHaveBeenCalled();
  });
});
