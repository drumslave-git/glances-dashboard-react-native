import { useCallback, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { ScrollView, XStack, YStack } from 'tamagui';

import { GEOMETRY } from '@/theme/telemetry';
import type { WidgetInstance } from '@/types/dashboard';
import { reorderForPointer, stepOrder, type CardRect } from '@/utils/dragReorder';
import { columnsForWidth, widthPercentForSpan } from '@/utils/widgetLayout';

import { WidgetFrame } from '@/widgets/widget-frame';

/** Hold this long before a drag takes over from the scroll view. */
const LONG_PRESS_MS = 300;

interface WidgetGridProps {
  widgets: WidgetInstance[];
  editMode: boolean;
  onEdit: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
  /** Commit a new order after a drag. */
  onReorder: (orderedIds: string[]) => void;
}

/**
 * Flow layout: each card takes a percentage of the row based on its size preset,
 * and the column count follows the window width.
 *
 * In edit mode a long press lifts a card and the grid reflows live underneath
 * it; the new order is committed on release. Cards report their measured
 * rectangles so `reorderForPointer` can decide the drop position — a wrap flow
 * of variable-width cards has no row/column arithmetic to rely on instead.
 */
export function WidgetGrid({
  widgets,
  editMode,
  onEdit,
  onRemove,
  onReorder,
}: WidgetGridProps) {
  const { width } = useWindowDimensions();
  const columns = columnsForWidth(width);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Order shown mid-drag. Null means "just use the widgets prop".
  const [previewOrder, setPreviewOrder] = useState<string[] | null>(null);
  // Measured per card; refs because layout changes must not trigger a render.
  const rects = useRef<Map<string, CardRect>>(new Map());
  // Where the dragged card sat when the drag began. The reflow moves its real
  // rectangle out from under the finger, so the pointer is tracked from here.
  const dragOrigin = useRef<CardRect | null>(null);

  const ordered = useMemo(() => {
    if (!previewOrder) return widgets;
    const byId = new Map(widgets.map((widget) => [widget.id, widget]));
    const result: WidgetInstance[] = [];
    for (const id of previewOrder) {
      const widget = byId.get(id);
      if (widget) {
        result.push(widget);
        byId.delete(id);
      }
    }
    // A widget added mid-drag would not be in previewOrder; keep it rather than drop it.
    return [...result, ...byId.values()];
  }, [previewOrder, widgets]);

  const measure = useCallback((widgetId: string, event: LayoutChangeEvent) => {
    const { x, y, width: w, height } = event.nativeEvent.layout;
    rects.current.set(widgetId, { id: widgetId, x, y, width: w, height });
  }, []);

  // No drag is in flight before this runs, so the order on screen is the prop's.
  const beginDrag = useCallback(
    (widgetId: string) => {
      dragOrigin.current = rects.current.get(widgetId) ?? null;
      setDraggingId(widgetId);
      setPreviewOrder(widgets.map((w) => w.id));
    },
    [widgets],
  );

  const dragTo = useCallback(
    (widgetId: string, translationX: number, translationY: number) => {
      const origin = dragOrigin.current;
      if (!origin) return;

      // The finger, in the same coordinate space the cards were measured in.
      const point = {
        x: origin.x + origin.width / 2 + translationX,
        y: origin.y + origin.height / 2 + translationY,
      };

      setPreviewOrder((current) => {
        const ids = current ?? widgets.map((w) => w.id);
        const inOrder = ids
          .map((id) => rects.current.get(id))
          .filter((rect): rect is CardRect => rect !== undefined);
        // Before every card has reported a layout there is nothing to aim at.
        if (inOrder.length !== ids.length) return current;

        const next = reorderForPointer(ids, inOrder, widgetId, point);
        return next === ids ? current : next;
      });
    },
    [widgets],
  );

  const moveOne = useCallback(
    (widgetId: string, offset: number) => {
      const ids = widgets.map((w) => w.id);
      const next = stepOrder(ids, widgetId, offset);
      if (next !== ids) onReorder(next);
    },
    [onReorder, widgets],
  );

  const endDrag = useCallback(() => {
    dragOrigin.current = null;
    setDraggingId(null);
    setPreviewOrder((current) => {
      if (current) onReorder(current);
      return null;
    });
  }, [onReorder]);

  return (
    <ScrollView
      flex={1}
      // A lifted card must not drag the page with it.
      scrollEnabled={draggingId === null}
      showsVerticalScrollIndicator={false}
      testID="widget-grid"
    >
      {/* The design's 11pt gutter and 15pt surround, expressed as a negative
          margin on the flow plus half-gutter padding on each cell. */}
      <XStack flexWrap="wrap" m={-GEOMETRY.gridGap / 2} p={GEOMETRY.gridPadding}>
        {ordered.map((widget, index) => (
          <WidgetGridCell
            key={widget.id}
            widget={widget}
            columns={columns}
            editMode={editMode}
            dragging={draggingId === widget.id}
            onMeasure={measure}
            onDragBegin={beginDrag}
            onDragMove={dragTo}
            onDragEnd={endDrag}
            onEdit={onEdit}
            onRemove={onRemove}
                onMove={moveOne}
            index={index}
            count={ordered.length}
          />
        ))}
      </XStack>
    </ScrollView>
  );
}

interface WidgetGridCellProps {
  widget: WidgetInstance;
  columns: number;
  editMode: boolean;
  dragging: boolean;
  onMeasure: (widgetId: string, event: LayoutChangeEvent) => void;
  onDragBegin: (widgetId: string) => void;
  onDragMove: (widgetId: string, translationX: number, translationY: number) => void;
  onDragEnd: () => void;
  onEdit: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
  onMove: (widgetId: string, offset: number) => void;
  index: number;
  count: number;
}

function WidgetGridCell({
  widget,
  columns,
  editMode,
  dragging,
  onMeasure,
  onDragBegin,
  onDragMove,
  onDragEnd,
  onEdit,
  onRemove,
  onMove,
  index,
  count,
}: WidgetGridCellProps) {
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
          runOnJS(onDragMove)(widget.id, event.translationX, event.translationY);
        })
        // onFinalize rather than onEnd, so a cancelled gesture also releases the card.
        .onFinalize(() => {
          runOnJS(onDragEnd)();
        }),
    [editMode, onDragBegin, onDragEnd, onDragMove, widget.id],
  );

  return (
    <GestureDetector gesture={pan}>
      <YStack
        width={`${widthPercentForSpan(widget.w, columns)}%`}
        p={GEOMETRY.gridGap / 2}
        onLayout={(event) => onMeasure(widget.id, event)}
        // The lifted card reads as picked up without leaving a hole in the flow.
        opacity={dragging ? 0.85 : 1}
        scale={dragging ? 1.04 : 1}
        // The v5 config drops `zIndex` as a prop, so it has to go through `style`.
        style={{ zIndex: dragging ? 1 : 0 }}
        testID={`widget-cell-${widget.id}`}
      >
        <WidgetFrame
          widget={widget}
          editMode={editMode}
          onEdit={onEdit}
          onRemove={onRemove}
          onMove={onMove}
          index={index}
          count={count}
        />
      </YStack>
    </GestureDetector>
  );
}
