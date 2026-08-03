/**
 * Thin client for the Glances REST API (v4). Everything is a plain GET returning
 * JSON; there is no auth in scope.
 */

export const GLANCES_DEFAULT_PORT = 61208;

export const GLANCES_ENDPOINTS = {
  pluginsList: '/api/4/pluginslist',
  system: '/api/4/system',
} as const;

/** Metrics assumed available when a server has not answered /pluginslist yet. */
export const FALLBACK_METRICS = ['cpu', 'mem', 'load', 'fs', 'gpu'];

export class GlancesRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GlancesRequestError';
  }
}

/** Strip trailing slashes so paths can be appended without doubling them. */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

/** Ensure a single leading slash on a relative endpoint path. */
export function normalizeEndpointPath(endpointPath: string): string {
  const trimmed = endpointPath.trim();
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function buildEndpointUrl(baseUrl: string, endpointPath: string): string {
  return `${normalizeBaseUrl(baseUrl)}${normalizeEndpointPath(endpointPath)}`;
}

/**
 * Users type "192.168.1.10" far more often than a full URL, so fill in the
 * scheme and the default Glances port when they are missing.
 */
export function coerceServerUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const normalized = normalizeBaseUrl(withScheme);
  // Add the default port only when the authority carries none of its own.
  const match = /^(https?:\/\/)([^/:]+)(:\d+)?(.*)$/i.exec(normalized);
  if (!match) return normalized;
  const [, scheme, host, port, rest] = match;
  return `${scheme}${host}${port ?? `:${GLANCES_DEFAULT_PORT}`}${rest}`;
}

export async function fetchGlances<T>(
  baseUrl: string,
  endpointPath: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(buildEndpointUrl(baseUrl, endpointPath), { signal });

  if (!response.ok) {
    throw new GlancesRequestError(
      `HTTP ${response.status} ${response.statusText}`.trim(),
      response.status,
    );
  }

  return (await response.json()) as T;
}

/**
 * Probe a server for the settings screen: returns its hostname when reachable.
 * Errors are returned rather than thrown so the UI can show them inline.
 */
export async function testGlancesConnection(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<{ ok: true; hostname?: string } | { ok: false; error: string }> {
  try {
    const system = await fetchGlances<Record<string, unknown>>(
      baseUrl,
      GLANCES_ENDPOINTS.system,
      signal,
    );
    const hostname = typeof system.hostname === 'string' ? system.hostname : undefined;
    return { ok: true, hostname };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
