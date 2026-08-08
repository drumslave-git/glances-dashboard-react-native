/**
 * The point under test: `httpGet` must never hand the caller's signal to the underlying fetch.
 * tauri-plugin-http leaves abort listeners on whatever signal it is given, and a timeout signal
 * firing after completion then cancels Rust resources that were already freed — the continuous
 * "The resource id NNN is invalid" unhandled rejections in the desktop build.
 */
import { httpGet } from './transport.web';

function okResponse(text: string): Response {
  return { status: 200, ok: true, text: async () => text } as unknown as Response;
}

describe('httpGet abort guard', () => {
  const realFetch = globalThis.fetch;
  let seenSignal: AbortSignal | undefined;

  afterEach(() => {
    globalThis.fetch = realFetch;
    seenSignal = undefined;
  });

  function stubFetch(impl?: (init?: RequestInit) => Promise<Response>) {
    globalThis.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
      seenSignal = init?.signal ?? undefined;
      return impl ? impl(init) : okResponse('{"ok":true}');
    }) as unknown as typeof fetch;
  }

  it('converts the response', async () => {
    stubFetch();
    const response = await httpGet('http://example.test/api/4/now');
    expect(response).toEqual({ status: 200, ok: true, text: '{"ok":true}' });
  });

  it('gives fetch its own signal, not the caller’s', async () => {
    stubFetch();
    const controller = new AbortController();
    await httpGet('http://example.test/api/4/now', controller.signal);
    expect(seenSignal).toBeDefined();
    expect(seenSignal).not.toBe(controller.signal);
  });

  it('a signal firing after completion never reaches the fetch-side signal', async () => {
    stubFetch();
    const controller = new AbortController();
    await httpGet('http://example.test/api/4/now', controller.signal);
    controller.abort(new Error('late timeout'));
    expect(seenSignal?.aborted).toBe(false);
  });

  it('an abort while the request is in flight is forwarded, reason intact', async () => {
    const reason = new Error('timed out');
    stubFetch(
      (init) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    const controller = new AbortController();
    const pending = httpGet('http://example.test/api/4/now', controller.signal);
    controller.abort(reason);
    await expect(pending).rejects.toBe(reason);
    expect(seenSignal?.aborted).toBe(true);
  });

  it('a signal already aborted at call time aborts the fetch-side signal immediately', async () => {
    stubFetch();
    const controller = new AbortController();
    controller.abort();
    await httpGet('http://example.test/api/4/now', controller.signal);
    expect(seenSignal?.aborted).toBe(true);
  });
});
