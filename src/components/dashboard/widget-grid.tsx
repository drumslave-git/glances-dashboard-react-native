import { useCallback, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { LinearTransition, runOnJS } from 'react-native-reanimated';
import { ScrollView, YStack } from 'tamagui';

import { GEOMETRY } from '@/theme/telemetry';
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
import { footprintOf, footprintSize, isWidgetType, type Footprint } from '@/widgets/catalog';

import { WidgetFrame } from '@/widgets/widget-frame';

/** Hold this long before a drag takes over from the scroll view. */
const LONG_PRESS_MS = 300;

/** The corner grip's side, in points. Big enough for a mouse; a phone gets the kebab instead. */
const GRIP_SIZE = 22;

/**
 * How long a cell takes to slide to a new slot.
 *
 * The card snaps from cell to cell as the finger crosses a track — its position is grid units, and
 * the grid has no half-columns. What makes that read as dragging rather than teleporting is this:
 * every cell, the dragged one and the ones flowing around it, animates between placements.
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
  const gap = GEOMETRY.gridGap;

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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  // Last snapped target, so a drag that has not crossed a cell boundary does no React work.
  const lastTarget = useRef<{ x: number; y: number } | null>(null);

  const layout = preview ?? base;
  const byId = useMemo(() => new Map(layout.map((item) => [item.id, item])), [layout]);

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
      setPreview(moveItem(base, widgetId, target.x, target.y, columns));
    },
    [base, colWidth, columns, gap, rowHeight],
  );

  const resizeTo = useCallback(
    (widgetId: string, translationX: number, translationY: number) => {
      const origin = base.find((item) => item.id === widgetId);
      if (!origin) return;
      const { dw, dh } = spanDelta(translationX, translationY, colWidth, rowHeight, gap);
      const target = { w: origin.w + dw, h: origin.h + dh };
      if (lastTarget.current && lastTarget.current.x === target.w && lastTarget.current.y === target.h) return;
      lastTarget.current = { x: target.w, y: target.h };
      setPreview(resizeItem(base, widgetId, target.w, target.h, columns));
    },
    [base, colWidth, columns, gap, rowHeight],
  );

  const endGesture = useCallback(() => {
    setDraggingId(null);
    setResizingId(null);
    lastTarget.current = null;
    setPreview((current) => {
      if (current) onLayoutChange(current);
      return null;
    });
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

function GridCell({
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
          // Every frame reaches `onDragMove`, which returns without touching React unless the
          // finger has crossed into another cell.
          runOnJS(onDragMove)(widget.id, event.translationX, event.translationY);
        })
        // onFinalize rather than onEnd, so a cancelled gesture also releases the card.
        .onFinalize(() => {
          runOnJS(onGestureEnd)();
        }),
    [editMode, onDragBegin, onDragMove, onGestureEnd, widget.id],
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

  const footprint = isWidgetType(widget.type)
    ? footprintOf(widget.type, { w: widget.w, h: widget.h })
    : null;

  return (
    <Animated.View
      // The slide between placements is what makes a snapping grid read as a drag — it applies to
      // the neighbours flowing out of the way as much as to the card under the finger.
      layout={LinearTransition.duration(SLIDE_MS)}
      style={{ position: 'absolute', ...rect, zIndex: dragging ? 10 : 1 }}
      testID={`widget-cell-${widget.id}`}
    >
      <GestureDetector gesture={pan}>
        <YStack flex={1} opacity={dragging ? 0.9 : 1}>
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
            role="button"
            aria-label={`Resize ${widget.title ?? widget.type}`}
            testID={`widget-grip-${widget.id}`}
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
