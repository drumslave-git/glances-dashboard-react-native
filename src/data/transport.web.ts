/**
 * The web half of the HTTP seam — see `transport.ts` for the contract.
 *
 * `Platform.OS === 'web'` is true in **two** very different places: a real browser tab, and the
 * Tauri desktop window, which runs this same bundle inside WebView2. They differ in exactly the way
 * that matters here.
 *
 * **In a browser**, `fetch` is bound by CORS, and that is not a theoretical limit. A Glances served
 * behind a reverse proxy typically 301s `http://host` to `https://host`, and **the redirect
 * response carries no `Access-Control-Allow-Origin`** — so the browser refuses to follow it and the
 * page sees a bare `TypeError: Failed to fetch`, with no way to tell that from an unplugged server.
 * Nothing in this app can fix that; only the server's own config can.
 *
 * **In Tauri**, the request can be handed to Rust instead. That is the desktop equivalent of the
 * reference's main-process poller (ref §3): no origin, so no CORS, redirects followed, and no
 * private-network gating. The URLs it may reach are scoped in
 * `src-tauri/capabilities/default.json`.
 *
 * The Tauri module is imported **lazily and only when Tauri is detected**, so a plain web build
 * never evaluates it — it would throw on a missing IPC bridge.
 */
import type { HttpGet, HttpResponse } from './transport';

/**
 * Tauri v2 installs this on `window` before any app code runs. Checked rather than relying on a
 * build-time flag, because the desktop target ships the *same* bundle as the web target — there is
 * no desktop-only build to branch at compile time.
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

type TauriFetch = (input: string, init?: RequestInit) => Promise<Response>;

let tauriFetchPromise: Promise<TauriFetch | undefined> | undefined;

/**
 * Resolve Tauri's `fetch` once and cache the promise, so concurrent first polls share one import
 * rather than racing several. A failure resolves to `undefined` — falling back to the browser's
 * `fetch` leaves a degraded desktop build rather than no desktop build.
 */
function loadTauriFetch(): Promise<TauriFetch | undefined> {
  tauriFetchPromise ??= import('@tauri-apps/plugin-http')
    .then((module) => module.fetch as TauriFetch)
    .catch(() => undefined);
  return tauriFetchPromise;
}

async function toResponse(response: Response): Promise<HttpResponse> {
  const text = await response.text();
  return { status: response.status, ok: response.ok, text };
}

export const httpGet: HttpGet = async (url, signal) => {
  const request = isTauri() ? ((await loadTauriFetch()) ?? fetch) : fetch;
  const response = await request(url, { signal, headers: { Accept: 'application/json' } });
  return toResponse(response);
};

/**
 * True only in a real browser tab. The desktop window reports `web` for `Platform.OS` but is not
 * CORS-bound, so a message blaming CORS there would send the user chasing a setting that is not
 * their problem.
 *
 * A function rather than a const on purpose: a module-level `isTauri()` would be evaluated when
 * this module is first imported, and binding a platform fact at module-eval time is how the M3
 * CanvasKit bug happened. Called on demand, the answer cannot be captured too early.
 */
export function httpIsCorsBound(): boolean {
  return !isTauri();
}
