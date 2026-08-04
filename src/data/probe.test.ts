import { rawLimits } from '@/__fixtures__/payloads';
import type { HttpGet, HttpResponse } from './transport';
import { apiUrl, flattenLimits, normalizeEndpointUrl, probeEndpoint } from './probe';

/** A transport stub: map of url-suffix → response. Anything unlisted 404s. */
function stub(routes: Record<string, Partial<HttpResponse> & { body?: unknown }>): HttpGet {
  return async (url) => {
    const match = Object.entries(routes).find(([suffix]) => url.endsWith(suffix));
    if (!match) return { status: 404, ok: false, text: '<html>not found</html>' };
    const [, response] = match;
    return {
      status: response.status ?? 200,
      ok: (response.status ?? 200) < 400,
      text: response.text ?? (response.body === undefined ? '' : JSON.stringify(response.body)),
    };
  };
}

describe('normalizeEndpointUrl', () => {
  it('keeps a typed-out scheme and its default port', () => {
    // A reverse-proxied Glances listens on 443; appending :61208 would break the address.
    expect(normalizeEndpointUrl('https://glances.example.com')).toBe('https://glances.example.com');
    expect(normalizeEndpointUrl('http://192.168.1.10:61208')).toBe('http://192.168.1.10:61208');
  });

  it('assumes http and the Glances port for a bare IP — a direct `glances -w`', () => {
    expect(normalizeEndpointUrl('192.168.1.10')).toBe('http://192.168.1.10:61208');
  });

  it('assumes https and no port for a bare hostname — almost always a proxy', () => {
    // The bug this rule fixes: http://<name> typically 301s to https, and the redirect carries no
    // CORS header, so a browser blocks it and every widget reads "Failed to fetch".
    expect(normalizeEndpointUrl('glances.example.com')).toBe('https://glances.example.com');
  });

  it('respects an explicit port on a bare host', () => {
    expect(normalizeEndpointUrl('192.168.1.10:8080')).toBe('http://192.168.1.10:8080');
    expect(normalizeEndpointUrl('glances.example.com:8080')).toBe('https://glances.example.com:8080');
  });

  it('preserves a sub-path and strips trailing slashes', () => {
    expect(normalizeEndpointUrl('https://example.com/glances/')).toBe('https://example.com/glances');
    expect(normalizeEndpointUrl('http://host:61208/')).toBe('http://host:61208');
  });

  it('rejects empty and unparseable input', () => {
    expect(() => normalizeEndpointUrl('   ')).toThrow(/required/);
    expect(() => normalizeEndpointUrl('http://')).toThrow(/not a valid URL|missing a host/);
  });
});

describe('apiUrl', () => {
  it('joins without doubling the slash and takes a version', () => {
    expect(apiUrl('http://h:61208', 'cpu')).toBe('http://h:61208/api/4/cpu');
    expect(apiUrl('http://h:61208', '/cpu')).toBe('http://h:61208/api/4/cpu');
    expect(apiUrl('http://h:61208', 'status', 3)).toBe('http://h:61208/api/3/status');
  });
});

describe('flattenLimits', () => {
  it('flattens the real per-plugin blocks into one map', () => {
    const limits = flattenLimits(rawLimits);
    expect(limits['cpu_total_warning']).toBe(75);
    expect(limits['mem_critical']).toBe(90);
  });

  it('keeps only threshold keys, dropping history_size and the string arrays', () => {
    const limits = flattenLimits({
      cpu: { cpu_total_warning: 75, history_size: 1200, cpu_disable: ['False'] },
    });
    expect(limits).toEqual({ cpu_total_warning: 75 });
  });

  it('tolerates an already-flat map and unusable input', () => {
    expect(flattenLimits({ mem_critical: 90 })).toEqual({ mem_critical: 90 });
    expect(flattenLimits(null)).toEqual({});
    expect(flattenLimits('nope')).toEqual({});
  });
});

describe('probeEndpoint', () => {
  it('reports version, capabilities and limits from a healthy 4.x server', async () => {
    const result = await probeEndpoint(
      'http://h',
      stub({
        '/api/4/status': { body: { version: '4.5.6' } },
        '/api/4/pluginslist': { body: ['cpu', 'mem', 'gpu'] },
        '/api/4/all/limits': { body: { cpu: { cpu_total_warning: 75 } } },
      }),
    );
    expect(result).toEqual({
      ok: true,
      glancesVersion: '4.5.6',
      capabilities: ['cpu', 'mem', 'gpu'],
      limits: { cpu_total_warning: 75 },
    });
  });

  it('still succeeds when pluginslist and limits are unavailable', async () => {
    // A server that answers /status but not these is usable — just with an unfiltered catalog.
    const result = await probeEndpoint('http://h', stub({ '/api/4/status': { body: { version: '4.5.6' } } }));
    expect(result).toMatchObject({ ok: true, capabilities: [], limits: {} });
  });

  it('names Glances 3.x rather than reporting a generic failure', async () => {
    const result = await probeEndpoint(
      'http://h',
      stub({ '/api/4/status': { status: 404 }, '/api/3/status': { status: 200, text: '' } }),
    );
    expect(result).toMatchObject({ ok: false, reason: 'unsupported-version', detectedVersion: '3.x' });
    expect(result.ok === false && result.message).toMatch(/3\.x/);
  });

  it('reports a 404 with no v3 behind it as a bad response', async () => {
    const result = await probeEndpoint('http://h', stub({}));
    expect(result).toMatchObject({ ok: false, reason: 'bad-response' });
  });

  it('rejects a 5.x server as unsupported', async () => {
    const result = await probeEndpoint('http://h', stub({ '/api/4/status': { body: { version: '5.0.0' } } }));
    expect(result).toMatchObject({ ok: false, reason: 'unsupported-version', detectedVersion: '5.0.0' });
  });

  it('rejects a 200 that carries no version — that is not a Glances server', async () => {
    const result = await probeEndpoint('http://h', stub({ '/api/4/status': { body: { hello: 'world' } } }));
    expect(result).toMatchObject({ ok: false, reason: 'bad-response' });
  });

  it('reports a thrown transport error as unreachable, not as a crash', async () => {
    const result = await probeEndpoint('http://h', async () => {
      throw new Error('Failed to fetch');
    });
    expect(result).toEqual({ ok: false, reason: 'unreachable', message: 'Failed to fetch' });
  });
});
