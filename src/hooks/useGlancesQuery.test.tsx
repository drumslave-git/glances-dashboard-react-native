import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { GlancesServer } from '@/types/dashboard';

import { useGlancesQuery } from './useGlancesQuery';

const server: GlancesServer = {
  id: 's-1',
  name: 'NAS',
  url: 'http://host:61208',
  refreshMs: 0,
  accentIndex: 0,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

function mockJson(payload: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify(payload),
  }) as unknown as typeof fetch;
}

describe('useGlancesQuery', () => {
  it('fetches the endpoint and returns the payload', async () => {
    mockJson({ total: 12 });

    const { result } = await renderHook(() => useGlancesQuery(server, '/api/4/cpu'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ total: 12 });
    expect(global.fetch).toHaveBeenCalledWith('http://host:61208/api/4/cpu', {
      signal: expect.anything(),
      headers: { Accept: 'application/json' },
    });
  });

  it('stays disabled without a server', async () => {
    mockJson({});

    const { result } = await renderHook(() => useGlancesQuery(undefined, '/api/4/cpu'), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('stays disabled without an endpoint', async () => {
    mockJson({});

    const { result } = await renderHook(() => useGlancesQuery(server, null), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('respects an explicit enabled: false', async () => {
    mockJson({});

    await renderHook(() => useGlancesQuery(server, '/api/4/cpu', { enabled: false }), {
      wrapper: createWrapper(),
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('surfaces request failures as errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: async () => '',
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useGlancesQuery(server, '/api/4/cpu'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('500');
  });

  it('refetches immediately when the server address changes', async () => {
    mockJson({ total: 1 });
    const wrapper = createWrapper();

    const { result, rerender } = await renderHook(
      ({ current }: { current: typeof server }) => useGlancesQuery(current, '/api/4/cpu'),
      { wrapper, initialProps: { current: server } },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('http://host:61208/api/4/cpu', expect.anything());

    await rerender({ current: { ...server, url: 'http://other:61208' } });

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('http://other:61208/api/4/cpu', expect.anything()),
    );
  });

  it('shares one request between widgets on the same server and endpoint', async () => {
    mockJson({ total: 1 });
    const wrapper = createWrapper();

    const { result } = await renderHook(
      () => {
        const a = useGlancesQuery(server, '/api/4/cpu');
        const b = useGlancesQuery(server, '/api/4/cpu');
        return { a, b };
      },
      { wrapper },
    );

    await waitFor(() => expect(result.current.a.isSuccess).toBe(true));
    expect(result.current.b.data).toEqual({ total: 1 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
