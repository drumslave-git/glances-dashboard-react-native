import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, XStack, YStack } from 'tamagui';

import { EndpointChip } from '@/components/telemetry/chips';
import { ToolbarButton } from '@/components/telemetry/surfaces';
import { Label, MicroLabel, UiText } from '@/components/telemetry/text';
import { useEndpointStatus } from '@/data/feed-store';
import { useEndpointState } from '@/hooks/useEndpointState';
import { sortedEndpoints, useEndpointsStore } from '@/state/endpoints';
import { GEOMETRY } from '@/theme/telemetry';
import {
  GROUP_LABELS,
  VARIANT_LABELS,
  isWidgetAvailable,
  metricsByGroup,
  widgetsForMetric,
  type MetricId,
} from '@/widgets/catalog';

/**
 * Add-widget, step one and two: **pick a metric, then pick how it is drawn** (ref §8).
 *
 * The flat list this replaced asked one question that was really two, and answered the second —
 * which of these do I want on my grid — with a sentence, which is the one thing a dashboard widget
 * cannot be described in.
 *
 * The reference's variant cards each mount the real widget against the real endpoint and show it
 * drawing live data. That needs the transient preview plugin set the poller already supports, and
 * lands with the rest of the picker in M15; for now each rendering is named and described, and the
 * widget appears on the board where it can be judged for real.
 */
export function WidgetTypeScreen() {
  const router = useRouter();
  const endpoints = useEndpointsStore((state) => state.endpoints);
  const defaultEndpointId = useEndpointsStore((state) => state.defaultEndpointId);

  const ordered = sortedEndpoints(endpoints);
  const [endpointId, setEndpointId] = useState(defaultEndpointId ?? ordered[0]?.id ?? null);
  const [metric, setMetric] = useState<MetricId | null>(null);

  const endpoint = ordered.find((entry) => entry.id === endpointId);
  const status = useEndpointStatus(endpointId);
  const state = useEndpointState(endpoint);

  const choose = (type: string) => {
    if (!endpointId) return;
    // The config screen creates the widget; "new" tells it there is nothing to load.
    router.replace({ pathname: '/widget/[id]', params: { id: 'new', type, endpointId } });
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <YStack flex={1} bg="$appBg" p={GEOMETRY.gridPadding} gap="$3">
        <XStack items="center" gap="$3">
          {metric && (
            <ToolbarButton label="Back" onPress={() => setMetric(null)} testID="widget-type-back" />
          )}
          <Label flex={1} variant="readout">
            {metric ? 'How to draw it' : 'Add widget'}
          </Label>
          <ToolbarButton label="Cancel" onPress={() => router.back()} testID="widget-type-cancel" />
        </XStack>

        {ordered.length === 0 ? (
          <UiText variant="metric" color="$textDim" testID="widget-type-no-endpoints">
            Add an endpoint before adding a widget.
          </UiText>
        ) : (
          <ScrollView flex={1} showsVerticalScrollIndicator={false}>
            <YStack gap="$3">
              {/* Which host, first — it decides which widgets are even on offer. */}
              {!metric && ordered.length > 1 && (
                <YStack gap={7}>
                  <MicroLabel>Endpoint</MicroLabel>
                  <XStack gap={8} flexWrap="wrap">
                    {ordered.map((entry) => (
                      <YStack
                        key={entry.id}
                        onPress={() => setEndpointId(entry.id)}
                        opacity={entry.id === endpointId ? 1 : 0.5}
                        role="button"
                        aria-label={`Endpoint ${entry.name}`}
                        testID={`widget-type-endpoint-${entry.id}`}
                      >
                        <EndpointChip name={entry.name} color={entry.color} state={state} />
                      </YStack>
                    ))}
                  </XStack>
                </YStack>
              )}

              {metric
                ? widgetsForMetric(metric).map((definition) => {
                    const available = isWidgetAvailable(definition.type, status?.capabilities);
                    return (
                      <YStack
                        key={definition.type}
                        gap={5}
                        p={14}
                        rounded={GEOMETRY.radius.widget}
                        borderWidth={1}
                        borderColor="$borderColor"
                        bg="$widgetBg"
                        opacity={available ? 1 : 0.45}
                        pressStyle={available ? { borderColor: '$borderRaised' } : undefined}
                        onPress={available ? () => choose(definition.type) : undefined}
                        role="button"
                        aria-label={definition.label}
                        testID={`widget-variant-${definition.type}`}
                      >
                        <XStack items="center" gap={8}>
                          <Label variant="metric" flex={1}>
                            {definition.label}
                          </Label>
                          <MicroLabel>{VARIANT_LABELS[definition.variant]}</MicroLabel>
                        </XStack>
                        <UiText variant="footer" color="$textDim">
                          {available
                            ? definition.description
                            : // Named rather than merely greyed: "unavailable" with no reason
                              // sends someone looking for a setting that does not exist.
                              `Not available — this endpoint does not report ${definition.capabilityPlugins.join(', ')}.`}
                        </UiText>
                      </YStack>
                    );
                  })
                : metricsByGroup().map((group) => (
                    <YStack key={group.group} gap="$2">
                      <MicroLabel>{GROUP_LABELS[group.group]}</MicroLabel>
                      {group.metrics.map((definition) => (
                        <YStack
                          key={definition.id}
                          gap={5}
                          p={14}
                          rounded={GEOMETRY.radius.widget}
                          borderWidth={1}
                          borderColor="$borderColor"
                          bg="$widgetBg"
                          pressStyle={{ borderColor: '$borderRaised' }}
                          onPress={() => setMetric(definition.id)}
                          role="button"
                          aria-label={definition.label}
                          testID={`widget-metric-${definition.id}`}
                        >
                          <XStack items="center" gap={8}>
                            <Label variant="metric" flex={1}>
                              {definition.label}
                            </Label>
                            <MicroLabel>
                              {widgetsForMetric(definition.id).length} styles
                            </MicroLabel>
                          </XStack>
                          <UiText variant="footer" color="$textDim">
                            {definition.description}
                          </UiText>
                        </YStack>
                      ))}
                    </YStack>
                  ))}
            </YStack>
          </ScrollView>
        )}
      </YStack>
    </SafeAreaView>
  );
}
