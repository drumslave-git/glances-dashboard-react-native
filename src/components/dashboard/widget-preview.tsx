import { useEndpointStatus } from '@/data/feed-store';
import { selectEndpointById, useEndpointsStore } from '@/state/endpoints';
import { widgetSurface } from '@/theme/appearance';
import { useAppearance, useTelemetry } from '@/theme/use-telemetry';
import { sizeModeFor } from '@/utils/typeScale';
import { parseWidgetConfig, type WidgetType } from '@/widgets/catalog';
import { widgetRenderer } from '@/widgets/registry';
import { WidgetErrorBoundary } from '@/widgets/widget-error-boundary';
import { YStack } from 'tamagui';

/**
 * A widget's body, drawn from the live feed, at a stated size (ref §7.1).
 *
 * This is the picker's whole argument for existing: "which of these do I want on my board" is not a
 * question a sentence can answer, and it is not a question a static thumbnail can answer either —
 * two renderings of the same metric differ in what they do with *this host's* numbers. So the card
 * mounts the real body against the real endpoint and lets it draw.
 *
 * **The body only.** The frame's header is not part of the choice — every widget has one, and it
 * would take a third of a size card's height to say so.
 *
 * Nothing here asks the poller for data: one screen owns the transient preview request (the poller
 * has a single slot for it), and a card that made its own would evict its neighbour's.
 */
export function WidgetPreview({
  type,
  endpointId,
  width,
  height,
  testID,
}: {
  type: WidgetType;
  endpointId: string | null;
  width: number;
  height: number;
  testID?: string;
}) {
  const { accentFor, mode: themeMode } = useTelemetry();
  const appearance = useAppearance();
  const endpoint = useEndpointsStore((state) => selectEndpointById(state, endpointId));
  const status = useEndpointStatus(endpointId);

  const { component: Body } = widgetRenderer(type);
  const mode = sizeModeFor(width, height);
  const accent = accentFor(endpoint?.color ?? 'lime');

  return (
    <YStack
      width={width}
      height={height}
      overflow="hidden"
      // Painted by the board's own appearance: a preview of a widget that does not look like the
      // widgets already placed is not a preview.
      rounded={appearance.widgetRadius}
      px={appearance.widgetPadding}
      py={Math.round(appearance.widgetPadding * 0.65)}
      style={{ backgroundColor: widgetSurface(appearance, themeMode)[1] }}
      testID={testID}
    >
      {/* A rendering that throws on this host's payload must cost the picker one card, not the
          screen — which is exactly the case someone is here to discover. */}
      <WidgetErrorBoundary widgetId={`preview-${type}`}>
        <Body
          endpointId={endpointId}
          // The defaults, because there is nothing configured yet: the preview shows what pressing
          // Add would place, not what it could be configured into afterwards.
          config={parseWidgetConfig(type, {})}
          mode={mode}
          width={width}
          height={height}
          accentColor={accent.stroke}
          {...(status ? { status } : {})}
        />
      </WidgetErrorBoundary>
    </YStack>
  );
}
