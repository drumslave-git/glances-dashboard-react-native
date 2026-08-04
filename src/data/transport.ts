/**
 * The HTTP seam every Glances request goes through.
 *
 * It exists because the platforms do not agree on what a request is allowed to do. The reference
 * app polls from its Electron main process precisely to escape the renderer's rules (ref §3), and
 * this module is where the equivalent choice is made here:
 *
 * - **Native (this file)** — plain `fetch`. React Native's networking is not a browser; there is no
 *   origin, so no CORS, and redirects are followed normally.
 * - **Web and desktop (`transport.web.ts`)** — plain `fetch` in a browser, and Tauri's Rust HTTP
 *   client inside the desktop window, which is outside CORS entirely.
 *
 * Keeping the seam this narrow — one function, no headers beyond `Accept`, no retry, no parsing —
 * is what lets `poller.ts` and `probe.ts` stay platform-free and be unit-tested against a stub.
 */

/** Just enough of a response for the poller and the probe; deliberately not a `Response`. */
export interface HttpResponse {
  status: number;
  ok: boolean;
  /** Body as text. Callers parse — a 404 page is not JSON and must not throw here. */
  text: string;
}

export type HttpGet = (url: string, signal?: AbortSignal) => Promise<HttpResponse>;

async function toResponse(response: Response): Promise<HttpResponse> {
  const text = await response.text();
  return { status: response.status, ok: response.ok, text };
}

export const httpGet: HttpGet = async (url, signal) => {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  return toResponse(response);
};

/**
 * Whether requests are bound by the browser's origin rules on this platform.
 *
 * Failure messages consult it: a CORS sentence is the missing half of the explanation in a browser
 * and a lie everywhere else. Always false here — React Native has no origin.
 */
export function httpIsCorsBound(): boolean {
  return false;
}
