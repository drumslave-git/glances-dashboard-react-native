import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  LinearTransition,
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  // Last snapped target, so a drag that has not crossed a cell boundary does no React work.
  const lastTarget = useRef<{ x: number; y: number } | null>(null);

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
      lastTarget.current = origin ? { x: origin.x, y: origin.y } : null;
      setDraggingId(widgetId);
    },
    [base],
  );

  const dragTo = useCallback(
    (widgetId: string, translationX: number, translationY: number) => {
      const origin = base.find((item) => item.id === widgetId);
      if (!origin) return;
      const { dx, dy } = cellDelta(translationX, translationY, colWidth, rowHeight, gap);
      const target = { x: origin.x + dx, y: Math.max(0, origin.y + dy) };
      if (lastTarget.current && lastTarget.current.x === target.x && lastTarget.current.y === target.y) return;
      lastTarget.current = target;
      showPreview(moveItem(base, widgetId, target.x, target.y, columns));
    },
    [base, colWidth, columns, gap, rowHeight, showPreview],
  );

  const resizeTo = useCallback(
    (widgetId: string, translationX: number, translationY: number) => {
      const origin = base.find((item) => item.id === widgetId);
      if (!origin) return;
      const { dw, dh } = spanDelta(translationX, translationY, colWidth, rowHeight, gap);
      const target = { w: origin.w + dw, h: origin.h + dh };
      if (lastTarget.current && lastTarget.current.x === target.w && lastTarget.current.y === target.h) return;
      lastTarget.current = { x: target.w, y: target.h };
      showPreview(resizeItem(base, widgetId, target.w, target.h, columns));
    },
    [base, colWidth, columns, gap, rowHeight, showPreview],
  );

  const endGesture = useCallback(() => {
    const committed = previewRef.current;
    previewRef.current = null;
    setDraggingId(null);
    setResizingId(null);
    lastTarget.current = null;
    setPreview(null);
    if (committed) onLayoutChange(committed);
  }, [onLayoutChange]);

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

  return (
    <ScrollView
      flex={1}
      // A lifted card must not drag the page with it.
      scrollEnabled={draggingId === null && resizingId === null}
      showsVerticalScrollIndicator={false}
      onLayout={measure}
      testID="widget-grid"
    >
      {/* Tamagui emits no `position` on web, so an absolutely-placed child would escape to some
          ancestor. The explicit stacking context keeps the dragged card above its neighbours. */}
      <YStack position="relative" style={{ zIndex: 0 }} height={contentHeight(layout, rowHeight, gap)}>
        {measured &&
          widgets.map((widget) => {
            const item = byId.get(widget.id);
            if (!item) return null;
            return (
              <GridCell
                key={widget.id}
                widget={widget}
                rect={cellRect(item, colWidth, rowHeight, gap)}
                dragging={draggingId === widget.id}
                editMode={editMode}
                resizable={columns > 1}
                onDragBegin={beginDrag}
                onDragMove={dragTo}
                onResizeMove={resizeTo}
                onResizeBegin={setResizingId}
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

  /**
   * The cell's rect, frozen at drag start. While a drag is live the preview keeps moving this
   * cell's *slot*, but the card on screen must stay `origin + translation` — tracking the live
   * slot is what made the old drag oscillate. Captured by render-phase reconciliation (the
   * sanctioned adjust-state-on-prop-change shape) because the gesture callbacks are memoized
   * without `rect` and would close over a stale one.
   */
  const [origin, setOrigin] = useState<typeof rect | null>(null);
  // Keeps the layout transition off while the card animates its release remainder to zero, so
  // the slide is the transform's and not fought over by two animators.
  const [settling, setSettling] = useState(false);
  if (dragging && origin === null) {
    setOrigin(rect);
    if (settling) setSettling(false);
  }

  // Drag just ended: the card sits at `origin + translation`; its slot is `rect`. Carry the
  // difference into the transform and time it out, so the card glides the last stretch into its
  // cell instead of teleporting. This must react to the `dragging` prop flipping and it must
  // write shared values, which only an effect may do — the state writes alongside are what hand
  // the card from "frozen at origin" to "settling at its slot", so they belong to the same step.
  useEffect(() => {
    if (dragging || origin === null) return;
    dragX.value = origin.left + dragX.value - rect.left;
    dragY.value = origin.top + dragY.value - rect.top;
    dragX.value = withTiming(0, { duration: SLIDE_MS });
    dragY.value = withTiming(0, { duration: SLIDE_MS });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(null);
    setSettling(true);
    const timer = setTimeout(() => setSettling(false), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [dragging, origin, rect.left, rect.top, dragX, dragY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }, { translateY: dragY.value }],
  }));

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(editMode)
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
    [dragX, dragY, editMode, onDragBegin, onDragMove, onGestureEnd, widget.id],
  );

  const resize = useMemo(
    () =>
      Gesture.Pan()
        .enabled(editMode && resizable)
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
    [editMode, onGestureEnd, onResizeBegin, onResizeMove, resizable, widget.id],
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

  // While dragged (or settling) the card is positioned at its frozen origin and moved by the
  // transform alone; the layout transition is handed back only once both are over, so the two
  // animators never fight over one card. Neighbours keep the transition throughout — the flow
  // around the finger is theirs.
  const lifted = origin !== null || settling;
  const position = origin ?? rect;

  return (
    <Animated.View
      layout={lifted ? undefined : LinearTransition.duration(SLIDE_MS)}
      style={[{ position: 'absolute', ...position, zIndex: lifted ? 10 : 1 }, animatedStyle]}
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
