/**
 * Thin client for the Glances REST API (v4). Everything is a plain GET returning
 * JSON; there is no auth in scope.
 */
import { normalizeEndpointUrl } from '@/data/probe';
import { httpGet, httpIsCorsBound, type HttpResponse } from '@/data/transport';

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
 * Users type "192.168.1.10" far more often than a full URL, so fill in the scheme and the default
 * Glances port when they are missing.
 *
 * The rules live in `normalizeEndpointUrl` (`src/data/probe.ts`) — in particular that a bare
 * *hostname* is assumed proxied and gets `https`, while a bare *IP* is assumed to be a direct
 * `glances -w` and gets `http://…:61208`. Getting that backwards is what made a reverse-proxied
 * server unreadable on web: `http://<name>` 301s to https, and the redirect carries no CORS
 * header, so the browser blocks it and reports nothing but "Failed to fetch".
 *
 * This wrapper keeps the settings screen's contract — empty in, empty out, and never throws — so
 * a half-typed address does not blow up a controlled input.
 */
export function coerceServerUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    return normalizeEndpointUrl(trimmed);
  } catch {
    // Still being typed, or not a URL at all. The connection test is where that gets reported.
    return normalizeBaseUrl(trimmed);
  }
}

/**
 * A browser refuses to tell a page *why* a cross-origin request failed — a blocked origin, a
 * redirect whose response carries no CORS header, and an unplugged server all arrive as a bare
 * `TypeError: Failed to fetch`. So in a browser the message gets the missing half spelled out.
 *
 * The condition is `httpIsCorsBound()`, not `Platform.OS === 'web'`: the desktop build reports
 * `web` too, but its requests go through Tauri's Rust client and are not CORS-bound at all. Naming
 * CORS there would send the user chasing a server setting that is not their problem.
 */
export function describeNetworkError(error: unknown): string {
  const message = error instanceof Error && error.message ? error.message : 'Network request failed';
  if (!httpIsCorsBound()) return message;
  return `${message} — the server is unreachable, or it is not allowing requests from this page (CORS).`;
}

/**
 * Requests go through the platform transport (`@/data/transport`), not `fetch` directly. On
 * desktop that is Tauri's Rust client, which is what lets this reach a server the WebView's own
 * `fetch` would be refused — a plain-http endpoint that redirects, or one restricting its origins.
 */
export async function fetchGlances<T>(
  baseUrl: string,
  endpointPath: string,
  signal?: AbortSignal,
): Promise<T> {
  let response: HttpResponse;
  try {
    response = await httpGet(buildEndpointUrl(baseUrl, endpointPath), signal);
  } catch (error) {
    // A cancelled request is not a failure to report; let it through untouched.
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new GlancesRequestError(describeNetworkError(error));
  }

  if (!response.ok) {
    throw new GlancesRequestError(`HTTP ${response.status}`, response.status);
  }

  try {
    return JSON.parse(response.text) as T;
  } catch {
    // A proxy's error page answers 200 with HTML. That is not a Glances server, and saying so
    // beats a raw `Unexpected token <` from the JSON parser.
    throw new GlancesRequestError('Response was not JSON — is this a Glances server?');
  }
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
