import { useWindowDimensions } from 'react-native';
import { ScrollView, XStack, YStack } from 'tamagui';

import type { WidgetConfig } from '@/types/dashboard';
import { columnsForWidth, widthPercentForSize } from '@/utils/widgetLayout';

import { WidgetCard } from './widget-card';

interface WidgetGridProps {
  widgets: WidgetConfig[];
  editMode: boolean;
  onEdit: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
  onResize: (widgetId: string) => void;
}

/**
 * Flow layout: each card takes a percentage of the row based on its size preset,
 * and the column count follows the window width. Drag-reordering lands in M5.
 */
export function WidgetGrid({ widgets, editMode, onEdit, onRemove, onResize }: WidgetGridProps) {
  const { width } = useWindowDimensions();
  const columns = columnsForWidth(width);

  return (
    <ScrollView flex={1} showsVerticalScrollIndicator={false} testID="widget-grid">
      <XStack flexWrap="wrap" m="$-1">
        {widgets.map((widget) => (
          <YStack
            key={widget.id}
            width={`${widthPercentForSize(widget.size, columns)}%`}
            p="$1"
          >
            <WidgetCard
              widget={widget}
              editMode={editMode}
              onEdit={onEdit}
              onRemove={onRemove}
              onResize={onResize}
            />
          </YStack>
        ))}
      </XStack>
    </ScrollView>
  );
}
