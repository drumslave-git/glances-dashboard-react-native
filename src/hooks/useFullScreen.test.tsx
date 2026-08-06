import { BackHandler, Platform } from 'react-native';

import { renderWithProviders, waitFor } from '@/test-utils/render';

import {
  useBrowserFullScreen,
  useHardwareBackExit,
  usePointerReveal,
  useShortcuts,
  type Shortcuts,
} from './useFullScreen';

function BackSubject({ active, onExit }: { active: boolean; onExit: () => void }) {
  useHardwareBackExit(active, onExit);
  return null;
}

/** The most recent handler registered for the Android back press. */
function lastBackHandler(spy: jest.SpyInstance) {
  const call = spy.mock.calls.at(-1);
  return call?.[1] as (() => boolean) | undefined;
}

describe('useHardwareBackExit', () => {
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
    await renderWithProviders(<BackSubject active onExit={onExit} />);

    const handler = lastBackHandler(addSpy);
    expect(handler).toBeDefined();
    expect(handler!()).toBe(true);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('does not register a handler while inactive', async () => {
    await renderWithProviders(<BackSubject active={false} onExit={jest.fn()} />);

    expect(addSpy).not.toHaveBeenCalled();
  });

  it('unregisters when it stops being active', async () => {
    const { rerender } = await renderWithProviders(<BackSubject active onExit={jest.fn()} />);

    expect(remove).not.toHaveBeenCalled();
    await rerender(<BackSubject active={false} onExit={jest.fn()} />);

    expect(remove).toHaveBeenCalled();
  });
});

/**
 * React Native's test environment has a `window` global without DOM listener methods, so the
 * browser side is exercised by standing them in and firing the captured handler directly.
 */
describe('web behaviours', () => {
  const originalOS = Platform.OS;
  const globalWindow = window as unknown as Record<string, unknown>;

  let add: jest.Mock;
  let removeListener: jest.Mock;

  beforeEach(() => {
    add = jest.fn();
    removeListener = jest.fn();
    // Left in place afterwards rather than deleted: TanStack Query's focus manager subscribes
    // while they exist and unsubscribes during RNTL's cleanup, which runs after this afterEach.
    globalWindow.addEventListener = add;
    globalWindow.removeEventListener = removeListener;
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  function setPlatform(os: typeof Platform.OS) {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  }

  /** The handler the hook registered for one event name. */
  function handlerFor(name: string) {
    return add.mock.calls.find(([registered]) => registered === name)?.[1];
  }

  describe('useShortcuts', () => {
    function ShortcutSubject(handlers: Shortcuts) {
      useShortcuts(handlers);
      return null;
    }

    const noop = () => undefined;

    async function renderShortcuts(over: Partial<Shortcuts>) {
      const handlers: Shortcuts = {
        onAddWidget: noop,
        onToggleEditMode: noop,
        onToggleFullScreen: noop,
        onOpenSettings: noop,
        onEscape: noop,
        ...over,
      };
      await renderWithProviders(<ShortcutSubject {...handlers} />);
      return (event: Partial<KeyboardEvent>) =>
        handlerFor('keydown')?.({ preventDefault: noop, ...event });
    }

    it('leaves full screen on Escape', async () => {
      setPlatform('web');
      const onEscape = jest.fn();
      const press = await renderShortcuts({ onEscape });

      press({ key: 'Escape' });

      expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('toggles full screen on F11, with no modifier', async () => {
      setPlatform('web');
      const onToggleFullScreen = jest.fn();
      const press = await renderShortcuts({ onToggleFullScreen });

      press({ key: 'F11' });

      expect(onToggleFullScreen).toHaveBeenCalledTimes(1);
    });

    it('adds a widget on Ctrl+N and toggles edit mode on Ctrl+E', async () => {
      setPlatform('web');
      const onAddWidget = jest.fn();
      const onToggleEditMode = jest.fn();
      const press = await renderShortcuts({ onAddWidget, onToggleEditMode });

      press({ key: 'n', ctrlKey: true });
      press({ key: 'e', ctrlKey: true });

      expect(onAddWidget).toHaveBeenCalledTimes(1);
      expect(onToggleEditMode).toHaveBeenCalledTimes(1);
    });

    it('ignores an unmodified letter — the grid is not a text field, but the config screens are', async () => {
      setPlatform('web');
      const onAddWidget = jest.fn();
      const press = await renderShortcuts({ onAddWidget });

      press({ key: 'n' });

      expect(onAddWidget).not.toHaveBeenCalled();
    });

    it('ignores a key repeat', async () => {
      setPlatform('web');
      const onToggleFullScreen = jest.fn();
      const press = await renderShortcuts({ onToggleFullScreen });

      press({ key: 'F11', repeat: true });

      expect(onToggleFullScreen).not.toHaveBeenCalled();
    });

    it('does not listen at all off web', async () => {
      setPlatform('android');
      await renderShortcuts({});

      expect(handlerFor('keydown')).toBeUndefined();
    });
  });

  describe('usePointerReveal', () => {
    function RevealSubject({ active, onState }: { active: boolean; onState: (near: boolean) => void }) {
      onState(usePointerReveal(active));
      return null;
    }

    it('opens at the top edge and closes well below it', async () => {
      setPlatform('web');
      const states: boolean[] = [];
      await renderWithProviders(<RevealSubject active onState={(near) => states.push(near)} />);

      const listener = handlerFor('mousemove');
      expect(listener).toBeDefined();
      expect(states.at(-1)).toBe(false);
      // A real DOM listener is outside React's event system, so each call needs its own flush
      // before the state it set can be asserted on.
      const move = async (clientY: number) => {
        listener({ clientY });
        await waitFor(() => undefined);
      };

      await move(2);
      expect(states.at(-1)).toBe(true);

      // Inside the dead band the bar stays put — this is what stops it flickering under the cursor.
      await move(40);
      expect(states.at(-1)).toBe(true);

      await move(200);
      expect(states.at(-1)).toBe(false);
    });

    it('never reveals while inactive, even with the pointer at the very top', async () => {
      setPlatform('web');
      const states: boolean[] = [];
      await renderWithProviders(<RevealSubject active={false} onState={(near) => states.push(near)} />);

      // The listener stays subscribed either way — tearing it down would leave `near` describing
      // where the pointer was when full screen ended.
      handlerFor('mousemove')({ clientY: 1 });
      await waitFor(() => undefined);

      expect(states.at(-1)).toBe(false);
    });
  });

  describe('useBrowserFullScreen', () => {
    function FullScreenSubject({ active, onExit }: { active: boolean; onExit: () => void }) {
      useBrowserFullScreen(active, onExit);
      return null;
    }

    const originalDocument = (globalThis as { document?: unknown }).document;

    function stubDocument(over: Partial<Document> = {}) {
      const request = jest.fn().mockResolvedValue(undefined);
      const exit = jest.fn().mockResolvedValue(undefined);
      const listeners = new Map<string, (event: Event) => void>();
      const doc = {
        documentElement: { requestFullscreen: request },
        fullscreenElement: null,
        exitFullscreen: exit,
        addEventListener: (name: string, handler: (event: Event) => void) => listeners.set(name, handler),
        removeEventListener: (name: string) => listeners.delete(name),
        ...over,
      };
      Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });
      return { request, exit, listeners, doc };
    }

    afterEach(() => {
      Object.defineProperty(globalThis, 'document', { value: originalDocument, configurable: true });
    });

    it('asks the browser for fullscreen on the way in', async () => {
      setPlatform('web');
      const { request } = stubDocument();

      await renderWithProviders(<FullScreenSubject active onExit={jest.fn()} />);

      expect(request).toHaveBeenCalled();
    });

    it('gives it back on the way out', async () => {
      setPlatform('web');
      const { exit } = stubDocument({ fullscreenElement: {} as Element });

      await renderWithProviders(<FullScreenSubject active={false} onExit={jest.fn()} />);

      expect(exit).toHaveBeenCalled();
    });

    it('follows the user out when the browser leaves fullscreen on its own', async () => {
      setPlatform('web');
      const onExit = jest.fn();
      const { listeners } = stubDocument();

      await renderWithProviders(<FullScreenSubject active onExit={onExit} />);
      listeners.get('fullscreenchange')?.(new Event('fullscreenchange'));

      expect(onExit).toHaveBeenCalledTimes(1);
    });

    it('does nothing off web', async () => {
      setPlatform('android');
      const { request } = stubDocument();

      await renderWithProviders(<FullScreenSubject active onExit={jest.fn()} />);

      expect(request).not.toHaveBeenCalled();
    });
  });
});
