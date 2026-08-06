import { useEffect, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Full screen and the keyboard, for the three shells this app runs in (ref §7.1).
 *
 * The pieces are separate hooks because they belong to different platforms and fail independently:
 * Android has a back button and no keyboard, a browser has a keyboard and a Fullscreen API, and the
 * Tauri window is the browser one with a real window behind it.
 *
 * React Native defines a `window` global that is **not** a DOM window, so every web branch tests for
 * the listener method rather than for `window` itself.
 */

/** True when a DOM is genuinely present, not merely React Native's `window` stand-in. */
function hasDom(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.addEventListener === 'function'
  );
}

/** True when the event came from somewhere the user is typing. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * The Android way out of full screen. Returning `true` marks the press handled, so it leaves full
 * screen instead of backing out of the dashboard.
 */
export function useHardwareBackExit(active: boolean, onExit: () => void): void {
  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onExit();
      return true;
    });
    return () => subscription.remove();
  }, [active, onExit]);
}

export interface Shortcuts {
  onAddWidget: () => void;
  onToggleEditMode: () => void;
  onToggleFullScreen: () => void;
  onOpenSettings: () => void;
  onEscape: () => void;
}

/**
 * Keyboard basics on web and desktop. Deliberately few and unsurprising: they cover the toolbar's
 * actions, F11, and Escape.
 *
 * Escape is safe to overload because the only things that consume it here are React Native's
 * `Modal`s, which are their own key handlers — an open ⋮ sheet closes without this listener seeing
 * the key.
 */
export function useShortcuts({
  onAddWidget,
  onToggleEditMode,
  onToggleFullScreen,
  onOpenSettings,
  onEscape,
}: Shortcuts): void {
  useEffect(() => {
    if (!hasDom()) return;

    const handler = (event: KeyboardEvent) => {
      if (event.altKey || event.repeat || isTypingTarget(event.target)) return;

      if (event.key === 'Escape') {
        onEscape();
        return;
      }

      // F11 carries no modifier — it is the window manager's own gesture, and the browser will
      // often have acted on it already. Toggling our state keeps the two in step either way.
      if (event.key === 'F11') {
        event.preventDefault();
        onToggleFullScreen();
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) return;

      switch (event.key.toLowerCase()) {
        case 'n':
          event.preventDefault();
          onAddWidget();
          break;
        case 'e':
          event.preventDefault();
          onToggleEditMode();
          break;
        case ',':
          event.preventDefault();
          onOpenSettings();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onAddWidget, onEscape, onOpenSettings, onToggleEditMode, onToggleFullScreen]);
}

/**
 * Hand the *window* to the grid as well as the layout, where there is a window to hand over.
 *
 * The app's own full screen only drops the toolbar out of the flow; on web and in the Tauri
 * WebView2 the browser's Fullscreen API takes the rest — the tab strip, the title bar, the taskbar.
 * The two can be separated by the user (F11 in the browser chrome, or Escape reaching the browser
 * first), so a `fullscreenchange` that leaves fullscreen without us asking is treated as the user
 * saying "out", and the app follows.
 */
export function useBrowserFullScreen(active: boolean, onExit: () => void): void {
  useEffect(() => {
    if (!hasDom() || typeof document === 'undefined') return;
    // Held rather than re-read: the cleanup must unsubscribe from the same document it subscribed
    // to, whatever has happened to the global since.
    const doc = document;
    const root = doc.documentElement;
    if (!root || typeof root.requestFullscreen !== 'function') return;

    if (active && !doc.fullscreenElement) {
      // Rejected when the browser wants a fresher user gesture than the press that got here. The
      // in-app full screen is already applied, so there is nothing to undo — only a window that
      // stayed its old size.
      void root.requestFullscreen().catch(() => undefined);
    } else if (!active && doc.fullscreenElement) {
      void doc.exitFullscreen?.().catch(() => undefined);
    }

    const onChange = () => {
      if (active && !doc.fullscreenElement) onExit();
    };
    doc.addEventListener('fullscreenchange', onChange);
    return () => doc.removeEventListener('fullscreenchange', onChange);
  }, [active, onExit]);
}

/** Within this many pixels of the top edge, the bar comes back. */
export const REVEAL_WITHIN_PX = 8;
/** Past this many, it goes away again. Two thresholds, so it cannot flicker under the cursor. */
export const REVEAL_UNTIL_PX = 80;

/**
 * Whether the pointer is asking for the toolbar back.
 *
 * Tracked from the pointer's position rather than from hover handlers on a strip: the bar animates
 * in *under* the cursor, and a fast move away can outrun the `mouseleave` that was meant to hide it
 * again. Touch platforms have no pointer and get the reveal strip instead.
 */
export function usePointerReveal(active: boolean): boolean {
  const [near, setNear] = useState(false);

  // Subscribed whether or not full screen is on, and gated on the way *out* instead. Tearing the
  // listener down would mean `near` describing where the pointer was when full screen ended, so
  // entering it again could reveal the bar over a pointer that is nowhere near the top. The
  // functional update returns the same value inside the dead band, so an idle mouse costs no
  // renders at all.
  useEffect(() => {
    if (!hasDom()) return;

    const onMove = (event: MouseEvent) => {
      setNear((current) => {
        if (event.clientY <= REVEAL_WITHIN_PX) return true;
        if (event.clientY > REVEAL_UNTIL_PX) return false;
        return current;
      });
    };

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return active && near;
}
