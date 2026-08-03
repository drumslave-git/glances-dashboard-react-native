import {
  buildEndpointUrl,
  coerceServerUrl,
  fetchGlances,
  GlancesRequestError,
  normalizeBaseUrl,
  normalizeEndpointPath,
  testGlancesConnection,
} from './glances';

describe('normalizeBaseUrl', () => {
  it('strips trailing slashes and surrounding space', () => {
    expect(normalizeBaseUrl('http://host:61208/')).toBe('http://host:61208');
    expect(normalizeBaseUrl('http://host:61208///')).toBe('http://host:61208');
    expect(normalizeBaseUrl('  http://host:61208  ')).toBe('http://host:61208');
  });
});

describe('normalizeEndpointPath', () => {
  it('adds a leading slash when missing', () => {
    expect(normalizeEndpointPath('api/4/cpu')).toBe('/api/4/cpu');
    expect(normalizeEndpointPath('/api/4/cpu')).toBe('/api/4/cpu');
  });
});

describe('buildEndpointUrl', () => {
  it('joins base and path without doubling slashes', () => {
    expect(buildEndpointUrl('http://host:61208/', '/api/4/cpu')).toBe('http://host:61208/api/4/cpu');
    expect(buildEndpointUrl('http://host:61208', 'api/4/cpu')).toBe('http://host:61208/api/4/cpu');
  });
});

describe('coerceServerUrl', () => {
  it('adds scheme and default port to a bare host', () => {
    expect(coerceServerUrl('192.168.1.10')).toBe('http://192.168.1.10:61208');
  });

  it('keeps an explicit port', () => {
    expect(coerceServerUrl('192.168.1.10:1234')).toBe('http://192.168.1.10:1234');
  });

  it('keeps an explicit scheme', () => {
    expect(coerceServerUrl('https://glances.example.com')).toBe('https://glances.example.com:61208');
  });

  it('preserves a path suffix', () => {
    expect(coerceServerUrl('http://host/glances')).toBe('http://host:61208/glances');
  });

  it('returns empty for blank input', () => {
    expect(coerceServerUrl('   ')).toBe('');
  });
});

describe('fetchGlances', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns parsed JSON on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hostname: 'nas' }),
    }) as unknown as typeof fetch;

    await expect(fetchGlances('http://host:61208', '/api/4/system')).resolves.toEqual({
      hostname: 'nas',
    });
    expect(global.fetch).toHaveBeenCalledWith('http://host:61208/api/4/system', {
      signal: undefined,
    });
  });

  it('throws GlancesRequestError with the status on a failed response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }) as unknown as typeof fetch;

    await expect(fetchGlances('http://host:61208', '/api/4/nope')).rejects.toThrow(
      GlancesRequestError,
    );
  });
});

describe('testGlancesConnection', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('reports the hostname when reachable', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hostname: 'nas' }),
    }) as unknown as typeof fetch;

    await expect(testGlancesConnection('http://host:61208')).resolves.toEqual({
      ok: true,
      hostname: 'nas',
    });
  });

  it('returns the error instead of throwing when unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network request failed')) as unknown as typeof fetch;

    await expect(testGlancesConnection('http://host:61208')).resolves.toEqual({
      ok: false,
      error: 'Network request failed',
    });
  });
});
