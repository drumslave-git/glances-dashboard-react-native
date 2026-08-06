import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import type { TamaguiElement } from 'tamagui';

/**
 * A drag driven by DOM pointer events, for web and the desktop window.
 *
 * **Why this exists rather than one gesture for every platform.** The grid's drag and resize are
 * gesture-handler `Pan`s, which is what M5 established and what Android runs. On web those gestures
 * never activate: `GestureDetector` wraps its child in a `display: contents` div and hands *that*
 * element to the web delegate, so `isPointerInBounds` measures a box of zero width and height and
 * every `pointerdown` is discarded before a handler sees it. Nothing in the app can change which
 * element the library measures.
 *
 * It is also the better interaction there: a mouse has already declared intent by entering edit
 * mode, so a drag begins after a few pixels of movement — the same threshold the reference passes
 * to its grid — where a finger still has to distinguish dragging a card from scrolling the board.
 *
 * **Listeners, not props, and the window for the move.** React's synthetic handlers go through
 * Tamagui's own press machinery on web, and the moves stop arriving the moment the pointer crosses
 * out of the card — which is most of a drag. Listening on the element for the press and on the
 * window for everything after it is what makes a drag survive leaving its own card.
 *
 * Returns a `ref` to put on the draggable element. Inert off web and while disabled.
 */
export interface PointerDragHandlers {
  enabled: boolean;
  /** Pixels of movement before the drag starts, so a click stays a click. */
  threshold?: number;
  onBegin: () => void;
  onMove: (translationX: number, translationY: number) => void;
  onEnd: () => void;
}

interface DragState {
  startX: number;
  startY: number;
  active: boolean;
}

/** Tamagui hands back the DOM node on web; anything else is not something to listen on. */
function asElement(node: unknown): HTMLElement | null {
  const candidate = node as HTMLElement | null;
  return candidate && typeof candidate.addEventListener === 'function' ? candidate : null;
}

export function usePointerDrag({
  enabled,
  threshold = 3,
  onBegin,
  onMove,
  onEnd,
}: PointerDragHandlers): { ref: React.RefObject<TamaguiElement | null> } {
  // Typed as Tamagui's element because that is what it is spread onto; on web it *is* the DOM node,
  // which is the only platform that reads it.
  const ref = useRef<TamaguiElement | null>(null);
  const drag = useRef<DragState | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const element = asElement(ref.current);
    if (!element) return;

    const finish = () => {
      const state = drag.current;
      drag.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      if (state?.active) onEnd();
    };

    const move = (event: PointerEvent) => {
      const state = drag.current;
      if (!state) return;
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      if (!state.active) {
        if (Math.hypot(dx, dy) < threshold) return;
        state.active = true;
        onBegin();
      }
      onMove(dx, dy);
    };

    const down = (event: PointerEvent) => {
      // Left button only: a right-click belongs to the context menu, a middle-click to scrolling.
      if (event.button !== 0) return;
      drag.current = { startX: event.clientX, startY: event.clientY, active: false };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    };

    element.addEventListener('pointerdown', down);
    return () => {
      element.removeEventListener('pointerdown', down);
      finish();
    };
  }, [enabled, onBegin, onEnd, onMove, threshold]);

  return { ref };
}
