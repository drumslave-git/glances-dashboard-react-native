import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input, Label as FieldLabel, Paragraph, ScrollView, XStack, YStack } from 'tamagui';

import { EndpointChip } from '@/components/telemetry/chips';
import { ToolbarButton } from '@/components/telemetry/surfaces';
import { Label, MicroLabel, UiText } from '@/components/telemetry/text';
import { useEndpointState } from '@/hooks/useEndpointState';
import { sortedEndpoints, useEndpointsStore } from '@/state/endpoints';
import { useWidgetsStore } from '@/state/widgets';
import { GEOMETRY } from '@/theme/telemetry';
import { TIME_WINDOW_ORDER, TIME_WINDOWS } from '@/utils/sampleBuffer';
import {
  clearEndpointScopedConfig,
  isWidgetType,
  parseWidgetConfig,
  widgetDefinition,
  type WidgetType,
} from '@/widgets/catalog';

/**
 * Configure one widget: its title, which endpoint it reads from, and the options its own type
 * declares.
 *
 * There is no field picker any more. A typed widget knows what it measures, so the only questions
 * left are the handful its schema names — and those are rendered from the parsed config rather than
 * from a form written per type, which is what keeps adding a widget type down to one entry in each
 * half of the registry.
 */
export function WidgetConfigScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; type?: string; endpointId?: string }>();
  const isNew = !params.id || params.id === 'new';

  const endpoints = useEndpointsStore((state) => state.endpoints);
  const widgets = useWidgetsStore((state) => state.widgets);
  const addWidget = useWidgetsStore((state) => state.addWidget);
  const updateWidget = useWidgetsStore((state) => state.updateWidget);

  const existing = isNew ? undefined : widgets.find((widget) => widget.id === params.id);
  const type = existing?.type ?? params.type;
  const definition = type && isWidgetType(type) ? widgetDefinition(type) : null;

  const ordered = sortedEndpoints(endpoints);
  const [endpointId, setEndpointId] = useState<string | null>(
    existing?.endpointId ?? params.endpointId ?? ordered[0]?.id ?? null,
  );
  const [title, setTitle] = useState(existing?.title ?? '');
  const [config, setConfig] = useState<Record<string, unknown>>(() =>
    definition ? parseWidgetConfig(definition.type, existing?.config ?? {}) : {},
  );

  const endpoint = ordered.find((entry) => entry.id === endpointId);
  const endpointState = useEndpointState(endpoint);

  if (!definition) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <YStack flex={1} bg="$appBg" p={GEOMETRY.gridPadding} gap="$3">
          <Label variant="readout">Widget</Label>
          <UiText variant="metric" color="$textDim" testID="widget-config-unknown">
            This widget type is not available in this build.
          </UiText>
          <ToolbarButton label="Back" onPress={() => router.back()} testID="widget-config-cancel" />
        </YStack>
      </SafeAreaView>
    );
  }

  const setOption = (key: string, value: unknown) =>
    setConfig((current) => ({ ...current, [key]: value }));

  const rebind = (nextId: string) => {
    if (nextId === endpointId) return;
    setEndpointId(nextId);
    // A selection naming something on the old host — an interface, a disk, a mount — would not
    // degrade on the new one, it would draw an empty panel with no explanation (ref §7.1).
    setConfig((current) => clearEndpointScopedConfig(current));
  };

  const save = () => {
    if (!endpointId) return;
    const trimmed = title.trim();
    const patch = { endpointId, title: trimmed === '' ? null : trimmed, config };
    if (existing) {
      updateWidget(existing.id, patch);
    } else {
      addWidget({ type: definition.type as WidgetType, ...patch });
    }
    router.dismissAll();
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <YStack flex={1} bg="$appBg" p={GEOMETRY.gridPadding} gap="$3">
        <XStack items="center" gap="$3">
          <Label flex={1} variant="readout">
            {existing ? 'Edit widget' : definition.label}
          </Label>
          <ToolbarButton label="Cancel" onPress={() => router.back()} testID="widget-config-cancel" />
        </XStack>

        <ScrollView flex={1} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <YStack gap="$4">
            <UiText variant="footer" color="$textDim" testID="widget-config-description">
              {definition.description}
            </UiText>

            <YStack gap="$2">
              <FieldLabel htmlFor="widget-title">Title</FieldLabel>
              <Input
                id="widget-title"
                value={title}
                onChangeText={setTitle}
                placeholder={definition.label}
                testID="widget-title-input"
              />
              <Paragraph size="$1" opacity={0.6}>
                Leave blank to use the type’s own name.
              </Paragraph>
            </YStack>

            <YStack gap="$2">
              <MicroLabel>Endpoint</MicroLabel>
              <XStack gap={8} flexWrap="wrap">
                {ordered.map((entry) => (
                  <YStack
                    key={entry.id}
                    onPress={() => rebind(entry.id)}
                    opacity={entry.id === endpointId ? 1 : 0.5}
                    role="button"
                    aria-label={`Endpoint ${entry.name}`}
                    testID={`widget-endpoint-${entry.id}`}
                  >
                    <EndpointChip
                      name={entry.name}
                      color={entry.color}
                      state={entry.id === endpointId ? endpointState : 'online'}
                    />
                  </YStack>
                ))}
              </XStack>
            </YStack>

            <WidgetOptions config={config} onChange={setOption} />
          </YStack>
        </ScrollView>

        <ToolbarButton
          label={existing ? 'Save' : 'Add widget'}
          variant="primary"
          onPress={save}
          testID="widget-save"
        />
      </YStack>
    </SafeAreaView>
  );
}

/** Readable names for the schema keys. An unnamed key falls back to the key itself. */
const OPTION_LABELS: Record<string, string> = {
  split: 'Split into user / system / iowait',
  perCoreOverlay: 'Overlay per-core traces',
  showSwap: 'Show swap',
  normalize: 'Normalize per core',
};

/**
 * The options a widget type declares, rendered from its parsed config.
 *
 * Driven by the *shape* of each value rather than by a per-type form: a boolean is a toggle, a
 * window is the window picker. Thirteen bespoke forms would be thirteen places to keep in step with
 * thirteen schemas, and the schemas are already the source of truth.
 */
function WidgetOptions({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const entries = Object.entries(config);
  if (entries.length === 0) return null;

  return (
    <YStack gap="$3" testID="widget-options">
      <MicroLabel>Options</MicroLabel>
      {entries.map(([key, value]) => {
        if (key === 'windowSec') {
          return (
            <YStack key={key} gap={7}>
              <MicroLabel>Time window</MicroLabel>
              <XStack gap={8} flexWrap="wrap">
                {TIME_WINDOW_ORDER.map((window) => {
                  const seconds = TIME_WINDOWS[window] / 1000;
                  return (
                    <ToolbarButton
                      key={window}
                      label={window}
                      active={value === seconds}
                      onPress={() => onChange(key, seconds)}
                      testID={`widget-window-${window}`}
                    />
                  );
                })}
              </XStack>
            </YStack>
          );
        }

        if (typeof value === 'boolean') {
          return (
            <XStack key={key} items="center" gap="$3">
              <UiText variant="metric" flex={1}>
                {OPTION_LABELS[key] ?? key}
              </UiText>
              <ToolbarButton
                label={value ? 'On' : 'Off'}
                active={value}
                onPress={() => onChange(key, !value)}
                testID={`widget-option-${key}`}
              />
            </XStack>
          );
        }

        return null;
      })}
    </YStack>
  );
}
