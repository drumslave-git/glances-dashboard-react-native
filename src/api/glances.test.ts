import { Platform } from 'react-native';

import { cpuFixture, pluginsListFixture, systemFixture } from '@/__fixtures__/glances';

import {
  buildEndpointUrl,
  coerceServerUrl,
  describeNetworkError,
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

  it('leaves an explicit https url alone, so proxied servers keep port 443', () => {
    expect(coerceServerUrl('https://glances.example.com')).toBe('https://glances.example.com');
    expect(coerceServerUrl('https://glances.example.com/')).toBe('https://glances.example.com');
  });

  it('leaves an explicit http url alone', () => {
    expect(coerceServerUrl('http://host')).toBe('http://host');
    expect(coerceServerUrl('http://host:1234')).toBe('http://host:1234');
  });

  it('preserves a path suffix on a bare host', () => {
    expect(coerceServerUrl('host/glances')).toBe('http://host:61208/glances');
  });

  it('returns empty for blank input', () => {
    expect(coerceServerUrl('   ')).toBe('');
  });
});

describe('against real captured payloads', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('reads a real system payload for the header', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => systemFixture,
    }) as unknown as typeof fetch;

    await expect(testGlancesConnection('https://glances.example.com')).resolves.toEqual({
      ok: true,
      hostname: 'TCloud',
    });
  });

  it('reads a real pluginslist as a string array', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => pluginsListFixture,
    }) as unknown as typeof fetch;

    const plugins = await fetchGlances<string[]>('https://glances.example.com', '/api/4/pluginslist');
    expect(plugins).toContain('cpu');
    expect(plugins).toContain('processlist');
  });

  it('reads a real cpu payload as an object of numbers', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => cpuFixture,
    }) as unknown as typeof fetch;

    const cpu = await fetchGlances<Record<string, number>>(
      'https://glances.example.com',
      '/api/4/cpu',
    );
    expect(cpu.total).toBeCloseTo(46.8);
    expect(cpu.cpucore).toBe(12);
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

  it('turns a rejected fetch into a GlancesRequestError', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;

    await expect(fetchGlances('http://host:61208', '/api/4/cpu')).rejects.toThrow(
      GlancesRequestError,
    );
  });

  it('lets an abort through as itself, so a cancelled query is not an error state', async () => {
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    global.fetch = jest.fn().mockRejectedValue(abort) as unknown as typeof fetch;

    await expect(fetchGlances('http://host:61208', '/api/4/cpu')).rejects.toBe(abort);
  });
});

describe('describeNetworkError', () => {
  // Platform.OS is 'ios' under jest-expo's default project, so this covers the
  // native branch; the web branch is asserted by overriding it.
  it('passes a native failure through unchanged', () => {
    expect(describeNetworkError(new TypeError('Network request failed'))).toBe(
      'Network request failed',
    );
  });

  it('names CORS as the other explanation on web', () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
      const message = describeNetworkError(new TypeError('Failed to fetch'));
      expect(message).toMatch(/^Failed to fetch/);
      expect(message).toMatch(/CORS/);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    }
  });

  it('falls back to a message when the thrown value has none', () => {
    expect(describeNetworkError('boom')).toBe('Network request failed');
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
