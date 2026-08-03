import { memo } from 'react';
import { Button, Card, Paragraph, XStack, YStack } from 'tamagui';

import { useGlancesQuery } from '@/hooks/useGlancesQuery';
import { selectServerById, useServersStore } from '@/state/servers';
import type { WidgetConfig } from '@/types/dashboard';
import { resolveTitleTokens } from '@/utils/widgetData';
import { heightForSize } from '@/utils/widgetLayout';
import { WidgetContent } from '@/components/widgets/widget-content';

interface WidgetCardProps {
  widget: WidgetConfig;
  editMode: boolean;
  onEdit: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
  onResize: (widgetId: string) => void;
  /**
   * Step this card one position along the order. Present only where dragging is
   * not a reasonable interaction (the web build); absent hides the controls.
   */
  onMove?: (widgetId: string, offset: number) => void;
  /** Position in the grid, so the controls can disable themselves at the ends. */
  index: number;
  count: number;
}

function WidgetCardInner({
  widget,
  editMode,
  onEdit,
  onRemove,
  onResize,
  onMove,
  index,
  count,
}: WidgetCardProps) {
  const server = useServersStore((state) => selectServerById(state, widget.serverId));
  const { data, isLoading, error } = useGlancesQuery(server, widget.endpointPath);

  // Titles may embed live values, e.g. "CPU {{total:round(1)}}%".
  const title = resolveTitleTokens(widget.title, data);

  return (
    <Card
      borderWidth={1}
      borderColor="$borderColor"
      p="$3"
      height={heightForSize(widget.size)}
      testID={`widget-${widget.id}`}
    >
      <YStack flex={1} gap="$2">
        <XStack items="center" gap="$2">
          <Paragraph
            size="$2"
            opacity={0.8}
            flex={1}
            numberOfLines={1}
            testID={`widget-title-${widget.id}`}
          >
            {title}
          </Paragraph>
          {editMode && (
            <XStack gap="$1">
              {onMove && (
                <>
                  {/* Arrows, not up/down: the grid is a left-to-right wrap flow,
                      so "earlier" is the position to the left far more often
                      than it is the row above. */}
                  <Button
                    size="$2"
                    disabled={index === 0}
                    opacity={index === 0 ? 0.4 : 1}
                    onPress={() => onMove(widget.id, -1)}
                    aria-label="Move widget earlier"
                    testID={`widget-move-earlier-${widget.id}`}
                  >
                    ←
                  </Button>
                  <Button
                    size="$2"
                    disabled={index >= count - 1}
                    opacity={index >= count - 1 ? 0.4 : 1}
                    onPress={() => onMove(widget.id, 1)}
                    aria-label="Move widget later"
                    testID={`widget-move-later-${widget.id}`}
                  >
                    →
                  </Button>
                </>
              )}
              <Button size="$2" onPress={() => onResize(widget.id)} testID={`widget-resize-${widget.id}`}>
                {widget.size}
              </Button>
              <Button size="$2" onPress={() => onEdit(widget.id)} testID={`widget-edit-${widget.id}`}>
                Edit
              </Button>
              <Button
                size="$2"
                theme="red"
                onPress={() => onRemove(widget.id)}
                testID={`widget-remove-${widget.id}`}
              >
                ✕
              </Button>
            </XStack>
          )}
        </XStack>

        <YStack flex={1}>
          <WidgetContent
            kind={widget.kind}
            data={data ?? null}
            config={{
              metric: widget.metric,
              fields: widget.fields,
              fieldColors: widget.fieldColors,
              fieldFormatters: widget.fieldFormatters,
              donutChartOptions: widget.donutChartOptions,
              chartLabel: widget.chartLabel,
              splitPercentageIntoUsedFree: widget.splitPercentageIntoUsedFree,
            }}
            noServer={!server}
            loading={isLoading}
            error={error ? error.message : null}
            testID={`widget-content-${widget.id}`}
          />
        </YStack>
      </YStack>
    </Card>
  );
}

export const WidgetCard = memo(WidgetCardInner);
