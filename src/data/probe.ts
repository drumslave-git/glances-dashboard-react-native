/**
 * Endpoint probing: what version, which plugins, which thresholds (ref §4.1).
 *
 * `probeEndpoint` never throws — every failure mode comes back as a structured `ProbeResult`, so
 * the endpoint form and the poller can both render it without a try/catch of their own.
 */
import type { ProbeResult } from '@/types/glances';
import { httpGet, type HttpGet } from './transport';

export const DEFAULT_GLANCES_PORT = 61208;
const PROBE_TIMEOUT_MS = 5000;

/** Bare IPv4, or anything with a colon (IPv6, host:port) — the cases where a name lookup is moot. */
const IP_LITERAL = /^(\d{1,3}\.){3}\d{1,3}$/;

/**
 * Accept what a user actually types — `192.168.1.10`, `host:61208`, `http://host/`,
 * `https://glances.example.com/` — and return the base that `/api/4/...` hangs off.
 *
 * Two rules, both learned the hard way:
 *
 * 1. **Only a bare host gets `:61208`.** A URL typed with a scheme keeps that scheme's default
 *    port, because a reverse-proxied instance listens on 443, not on the Glances port.
 * 2. **A bare *hostname* gets `https`, a bare *IP* gets `http`.** A name almost always means a
 *    proxy in front, and such a server typically 301s `http` to `https` — a redirect whose response
 *    carries no CORS header, so a browser blocks it before following and the user sees nothing but
 *    "Failed to fetch". An IP literal on the LAN is the opposite case: it is a direct `glances -w`,
 *    which speaks plain http and has no certificate. Guessing right matters more than it looks,
 *    because guessing wrong is indistinguishable from an unreachable server.
 *
 * A path is preserved when present, so a Glances served under a sub-path also works.
 */
export function normalizeEndpointUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('URL is required');

  const hasScheme = /^https?:\/\//i.test(trimmed);
  const hostPart = trimmed.split('/')[0]?.split(':')[0] ?? '';
  const looksLikeIp = IP_LITERAL.test(hostPart);
  const assumedScheme = looksLikeIp ? 'http' : 'https';

  let url: URL;
  try {
    url = new URL(hasScheme ? trimmed : `${assumedScheme}://${trimmed}`);
  } catch {
    throw new Error(`"${input}" is not a valid URL`);
  }
  if (!url.hostname) throw new Error(`"${input}" is missing a host name`);
  // Only a bare IP is assumed to be a direct `glances -w` on its own port; a name is assumed
  // proxied, and a proxy answers on the scheme's default port.
  if (!hasScheme && !url.port && looksLikeIp) url.port = String(DEFAULT_GLANCES_PORT);

  const basePath = url.pathname.replace(/\/+$/, '');
  return `${url.protocol}//${url.host}${basePath}`;
}

export function apiUrl(base: string, path: string, version = 4): string {
  return `${base}/api/${version}/${path.replace(/^\//, '')}`;
}

interface JsonResult {
  status: number;
  body: unknown;
}

async function getJson(get: HttpGet, url: string, signal?: AbortSignal): Promise<JsonResult> {
  const response = await get(url, signal);
  let body: unknown;
  try {
    body = response.text ? JSON.parse(response.text) : undefined;
  } catch {
    // A 404 HTML page is not a parse failure worth reporting — the status already says everything.
    body = undefined;
  }
  return { status: response.status, body };
}

/** `cpu_total_warning`, `mem_critical`, … — the only keys that mean anything for colouring. */
const THRESHOLD_KEY = /_(careful|warning|critical)$/;

/**
 * Flatten `/api/4/all/limits` into a `<plugin>_<stat>_<level>` numeric map.
 *
 * Verified against 4.5.6: the response is keyed by plugin, and each plugin block mixes the flat
 * threshold numbers with unrelated entries — `history_size` (a number, and identical across
 * blocks), plus `*_disable` / `*_log` string arrays. Only threshold keys survive.
 */
export function flattenLimits(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;

  const collect = (source: Record<string, unknown>): void => {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'number' && Number.isFinite(value) && THRESHOLD_KEY.test(key)) {
        out[key] = value;
      }
    }
  };

  const top = raw as Record<string, unknown>;
  for (const value of Object.values(top)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      collect(value as Record<string, unknown>);
    }
  }
  // Tolerate an already-flat map, should a build ever return one.
  collect(top);
  return out;
}

function toStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === 'string');
  if (raw && typeof raw === 'object') return Object.keys(raw as Record<string, unknown>);
  return [];
}

function timeout(signal?: AbortSignal): AbortSignal | undefined {
  if (signal) return signal;
  // `AbortSignal.timeout` is missing on older Hermes builds; a probe without one still completes.
  return typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(PROBE_TIMEOUT_MS) : undefined;
}

/**
 * Probe an endpoint: version, plugin list and limits.
 *
 * `get` is injectable so the whole function is testable without a network — the poller passes the
 * platform transport, tests pass a stub.
 */
export async function probeEndpoint(origin: string, get: HttpGet = httpGet): Promise<ProbeResult> {
  let status: JsonResult;
  try {
    status = await getJson(get, apiUrl(origin, 'status'), timeout());
  } catch (error) {
    return {
      ok: false,
      reason: 'unreachable',
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (status.status === 404) {
    // v3 answers /api/3/status with 200 and an empty body. Probed purely so the message can name
    // the real problem instead of reporting a generic failure (ref §4.1).
    const v3 = await getJson(get, apiUrl(origin, 'status', 3), timeout()).catch(() => undefined);
    if (v3 && v3.status === 200) {
      return {
        ok: false,
        reason: 'unsupported-version',
        message:
          'This server speaks the Glances 3.x API, which this app does not support. Upgrade the server to Glances 4.x.',
        detectedVersion: '3.x',
      };
    }
    return {
      ok: false,
      reason: 'bad-response',
      message: `No Glances API at ${apiUrl(origin, 'status')} (HTTP 404).`,
    };
  }

  if (status.status !== 200) {
    return {
      ok: false,
      reason: 'bad-response',
      message: `Unexpected HTTP ${status.status} from /api/4/status.`,
    };
  }

  const version =
    status.body && typeof status.body === 'object' && typeof (status.body as { version?: unknown }).version === 'string'
      ? (status.body as { version: string }).version
      : undefined;

  if (!version) {
    return {
      ok: false,
      reason: 'bad-response',
      message: '/api/4/status did not report a version — this does not look like a Glances 4 server.',
    };
  }
  if (!version.startsWith('4.')) {
    return {
      ok: false,
      reason: 'unsupported-version',
      message: `Glances ${version} is not supported — this app targets the 4.x API.`,
      detectedVersion: version,
    };
  }

  // Capabilities and limits are best-effort: a server that answers /status but not these is still
  // perfectly usable, just with an unfiltered catalog and no threshold colouring.
  const [plugins, limits] = await Promise.all([
    getJson(get, apiUrl(origin, 'pluginslist'), timeout()).catch(() => undefined),
    getJson(get, apiUrl(origin, 'all/limits'), timeout()).catch(() => undefined),
  ]);

  return {
    ok: true,
    glancesVersion: version,
    capabilities: plugins?.status === 200 ? toStringArray(plugins.body) : [],
    limits: limits?.status === 200 ? flattenLimits(limits.body) : {},
  };
}
