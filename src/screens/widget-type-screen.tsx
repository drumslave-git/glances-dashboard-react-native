import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, XStack, YStack } from 'tamagui';

import { WidgetPreview } from '@/components/dashboard/widget-preview';
import { EndpointChip } from '@/components/telemetry/chips';
import { ToolbarButton } from '@/components/telemetry/surfaces';
import { Label, MicroLabel, MonoText, UiText } from '@/components/telemetry/text';
import { useEndpointStatus } from '@/data/feed-store';
import { useEndpointState } from '@/hooks/useEndpointState';
import { useMetricsPreview } from '@/hooks/useMetricsPreview';
import { sortedEndpoints, useEndpointsStore } from '@/state/endpoints';
import { useWidgetsStore } from '@/state/widgets';
import { GEOMETRY } from '@/theme/telemetry';
import type { PluginName } from '@/types/glances';
import { MIN_ROW_HEIGHT_PX, PREVIEW_COL_WIDTH_PX, footprintPx } from '@/utils/gridLayout';
import {
  FOOTPRINTS,
  FOOTPRINT_LABELS,
  FOOTPRINT_NOTES,
  GROUP_LABELS,
  VARIANT_LABELS,
  footprintSize,
  isWidgetAvailable,
  metricsByGroup,
  pluginsForWidget,
  widgetDefinition,
  widgetsForMetric,
  type Footprint,
  type MetricId,
  type WidgetType,
} from '@/widgets/catalog';

/** Rows a variant card previews at — the regular footprint most types declare. */
const VARIANT_PREVIEW_ROWS = 3;

/** Ceiling on a size card's preview, so the wide footprint does not fill the screen. */
const SIZE_CARD_MAX_HEIGHT = 240;

/**
 * Add-widget, in two questions asked in that order: **what** do you want to see, then **how** do
 * you want it drawn (ref §8).
 *
 * The flat list this replaced asked one question that was really two, and answered the second — the
 * one a description genuinely cannot answer — with a sentence. Here the second step draws each
 * rendering from the live feed at the size it would be placed at, so the choice is made by looking
 * at this host's own numbers.
 */
export function WidgetTypeScreen() {
  const router = useRouter();
  const endpoints = useEndpointsStore((state) => state.endpoints);
  const defaultEndpointId = useEndpointsStore((state) => state.defaultEndpointId);
  const addWidget = useWidgetsStore((state) => state.addWidget);

  const ordered = sortedEndpoints(endpoints);
  const [endpointId, setEndpointId] = useState(defaultEndpointId ?? ordered[0]?.id ?? null);
  const [metric, setMetric] = useState<MetricId | null>(null);
  const [type, setType] = useState<WidgetType | null>(null);
  const [footprint, setFootprint] = useState<Footprint>('regular');
  const [width, setWidth] = useState(0);

  const endpoint = ordered.find((entry) => entry.id === endpointId);
  const status = useEndpointStatus(endpointId);
  const state = useEndpointState(endpoint);

  const variants = useMemo(() => (metric ? widgetsForMetric(metric) : []), [metric]);

  /**
   * Poll everything this metric's renderings need, for as long as the step is open — the whole
   * point of the transient preview set (ref §4.4). One request for the screen, not one per card:
   * the poller keeps a single preview slot, so cards asking individually would evict each other.
   */
  const previewPlugins = useMemo<PluginName[]>(
    () => [...new Set(variants.flatMap((definition) => pluginsForWidget(definition.type)))],
    [variants],
  );
  useMetricsPreview(endpointId, previewPlugins);

  const selected = type ? widgetDefinition(type) : null;
  // A global rendering reads every host, so it previews and saves without one.
  const previewEndpointId = selected?.scope === 'global' ? null : endpointId;

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth((current) => (current === next ? current : next));
  };

  const chooseMetric = (next: MetricId) => {
    setMetric(next);
    setType(null);
    setFootprint('regular');
  };

  const place = (configure: boolean) => {
    if (!selected) return;
    const size = footprintSize(selected.type, footprint);
    const widget = addWidget({
      type: selected.type,
      endpointId: selected.scope === 'global' ? null : endpointId,
      w: size.w,
      h: size.h,
    });
    if (configure) {
      router.replace({ pathname: '/widget/[id]', params: { id: widget.id } });
      return;
    }
    router.dismissAll();
    router.replace('/');
  };

  const previewWidth = Math.max(0, width);
  /**
   * A card is one column wide, because that is the footprint Add places by default — previewing it
   * at the full width of a desktop list would draw the *wide* rendering of something about to be
   * placed as a regular one.
   */
  const cardWidth = previewWidth === 0 ? 0 : Math.min(previewWidth, PREVIEW_COL_WIDTH_PX + 18);

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
            <YStack gap="$3" onLayout={onLayout}>
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

              {metric ? (
                <XStack gap={GEOMETRY.gridGap} flexWrap="wrap">
                  {variants.map((definition) => {
                    const available = isWidgetAvailable(definition.type, status?.capabilities);
                    const chosen = type === definition.type;
                    return (
                      <YStack
                        key={definition.type}
                        width={cardWidth}
                        gap={7}
                        p={9}
                        rounded={GEOMETRY.radius.widget}
                        borderWidth={1}
                        // Selection is carried by the border alone: a tinted fill behind a live
                        // widget would change the colours of the thing being previewed.
                        borderColor={chosen ? '$accent' : '$borderColor'}
                        bg="$widgetBg"
                        opacity={available ? 1 : 0.45}
                        pressStyle={available ? { borderColor: '$borderRaised' } : undefined}
                        onPress={available ? () => setType(definition.type) : undefined}
                        role="button"
                        aria-label={definition.label}
                        testID={`widget-variant-${definition.type}`}
                      >
                        {available && cardWidth > 0 && (
                          <WidgetPreview
                            type={definition.type}
                            endpointId={definition.scope === 'global' ? null : endpointId}
                            width={cardWidth - 18}
                            height={footprintPx(
                              VARIANT_PREVIEW_ROWS,
                              MIN_ROW_HEIGHT_PX,
                              GEOMETRY.gridGap,
                            )}
                            testID={`widget-variant-preview-${definition.type}`}
                          />
                        )}
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
                  })}
                </XStack>
              ) : (
                metricsByGroup().map((group) => (
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
                        onPress={() => chooseMetric(definition.id)}
                        role="button"
                        aria-label={definition.label}
                        testID={`widget-metric-${definition.id}`}
                      >
                        <XStack items="center" gap={8}>
                          <Label variant="metric" flex={1}>
                            {definition.label}
                          </Label>
                          <MicroLabel>
                            {widgetsForMetric(definition.id).length === 1
                              ? '1 style'
                              : `${widgetsForMetric(definition.id).length} styles`}
                          </MicroLabel>
                        </XStack>
                        <UiText variant="footer" color="$textDim">
                          {definition.description}
                        </UiText>
                      </YStack>
                    ))}
                  </YStack>
                ))
              )}

              {selected && previewWidth > 0 && (
                <YStack gap="$2" testID="widget-size-cards">
                  <MicroLabel>Size</MicroLabel>
                  <XStack gap={GEOMETRY.gridGap} flexWrap="wrap" items="flex-start">
                    {/* The same widget at each footprint, previewed at the width a placed column
                      usually has — so what a card shows is what Add will place. */}
                    {FOOTPRINTS.map((entry) => {
                      const size = footprintSize(selected.type, entry);
                      const cardWidth = Math.min(
                        previewWidth,
                        footprintPx(size.w, PREVIEW_COL_WIDTH_PX, GEOMETRY.gridGap),
                      );
                      const cardHeight = Math.min(
                        SIZE_CARD_MAX_HEIGHT,
                        footprintPx(size.h, MIN_ROW_HEIGHT_PX, GEOMETRY.gridGap),
                      );
                      return (
                        <YStack
                          key={entry}
                          gap={7}
                          p={9}
                          rounded={GEOMETRY.radius.widget}
                          borderWidth={1}
                          borderColor={footprint === entry ? '$accent' : '$borderColor'}
                          bg="$widgetBg"
                          pressStyle={{ borderColor: '$borderRaised' }}
                          onPress={() => setFootprint(entry)}
                          role="button"
                          aria-label={`${FOOTPRINT_LABELS[entry]} footprint`}
                          testID={`widget-size-${entry}`}
                        >
                          <WidgetPreview
                            type={selected.type}
                            endpointId={previewEndpointId}
                            width={cardWidth - 18}
                            height={cardHeight}
                          />
                          <XStack items="baseline" gap={8}>
                            <Label variant="metric">{FOOTPRINT_LABELS[entry]}</Label>
                            <MonoText variant="footer" color="$textFaint">
                              {size.w}×{size.h}
                            </MonoText>
                          </XStack>
                          <UiText variant="footer" color="$textDim">
                            {FOOTPRINT_NOTES[entry]}
                          </UiText>
                        </YStack>
                      );
                    })}
                  </XStack>
                </YStack>
              )}
            </YStack>
          </ScrollView>
        )}

        {selected && (
          <XStack gap={8} items="center">
            <ToolbarButton
              label="Add widget"
              variant="primary"
              onPress={() => place(false)}
              testID="widget-type-add"
            />
            {/* The options a type declares are all optional and all defaulted, so configuring is
                an offer rather than a step — and it is the same screen the ⋮ menu opens later. */}
            <ToolbarButton
              label="Add and configure"
              onPress={() => place(true)}
              testID="widget-type-add-configure"
            />
          </XStack>
        )}
      </YStack>
    </SafeAreaView>
  );
}
