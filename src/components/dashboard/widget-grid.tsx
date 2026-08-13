import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Platform, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ScrollView, YStack } from 'tamagui';

import type { WidgetInstance } from '@/types/dashboard';
import {
  cellDelta,
  cellRect,
  columnWidth,
  columnsForWidth,
  contentHeight,
  moveItem,
  normalizeLayout,
  resizeItem,
  rowHeightForViewport,
  spanDelta,
  type GridItem,
} from '@/utils/gridLayout';
import { useAppearance } from '@/theme/use-telemetry';
import { footprintOf, footprintSize, isWidgetType, type Footprint } from '@/widgets/catalog';

import { WidgetFrame } from '@/widgets/widget-frame';

import { usePointerDrag } from './use-pointer-drag';

/**
 * Hold this long before a drag takes over from the scroll view — on **touch**.
 *
 * A finger has to say which it meant, because the same downward stroke scrolls the board. A mouse
 * has already said it by entering edit mode, and a long press it cannot discover is a card that
 * simply does not move: the pointer platforms take a small distance threshold instead, which is
 * what the reference passes to its grid.
 */
const LONG_PRESS_MS = 300;
const DRAG_THRESHOLD_PX = 3;

/** The corner grip's side, in points. Big enough for a mouse; a phone gets the kebab instead. */
const GRIP_SIZE = 22;

/**
 * How long a *neighbour* takes to slide out of the dragged card's way, and how long the dragged
 * card takes to settle into its slot on release.
 *
 * The dragged card itself does not snap any more — it rides the pointer through a transform on
 * shared values, which never touches React (the owner's review called the snapping "choppy, zero
 * smoothness", and it was: the card teleported a whole column at a time and this transition was
 * the only motion). Only the cells flowing around it animate between placements.
 *
 * Reanimated's `LinearTransition` used to do the sliding and **did nothing on web** — every
 * neighbour teleported between arrangements, which is most of why the drag read as chaos there.
 * Each cell now animates its own offset (see `GridCellInner`), which is one animator on every
 * platform rather than a layout animator fighting a transform.
 */
const SLIDE_MS = 130;

interface WidgetGridProps {
  widgets: WidgetInstance[];
  editMode: boolean;
  onEdit: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
  /** Commit a layout — every drag, resize and footprint change goes through here. */
  onLayoutChange: (items: GridItem[]) => void;
}

/**
 * The dashboard grid: free placement over `{x, y, w, h}` with vertical gravity (ref §7.4).
 *
 * The column count follows the **measured** width and the row height follows the **viewport**, so a
 * windowful of rows fills the window exactly and entering full screen hands the toolbar's height
 * back to the rows. Neither is stored: a layout is in grid units, and the same board is legal on a
 * phone and on a desktop window.
 *
 * The stored layout is *normalized for rendering* — clamped to the columns this window has, then
 * compacted — but that normalization is **not** written back. Otherwise opening the board in a
 * narrow window would silently flatten a four-column arrangement into one, and rotating back would
 * find it gone. Only a deliberate edit persists, which is also when the reference saves.
 */
export function WidgetGrid({ widgets, editMode, onEdit, onRemove, onLayoutChange }: WidgetGridProps) {
  // One value for the gap between cells *and* the surround, so the two cannot drift apart — which
  // is the whole reason the appearance model offers one number rather than two (ref §7.6).
  const gap = useAppearance().gridGap;

  // The scroll viewport, not the content: the row height divides the height a windowful has.
  const [box, setBox] = useState({ width: 0, height: 0 });
  const measure = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((current) => (current.width === width && current.height === height ? current : { width, height }));
  }, []);

  const columns = columnsForWidth(box.width, gap);
  const colWidth = columnWidth(box.width, columns, gap);
  const rowHeight = rowHeightForViewport(box.height, gap);

  const stored = useMemo<GridItem[]>(
    () => widgets.map(({ id, x, y, w, h }) => ({ id, x, y, w, h })),
    [widgets],
  );
  const base = useMemo(() => normalizeLayout(stored, columns), [stored, columns]);

  // The layout shown mid-gesture. Null means "just use the normalized one".
  const [preview, setPreview] = useState<GridItem[] | null>(null);
  // Mirrored in a ref so the gesture's end can read the last preview without going through a
  // `setState` updater — those run during the *render* phase, and committing the layout from one
  // means writing to the widgets store while React is rendering this component.
  const previewRef = useRef<GridItem[] | null>(null);
  /**
   * The live drag, with the dragged widget's placement **as it was when the press landed**.
   *
   * Frozen here rather than worked out by the cell from its own rect, because that rect is the
   * *previewed* one and moves under the card mid-drag: a cell that captured it a frame late
   * anchored itself to a slot the drag had already left, and then rode the pointer from there —
   * the card running at twice the speed of the mouse.
   */
  const [drag, setDrag] = useState<{ id: string; origin: GridItem } | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  // The snapped delta this gesture last acted on: the dead band in `cellDelta` measures from it,
  // and an unchanged delta does no React work at all.
  const lastDelta = useRef<{ dx: number; dy: number } | null>(null);
  // The `base` a commit was made against, so the preview can be held until the store's answer
  // comes back through props. See `endGesture`.
  const heldBase = useRef<GridItem[] | null>(null);

  const layout = preview ?? base;
  const byId = useMemo(() => new Map(layout.map((item) => [item.id, item])), [layout]);

  /** The one writer of the mid-gesture layout, so the state and its mirror cannot disagree. */
  const showPreview = useCallback((next: GridItem[]) => {
    previewRef.current = next;
    setPreview(next);
  }, []);

  const beginDrag = useCallback(
    (widgetId: string) => {
      const origin = base.find((item) => item.id === widgetId);
      if (!origin) return;
      lastDelta.current = { dx: 0, dy: 0 };
      setDrag({ id: widgetId, origin });
    },
    [base],
  );

  const dragTo = useCallback(
    (widgetId: string, translationX: number, translationY: number) => {
      const origin = base.find((item) => item.id === widgetId);
      if (!origin) return;
      const previous = lastDelta.current ?? undefined;
      const delta = cellDelta(translationX, translationY, colWidth, rowHeight, gap, previous);
      if (previous && previous.dx === delta.dx && previous.dy === delta.dy) return;
      lastDelta.current = delta;
      showPreview(
        moveItem(base, widgetId, origin.x + delta.dx, Math.max(0, origin.y + delta.dy), columns),
      );
    },
    [base, colWidth, columns, gap, rowHeight, showPreview],
  );

  const beginResize = useCallback((widgetId: string) => {
    lastDelta.current = { dx: 0, dy: 0 };
    setResizingId(widgetId);
  }, []);

  const resizeTo = useCallback(
    (widgetId: string, translationX: number, translationY: number) => {
      const origin = base.find((item) => item.id === widgetId);
      if (!origin) return;
      const previous = lastDelta.current ?? undefined;
      const { dw, dh } = spanDelta(translationX, translationY, colWidth, rowHeight, gap, previous);
      if (previous && previous.dx === dw && previous.dy === dh) return;
      lastDelta.current = { dx: dw, dy: dh };
      showPreview(resizeItem(base, widgetId, origin.w + dw, origin.h + dh, columns));
    },
    [base, colWidth, columns, gap, rowHeight, showPreview],
  );

  const endGesture = useCallback(() => {
    const committed = previewRef.current;
    previewRef.current = null;
    setDrag(null);
    setResizingId(null);
    lastDelta.current = null;
    if (!committed) {
      // A second, redundant end — a pointer release the native gesture also finalizes — must not
      // drop a preview that is still standing in for a commit the store has yet to answer.
      if (heldBase.current === null) setPreview(null);
      return;
    }
    // **Hold** the committed arrangement rather than dropping back to `base`. The store's answer
    // arrives through props a render later, so clearing here paints the *pre-drag* board for a
    // frame: the card snaps home, then jumps to where it was dropped. That flash is what the owner
    // reported (review, 2026-08-13), and it is visible at 60 Hz.
    heldBase.current = base;
    setPreview(committed);
    onLayoutChange(committed);
  }, [base, onLayoutChange]);

  // The store has answered — `base` is a new array whatever it decided — so the held preview has
  // done its job and the board goes back to rendering what is actually stored.
  useEffect(() => {
    if (heldBase.current === null || heldBase.current === base) return;
    heldBase.current = null;
    setPreview(null);
  }, [base]);

  // The kebab's footprints are the same edit as the corner grip, which is why they commit the
  // same way: a phone has no grip, but it must not have a lesser layout model.
  const setFootprint = useCallback(
    (widgetId: string, footprint: Footprint) => {
      const widget = widgets.find((entry) => entry.id === widgetId);
      if (!widget || !isWidgetType(widget.type)) return;
      const size = footprintSize(widget.type, footprint);
      onLayoutChange(resizeItem(base, widgetId, size.w, size.h, columns));
    },
    [base, columns, onLayoutChange, widgets],
  );

  const measured = box.width > 0;

  // Where the card would land if it were dropped now. Without it the only feedback a drag gives is
  // the neighbours reflowing around a hole you cannot see — the board looks like it is rearranging
  // itself at random, which is precisely how the drag read.
  const dropTarget = useMemo(() => {
    if (!drag) return null;
    const item = byId.get(drag.id);
    return item ? cellRect(item, colWidth, rowHeight, gap) : null;
  }, [byId, colWidth, drag, gap, rowHeight]);

  return (
    <ScrollView
      flex={1}
      // A lifted card must not drag the page with it.
      scrollEnabled={drag === null && resizingId === null}
      showsVerticalScrollIndicator={false}
      onLayout={measure}
      testID="widget-grid"
    >
      {/* Tamagui emits no `position` on web, so an absolutely-placed child would escape to some
          ancestor. The explicit stacking context keeps the dragged card above its neighbours. */}
      <YStack position="relative" style={{ zIndex: 0 }} height={contentHeight(layout, rowHeight, gap)}>
        {dropTarget && (
          <YStack
            position="absolute"
            rounded="$4"
            borderWidth={2}
            borderColor="$accent"
            opacity={0.45}
            pointerEvents="none"
            style={{ ...dropTarget, zIndex: 0 }}
            testID="widget-drop-target"
          />
        )}
        {measured &&
          widgets.map((widget) => {
            const item = byId.get(widget.id);
            if (!item) return null;
            // The dragged card is anchored where the press found it and moves by transform alone;
            // its previewed slot belongs to the placeholder above, not to the card.
            const placement = drag?.id === widget.id ? drag.origin : item;
            return (
              <GridCell
                key={widget.id}
                widget={widget}
                rect={cellRect(placement, colWidth, rowHeight, gap)}
                dragging={drag?.id === widget.id}
                editMode={editMode}
                resizable={columns > 1}
                onDragBegin={beginDrag}
                onDragMove={dragTo}
                onResizeMove={resizeTo}
                onResizeBegin={beginResize}
                onGestureEnd={endGesture}
                onEdit={onEdit}
                onRemove={onRemove}
                onFootprint={setFootprint}
              />
            );
          })}
      </YStack>
    </ScrollView>
  );
}

interface GridCellProps {
  widget: WidgetInstance;
  rect: { left: number; top: number; width: number; height: number };
  dragging: boolean;
  editMode: boolean;
  resizable: boolean;
  onDragBegin: (widgetId: string) => void;
  onDragMove: (widgetId: string, translationX: number, translationY: number) => void;
  onResizeBegin: (widgetId: string) => void;
  onResizeMove: (widgetId: string, translationX: number, translationY: number) => void;
  onGestureEnd: () => void;
  onEdit: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
  onFootprint: (widgetId: string, footprint: Footprint) => void;
}

function GridCellInner({
  widget,
  rect,
  dragging,
  editMode,
  resizable,
  onDragBegin,
  onDragMove,
  onResizeBegin,
  onResizeMove,
  onGestureEnd,
  onEdit,
  onRemove,
  onFootprint,
}: GridCellProps) {
  // The pointer's raw translation, applied as a transform so the card rides the finger at frame
  // rate without a single React render. Written from the gesture worklet on native and from the
  // DOM pointermove handler on web.
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  // How far the card is drawn from the slot `rect` puts it in. Every discrete jump the layout
  // makes is absorbed here and then animated away, so the card's *visual* position is continuous
  // no matter how many renders the layout takes to settle.
  const offX = useSharedValue(0);
  const offY = useSharedValue(0);
  // The slot last reconciled against, so the effect below can tell how far the layout moved.
  const slot = useRef({ left: rect.left, top: rect.top });
  // Whether the glide this cell is about to start is a *release* rather than a neighbour getting
  // out of the way — only a released card keeps the lifted z-index while it travels.
  const held = useRef(false);
  // Holds the lifted z-index for as long as the settle glide, so the card is not overlapped by the
  // neighbours it is still travelling across.
  const [settling, setSettling] = useState(false);

  /**
   * Keep the card where it is drawn, whatever the layout just did to its slot.
   *
   * One rule covers every case: measure how far the slot moved, add that to the offset — which
   * leaves the card exactly where it was on screen — and then animate the offset to zero unless
   * the pointer is driving. A neighbour slides out of the way; a released card glides from under
   * the hand into its cell; a card whose slot is corrected a second time re-aims mid-glide instead
   * of jumping. Nothing can teleport, because no frame ever renders without the compensation.
   *
   * A **layout** effect: `useEffect` runs after the browser has painted, so the one frame between
   * the new slot and its compensation is a visible flash of the card at the wrong place.
   */
  useLayoutEffect(() => {
    const from = slot.current;
    const shiftX = from.left - rect.left;
    const shiftY = from.top - rect.top;
    slot.current = { left: rect.left, top: rect.top };

    if (dragging) {
      // The pointer owns the card: absorb the slot's movement and animate nothing.
      if (shiftX !== 0) offX.value += shiftX;
      if (shiftY !== 0) offY.value += shiftY;
      held.current = true;
      return;
    }

    const released = held.current;
    held.current = false;
    // Whatever the drag had accumulated becomes part of the distance still to travel.
    const restX = shiftX + dragX.value;
    const restY = shiftY + dragY.value;
    if (restX === 0 && restY === 0 && offX.value === 0 && offY.value === 0) return;
    dragX.value = 0;
    dragY.value = 0;
    offX.value = offX.value + restX;
    offY.value = offY.value + restY;
    offX.value = withTiming(0, { duration: SLIDE_MS });
    offY.value = withTiming(0, { duration: SLIDE_MS });
    // A neighbour flowing around the drag glides too, but it must not be lifted while it does —
    // it would be drawn over the card the user is holding.
    if (released) setSettling(true);
  }, [dragging, rect.left, rect.top, dragX, dragY, offX, offY]);

  // Its own effect, deliberately: this timer used to live in the reconcile effect above, whose own
  // re-run cleared it before it fired — `settling` stuck true and the card kept its lifted
  // z-index forever.
  useEffect(() => {
    if (!settling) return;
    const timer = setTimeout(() => setSettling(false), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [settling]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offX.value + dragX.value },
      { translateY: offY.value + dragY.value },
    ],
  }));

  // The native gestures are **off on web**, not merely inert. A web `Pan` can never activate
  // (see `usePointerDrag`), but an *enabled* one still runs its state machine: move >10px inside
  // the long-press window and it FAILS, and `onFinalize` fires `endGesture` into the middle of
  // the pointer drag — unfreezing the origin, killing the settle, and leaving the card offset by
  // its last translation. That mid-drag finalize was the whole "random jumps" drag of 0.2.3.
  const nativeGestures = Platform.OS !== 'web';

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(editMode && nativeGestures)
        .activateAfterLongPress(LONG_PRESS_MS)
        // Lets tests drive the drag through gesture-handler's jest utils.
        .withTestId(`widget-drag-${widget.id}`)
        .onStart(() => {
          runOnJS(onDragBegin)(widget.id);
        })
        .onUpdate((event) => {
          // The transform follows every frame on the UI thread; `onDragMove` returns without
          // touching React unless the finger has crossed into another cell. The immutability rule
          // refuses shared-value writes from gesture callbacks, but that is the one place a drag
          // transform can be written from — reinstated deliberately (owner's review, 2026-08-12).
          // eslint-disable-next-line react-hooks/immutability
          dragX.value = event.translationX;
          // eslint-disable-next-line react-hooks/immutability
          dragY.value = event.translationY;
          runOnJS(onDragMove)(widget.id, event.translationX, event.translationY);
        })
        // onFinalize rather than onEnd, so a cancelled gesture also releases the card.
        .onFinalize(() => {
          runOnJS(onGestureEnd)();
        }),
    [dragX, dragY, editMode, nativeGestures, onDragBegin, onDragMove, onGestureEnd, widget.id],
  );

  const resize = useMemo(
    () =>
      Gesture.Pan()
        .enabled(editMode && resizable && nativeGestures)
        .withTestId(`widget-resize-${widget.id}`)
        .onStart(() => {
          runOnJS(onResizeBegin)(widget.id);
        })
        .onUpdate((event) => {
          runOnJS(onResizeMove)(widget.id, event.translationX, event.translationY);
        })
        .onFinalize(() => {
          runOnJS(onGestureEnd)();
        }),
    [editMode, nativeGestures, onGestureEnd, onResizeBegin, onResizeMove, resizable, widget.id],
  );

  // The same two drags, for the platforms where a gesture-handler `Pan` cannot start (see
  // `usePointerDrag`). Empty objects off web, so there is one tree rather than two.
  const panPointer = usePointerDrag({
    enabled: editMode,
    threshold: DRAG_THRESHOLD_PX,
    onBegin: useCallback(() => onDragBegin(widget.id), [onDragBegin, widget.id]),
    onMove: useCallback(
      (dx: number, dy: number) => {
        // Same order as the native worklet: transform first, snapping second. The immutability
        // rule refuses shared-value writes from a callback, but a pointer-move handler is exactly
        // where a drag transform is written from — this is the smooth path the old snapping drag
        // existed to avoid needing, reinstated deliberately (owner's review, 2026-08-12).
        // eslint-disable-next-line react-hooks/immutability
        dragX.value = dx;
        // eslint-disable-next-line react-hooks/immutability
        dragY.value = dy;
        onDragMove(widget.id, dx, dy);
      },
      [dragX, dragY, onDragMove, widget.id],
    ),
    onEnd: onGestureEnd,
  });

  const resizePointer = usePointerDrag({
    enabled: editMode && resizable,
    // The grip is a deliberate target, so it drags from the first pixel.
    threshold: 0,
    onBegin: useCallback(() => onResizeBegin(widget.id), [onResizeBegin, widget.id]),
    onMove: useCallback(
      (dx: number, dy: number) => onResizeMove(widget.id, dx, dy),
      [onResizeMove, widget.id],
    ),
    onEnd: onGestureEnd,
  });

  const footprint = isWidgetType(widget.type)
    ? footprintOf(widget.type, { w: widget.w, h: widget.h })
    : null;

  // Lifted while the pointer has it and for as long as the settle glide, so it travels over the
  // neighbours rather than through them.
  const lifted = dragging || settling;

  return (
    <Animated.View
      style={[{ position: 'absolute', ...rect, zIndex: lifted ? 10 : 1 }, animatedStyle]}
      testID={`widget-cell-${widget.id}`}
    >
      <GestureDetector gesture={pan}>
        <YStack
          flex={1}
          opacity={dragging ? 0.9 : 1}
          // The whole card is the drag surface in edit mode, and a pointer should say so.
          // Buttons inside still win with their own `pointer`.
          cursor={editMode ? (dragging ? 'grabbing' : 'grab') : undefined}
          {...panPointer}
        >
          <WidgetFrame
            widget={widget}
            editMode={editMode}
            footprint={footprint}
            onEdit={onEdit}
            onRemove={onRemove}
            onFootprint={onFootprint}
          />
        </YStack>
      </GestureDetector>

      {editMode && resizable && (
        <GestureDetector gesture={resize}>
          <YStack
            position="absolute"
            r={0}
            b={0}
            width={GRIP_SIZE}
            height={GRIP_SIZE}
            items="flex-end"
            justify="flex-end"
            pr={4}
            pb={4}
            cursor="nwse-resize"
            role="button"
            aria-label={`Resize ${widget.title ?? widget.type}`}
            testID={`widget-grip-${widget.id}`}
            {...resizePointer}
          >
            {/* Two hairlines meeting at the corner — the design's language for a grip, and the
                only thing on a widget that is chrome for editing rather than a readout. */}
            <YStack width={10} height={10} borderRightWidth={2} borderBottomWidth={2} borderColor="$accent" />
          </YStack>
        </GestureDetector>
      )}
    </Animated.View>
  );
}

/**
 * Memoized on the rect's *values*: `cellRect` mints a fresh object every grid render, so the
 * default shallow compare would re-render every card on every preview crossing — most of the
 * per-crossing cost the old drag paid. Everything else is compared by identity, which holds
 * because the grid's callbacks are `useCallback`-stable.
 */
const GridCell = memo(GridCellInner, (prev, next) => {
  return (
    prev.widget === next.widget &&
    prev.dragging === next.dragging &&
    prev.editMode === next.editMode &&
    prev.resizable === next.resizable &&
    prev.rect.left === next.rect.left &&
    prev.rect.top === next.rect.top &&
    prev.rect.width === next.rect.width &&
    prev.rect.height === next.rect.height &&
    prev.onDragBegin === next.onDragBegin &&
    prev.onDragMove === next.onDragMove &&
    prev.onResizeBegin === next.onResizeBegin &&
    prev.onResizeMove === next.onResizeMove &&
    prev.onGestureEnd === next.onGestureEnd &&
    prev.onEdit === next.onEdit &&
    prev.onRemove === next.onRemove &&
    prev.onFootprint === next.onFootprint
  );
});
