import { BackHandler, Platform } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';

import { useImmersiveExit } from './useImmersiveMode';

function Subject({ active, onExit }: { active: boolean; onExit: () => void }) {
  useImmersiveExit(active, onExit);
  return null;
}

/** The most recent handler registered for the Android back press. */
function lastBackHandler(spy: jest.SpyInstance) {
  const call = spy.mock.calls.at(-1);
  return call?.[1] as (() => boolean) | undefined;
}

describe('useImmersiveExit — Android back', () => {
  let addSpy: jest.SpyInstance;
  let remove: jest.Mock;

  beforeEach(() => {
    remove = jest.fn();
    addSpy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockReturnValue({ remove } as unknown as ReturnType<typeof BackHandler.addEventListener>);
  });

  afterEach(() => {
    addSpy.mockRestore();
  });

  it('exits and marks the press handled', async () => {
    const onExit = jest.fn();
    await renderWithProviders(<Subject active onExit={onExit} />);

    const handler = lastBackHandler(addSpy);
    expect(handler).toBeDefined();
    expect(handler!()).toBe(true);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('does not register a handler while inactive', async () => {
    await renderWithProviders(<Subject active={false} onExit={jest.fn()} />);

    expect(addSpy).not.toHaveBeenCalled();
  });

  it('unregisters when it stops being active', async () => {
    const { rerender } = await renderWithProviders(<Subject active onExit={jest.fn()} />);

    expect(remove).not.toHaveBeenCalled();
    await rerender(<Subject active={false} onExit={jest.fn()} />);

    expect(remove).toHaveBeenCalled();
  });
});

/**
 * React Native's test environment has a `window` global without DOM listener
 * methods, so the browser side is exercised by standing them in and firing the
 * captured handler directly.
 */
describe('useImmersiveExit — Esc on web', () => {
  const originalOS = Platform.OS;
  const globalWindow = window as unknown as Record<string, unknown>;

  let add: jest.Mock;
  let removeListener: jest.Mock;

  beforeEach(() => {
    add = jest.fn();
    removeListener = jest.fn();
    // Left in place afterwards rather than deleted: TanStack Query's focus
    // manager subscribes while they exist and unsubscribes during RNTL's
    // cleanup, which runs after this file's afterEach.
    globalWindow.addEventListener = add;
    globalWindow.removeEventListener = removeListener;
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  function setPlatform(os: typeof Platform.OS) {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  }

  /** The keydown handler the hook registered. */
  function keydownHandler(): ((event: { key: string }) => void) | undefined {
    const call = add.mock.calls.find(([name]) => name === 'keydown');
    return call?.[1];
  }

  it('exits on Escape', async () => {
    setPlatform('web');
    const onExit = jest.fn();
    await renderWithProviders(<Subject active onExit={onExit} />);

    keydownHandler()?.({ key: 'Escape' });

    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', async () => {
    setPlatform('web');
    const onExit = jest.fn();
    await renderWithProviders(<Subject active onExit={onExit} />);

    keydownHandler()?.({ key: 'a' });

    expect(onExit).not.toHaveBeenCalled();
  });

  it('unregisters the listener once inactive', async () => {
    setPlatform('web');
    const onExit = jest.fn();
    const { rerender } = await renderWithProviders(<Subject active onExit={onExit} />);

    expect(keydownHandler()).toBeDefined();
    await rerender(<Subject active={false} onExit={onExit} />);

    expect(removeListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('does not listen for Escape off web', async () => {
    setPlatform('android');
    await renderWithProviders(<Subject active onExit={jest.fn()} />);

    expect(keydownHandler()).toBeUndefined();
  });
});
