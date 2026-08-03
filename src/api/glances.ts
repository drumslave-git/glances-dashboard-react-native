/**
 * Thin client for the Glances REST API (v4). Everything is a plain GET returning
 * JSON; there is no auth in scope.
 */
import { Platform } from 'react-native';

export const GLANCES_DEFAULT_PORT = 61208;

export const GLANCES_ENDPOINTS = {
  pluginsList: '/api/4/pluginslist',
  system: '/api/4/system',
  // The summary strip's five live cells. Kept here so the strip does not invent
  // paths of its own — every read in this app goes through one of these.
  uptime: '/api/4/uptime',
  load: '/api/4/load',
  processCount: '/api/4/processcount',
  fs: '/api/4/fs',
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
 *
 * A typed-out scheme is taken as deliberate and left alone — a Glances behind a
 * reverse proxy (https://glances.example.com) is served on the scheme's default
 * port, and forcing :61208 onto it would break the address.
 */
export function coerceServerUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) return normalizeBaseUrl(trimmed);

  const normalized = normalizeBaseUrl(`http://${trimmed}`);
  // Bare host: assume a direct `glances -w`, which listens on 61208.
  const match = /^(http:\/\/)([^/:]+)(:\d+)?(.*)$/i.exec(normalized);
  if (!match) return normalized;
  const [, scheme, host, port, rest] = match;
  return `${scheme}${host}${port ?? `:${GLANCES_DEFAULT_PORT}`}${rest}`;
}

/**
 * A browser refuses to tell a page *why* a cross-origin request failed — a
 * blocked origin and an unplugged server both arrive as a bare
 * `TypeError: Failed to fetch`. So on web the message gets the missing half
 * spelled out, because CORS is the failure a working Android build never sees
 * and a first-time web user always hits.
 */
export function describeNetworkError(error: unknown): string {
  const message = error instanceof Error && error.message ? error.message : 'Network request failed';
  if (Platform.OS !== 'web') return message;
  return `${message} — the server is unreachable, or it is not allowing requests from this page (CORS).`;
}

export async function fetchGlances<T>(
  baseUrl: string,
  endpointPath: string,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildEndpointUrl(baseUrl, endpointPath), { signal });
  } catch (error) {
    // A cancelled request is not a failure to report; let it through untouched.
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new GlancesRequestError(describeNetworkError(error));
  }

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
