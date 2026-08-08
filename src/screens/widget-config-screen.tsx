import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input, Label as FieldLabel, Paragraph, ScrollView, XStack, YStack } from 'tamagui';

import { EndpointChip } from '@/components/telemetry/chips';
import { ToolbarButton } from '@/components/telemetry/surfaces';
import { Label, MicroLabel, UiText } from '@/components/telemetry/text';
import { useLatest } from '@/data/feed-store';
import { useEndpointState } from '@/hooks/useEndpointState';
import { useMetricsPreview } from '@/hooks/useMetricsPreview';
import { sortedEndpoints, useEndpointsStore } from '@/state/endpoints';
import { useWidgetsStore } from '@/state/widgets';
import { paletteFor } from '@/components/settings/appearance-fields';
import { parseWidgetAppearance, type ThemedColor } from '@/theme/appearance';
import { useTelemetry } from '@/theme/use-telemetry';
import { GEOMETRY } from '@/theme/telemetry';
import { TIME_WINDOW_ORDER, TIME_WINDOWS } from '@/utils/sampleBuffer';
import {
  ENDPOINT_SCOPED_SELECTIONS,
  clearEndpointScopedConfig,
  isEndpointScopedKey,
  optionChoices,
  isWidgetType,
  parseWidgetConfig,
  widgetDefinition,
  type EndpointScopedKey,
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
  const params = useLocalSearchParams<{ id: string }>();

  const endpoints = useEndpointsStore((state) => state.endpoints);
  const widgets = useWidgetsStore((state) => state.widgets);
  const updateWidget = useWidgetsStore((state) => state.updateWidget);

  // Editing only. The picker places the widget itself, at the footprint its size cards previewed —
  // so there is no half-made widget to carry through this screen, and no second creation path.
  const existing = widgets.find((widget) => widget.id === params.id);
  const type = existing?.type;
  const definition = type && isWidgetType(type) ? widgetDefinition(type) : null;

  const ordered = sortedEndpoints(endpoints);
  const [endpointId, setEndpointId] = useState<string | null>(
    existing?.endpointId ?? ordered[0]?.id ?? null,
  );
  const [title, setTitle] = useState(existing?.title ?? '');
  const [config, setConfig] = useState<Record<string, unknown>>(() =>
    definition ? parseWidgetConfig(definition.type, existing?.config ?? {}) : {},
  );
  // `null` is "inherit the board", which is what almost every widget wants — the override exists
  // to tell one host, or one role, apart from the rest (ref §7.6).
  const [background, setBackground] = useState<ThemedColor | null>(
    () => parseWidgetAppearance(existing?.appearance).background,
  );

  const endpoint = ordered.find((entry) => entry.id === endpointId);
  const endpointState = useEndpointState(endpoint);
  const { t, mode: themeMode } = useTelemetry();
  // Poll this type's plugins while the screen is open, so the selection pickers can list what the
  // endpoint actually has — even when no placed widget requires them yet. Called before the early
  // return below, or the hook order would differ between the two branches.
  useMetricsPreview(endpointId, definition?.requiredPlugins ?? []);

  if (!definition) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <YStack flex={1} bg="$appBg" p={GEOMETRY.gridPadding} gap="$3">
          <Label variant="readout">Widget</Label>
          <UiText variant="metric" color="$textDim" testID="widget-config-unknown">
            {existing
              ? 'This widget type is not available in this build.'
              : 'This widget is no longer on the dashboard.'}
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

  // A global widget belongs to no host (ref §4.4). Saving it against one is not a cosmetic slip:
  // `removeWidgetsForEndpoint` deletes by endpoint id, so an alerts feed bound to a host would be
  // deleted along with that host — the exact outcome the global scope exists to prevent.
  const isGlobal = definition.scope === 'global';

  const save = () => {
    if (!existing || (!isGlobal && !endpointId)) return;
    const trimmed = title.trim();
    updateWidget(existing.id, {
      endpointId: isGlobal ? null : endpointId,
      title: trimmed === '' ? null : trimmed,
      config,
      // Nothing overridden is stored as `null` rather than as a record of nulls, so "inherit" is
      // one value everywhere rather than two shapes meaning the same thing.
      appearance: background ? { background } : null,
    });
    router.dismissAll();
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <YStack flex={1} bg="$appBg" p={GEOMETRY.gridPadding} gap="$3">
        <XStack items="center" gap="$3">
          <Label flex={1} variant="readout">
            Edit widget
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

            {isGlobal ? (
              <YStack gap="$2">
                <MicroLabel>Endpoint</MicroLabel>
                <UiText variant="footer" color="$textDim" testID="widget-endpoint-global">
                  Reads every endpoint. This widget is not bound to one.
                </UiText>
              </YStack>
            ) : (
            <YStack gap="$2">
              <MicroLabel>Endpoint</MicroLabel>
              <XStack gap={8} flexWrap="wrap">
                {ordered.map((entry) => (
                  <YStack
                    key={entry.id}
                    onPress={() => rebind(entry.id)}
                    cursor="pointer"
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
            )}

            <WidgetOptions
              type={definition.type}
              config={config}
              endpointId={endpointId}
              onChange={setOption}
            />

            <YStack gap="$2" testID="widget-background">
              <MicroLabel>Background</MicroLabel>
              <UiText variant="footer" color="$textDim">
                Inherits the board unless you pick a colour here — one way to tell a host, or a
                role, apart on a full grid.
              </UiText>
              <XStack gap={8} items="center" flexWrap="wrap">
                <ToolbarButton
                  label="Inherit"
                  active={background === null}
                  onPress={() => setBackground(null)}
                  testID="widget-background-inherit"
                />
                {paletteFor(themeMode).map((swatch) => {
                  const selected = background?.[themeMode].color === swatch;
                  return (
                    <YStack
                      key={swatch}
                      width={26}
                      height={26}
                      rounded={4}
                      items="center"
                      justify="center"
                      borderWidth={1}
                      cursor="pointer"
                      pressStyle={{ opacity: 0.6 }}
                      // Both schemes get the same hex here: a per-widget override is a mark on one
                      // card, and asking for it twice would cost more than the mark is worth. The
                      // *board* colours, which every panel inherits, are edited per scheme.
                      onPress={() =>
                        setBackground({
                          light: { color: swatch, alpha: 1 },
                          dark: { color: swatch, alpha: 1 },
                        })
                      }
                      role="button"
                      aria-label={`Widget background ${swatch}`}
                      style={{ borderColor: selected ? t.text.primary : t.border.control }}
                      testID={`widget-background-${swatch.replace('#', '')}`}
                    >
                      <YStack width={16} height={16} rounded={3} style={{ backgroundColor: swatch }} />
                    </YStack>
                  );
                })}
              </XStack>
            </YStack>
          </YStack>
        </ScrollView>

        <ToolbarButton
          label="Save"
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
  showEveryMount: 'Show every mount, including bind mounts',
  includeResolved: 'Include resolved events',
  sort: 'Sort by',
  severity: 'Severity',
  rows: 'Rows',
};

/** Readable names for enum cases. Anything unnamed shows the case as the schema spells it. */
const CHOICE_LABELS: Record<string, string> = {
  cpu: 'CPU',
  memory: 'Memory',
  name: 'Name',
  all: 'All',
  critical: 'Critical only',
};

/** The row counts offered for a table. A free-text number field would need a keyboard and a parse. */
const ROW_CHOICES = [10, 20, 30, 50];

/**
 * The options a widget type declares, rendered from its parsed config.
 *
 * Driven by the *shape* of each value rather than by a per-type form: a boolean is a toggle, a
 * window is the window picker. Thirteen bespoke forms would be thirteen places to keep in step with
 * thirteen schemas, and the schemas are already the source of truth.
 */
function WidgetOptions({
  type,
  config,
  endpointId,
  onChange,
}: {
  type: WidgetType;
  config: Record<string, unknown>;
  endpointId: string | null;
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

        if (isEndpointScopedKey(key) && Array.isArray(value)) {
          return (
            <SelectionPicker
              key={key}
              selectionKey={key}
              selected={value.filter((entry): entry is string => typeof entry === 'string')}
              endpointId={endpointId}
              onChange={(next) => onChange(key, next)}
            />
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

        // A string option's cases come from the schema rather than from a list kept here, so
        // adding one to an enum adds a button with nothing else to remember.
        if (typeof value === 'string') {
          const choices = optionChoices(type, key);
          if (!choices) return null;
          return (
            <YStack key={key} gap={7}>
              <MicroLabel>{OPTION_LABELS[key] ?? key}</MicroLabel>
              <XStack gap={8} flexWrap="wrap">
                {choices.map((choice) => (
                  <ToolbarButton
                    key={choice}
                    label={CHOICE_LABELS[choice] ?? choice}
                    active={value === choice}
                    onPress={() => onChange(key, choice)}
                    testID={`widget-option-${key}-${choice}`}
                  />
                ))}
              </XStack>
            </YStack>
          );
        }

        if (typeof value === 'number') {
          return (
            <YStack key={key} gap={7}>
              <MicroLabel>{OPTION_LABELS[key] ?? key}</MicroLabel>
              <XStack gap={8} flexWrap="wrap">
                {ROW_CHOICES.map((count) => (
                  <ToolbarButton
                    key={count}
                    label={String(count)}
                    active={value === count}
                    onPress={() => onChange(key, count)}
                    testID={`widget-option-${key}-${count}`}
                  />
                ))}
              </XStack>
            </YStack>
          );
        }

        return null;
      })}
    </YStack>
  );
}

/**
 * Choose which interfaces, disks, mounts, sensor types or GPUs a widget reads.
 *
 * The options are what the endpoint is reporting **now**, read straight from the feed — so the
 * picker lists this machine's four interfaces rather than a guess, and lists nothing at all when
 * the endpoint has not answered yet.
 *
 * Selecting none is a real choice, not an empty state: it means "choose for me", which the widget
 * honours by showing the busiest few (or all, where that is the sensible default). The `Auto` chip
 * is how you get back to it, and it is highlighted whenever the selection is empty.
 */
function SelectionPicker({
  selectionKey,
  selected,
  endpointId,
  onChange,
}: {
  selectionKey: EndpointScopedKey;
  selected: string[];
  endpointId: string | null;
  onChange: (next: string[]) => void;
}) {
  const source = ENDPOINT_SCOPED_SELECTIONS[selectionKey];
  const payload = useLatest<unknown>(endpointId, source.plugin);
  const options = source.options(payload);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((entry) => entry !== value) : [...selected, value]);

  return (
    <YStack gap={7} testID={`widget-selection-${selectionKey}`}>
      <MicroLabel>{source.label}</MicroLabel>
      {options.length === 0 ? (
        <UiText variant="footer" color="$textDim">
          {endpointId
            ? 'Nothing reported yet — the widget will choose for you.'
            : 'Pick an endpoint first.'}
        </UiText>
      ) : (
        <XStack gap={8} flexWrap="wrap">
          <ToolbarButton
            label={source.autoLabel}
            active={selected.length === 0}
            onPress={() => onChange([])}
            testID={`widget-selection-${selectionKey}-auto`}
          />
          {options.map((option) => (
            <ToolbarButton
              key={option.value}
              label={option.label}
              active={selected.includes(option.value)}
              onPress={() => toggle(option.value)}
              testID={`widget-selection-${selectionKey}-${option.value}`}
            />
          ))}
        </XStack>
      )}
    </YStack>
  );
}
