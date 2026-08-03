import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, H2, Input, Label, Paragraph, ScrollView, XStack, YStack } from 'tamagui';

import { FALLBACK_METRICS } from '@/api/glances';
import { ChartOptionsSection } from '@/components/config/chart-options-section';
import { FieldColorsSection } from '@/components/config/field-colors-section';
import { OptionList } from '@/components/config/option-list';
import { isChartKind, WidgetContent } from '@/components/widgets/widget-content';
import { useGlancesQuery, usePluginsList } from '@/hooks/useGlancesQuery';
import { selectServerById, useServersStore } from '@/state/servers';
import { useWidgetsStore, type WidgetPatch } from '@/state/widgets';
import type { DonutChartOptions, WidgetKind } from '@/types/dashboard';
import { getRecordFromPayload, resolveTitleTokens } from '@/utils/widgetData';
import { defaultWidgetTitle, metricToEndpoint, resolveMetricForKind } from '@/utils/widgetFactory';

/** Keep only the colours of fields that are still selected. */
function pickColors(fieldColors: Record<string, string>, fields: string[]): Record<string, string> {
  return Object.fromEntries(fields.filter((field) => field in fieldColors).map((field) => [field, fieldColors[field]]));
}

export function WidgetConfigScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; kind?: string }>();
  const isNew = !params.id || params.id === 'new';

  const servers = useServersStore((state) => state.servers);
  const defaultServerId = useServersStore((state) => state.defaultServerId);
  const widgets = useWidgetsStore((state) => state.widgets);
  const addWidget = useWidgetsStore((state) => state.addWidget);
  const updateWidget = useWidgetsStore((state) => state.updateWidget);

  const existing = isNew ? undefined : widgets.find((widget) => widget.id === params.id);
  const kind: WidgetKind = existing?.kind ?? ((params.kind as WidgetKind | undefined) ?? 'text');
  const isProcesses = kind === 'processes';
  const isChart = isChartKind(kind);

  const [serverId, setServerId] = useState(
    existing?.serverId ?? defaultServerId ?? servers[0]?.id ?? '',
  );
  const [metric, setMetric] = useState(
    existing?.metric ?? (isProcesses ? 'processlist' : 'cpu'),
  );
  const [title, setTitle] = useState(existing?.title ?? '');
  const [fields, setFields] = useState<string[]>(existing?.fields ?? []);
  const [fieldColors, setFieldColors] = useState<Record<string, string>>(
    existing?.fieldColors ?? {},
  );
  const [chartOptions, setChartOptions] = useState<DonutChartOptions>(
    existing?.donutChartOptions ?? {},
  );
  const [chartLabel, setChartLabel] = useState(existing?.chartLabel ?? '');
  const [splitUsedFree, setSplitUsedFree] = useState(
    existing?.splitPercentageIntoUsedFree ?? false,
  );

  const server = useServersStore((state) => selectServerById(state, serverId));

  const { data: plugins } = usePluginsList(server);
  const metricOptions = useMemo(() => {
    const list = Array.isArray(plugins) && plugins.length > 0 ? plugins : FALLBACK_METRICS;
    // Process widgets are locked to processlist; everything else excludes it.
    return isProcesses ? ['processlist'] : list.filter((name) => name !== 'processlist');
  }, [isProcesses, plugins]);

  // Live sample of the chosen endpoint: drives both the field picker and preview.
  const endpointPath = metricToEndpoint(resolveMetricForKind(kind, metric));
  const { data: sample, isLoading, error } = useGlancesQuery(server, endpointPath, {
    refreshMs: 0,
  });

  const availableFields = useMemo(() => {
    const record = getRecordFromPayload(sample);
    if (!record) return [];
    return Object.keys(record).sort((a, b) => a.localeCompare(b));
  }, [sample]);

  const toggleField = (field: string) => {
    setFields((current) =>
      current.includes(field) ? current.filter((f) => f !== field) : [...current, field],
    );
  };

  const handleMetricChange = (next: string) => {
    if (next === metric) return;
    setMetric(next);
    // Fields belong to the previous payload shape.
    setFields([]);
    setFieldColors({});
  };

  const canSave = Boolean(serverId);

  const previewConfig = {
    metric,
    fields,
    ...(isChart && {
      fieldColors,
      donutChartOptions: chartOptions,
      chartLabel: chartLabel.trim() || undefined,
      splitPercentageIntoUsedFree: splitUsedFree,
    }),
  };

  const handleSave = () => {
    if (!canSave) return;
    const resolvedTitle = title.trim() || defaultWidgetTitle(kind, resolveMetricForKind(kind, metric));

    const patch: WidgetPatch = {
      serverId,
      metric,
      title: resolvedTitle,
      fields: fields.length > 0 ? fields : undefined,
      ...(isChart && {
        fieldColors: pickColors(fieldColors, fields),
        donutChartOptions: chartOptions,
        chartLabel: chartLabel.trim() || undefined,
        splitPercentageIntoUsedFree: splitUsedFree,
      }),
    };

    if (existing) {
      updateWidget(existing.id, patch);
    } else {
      const widget = addWidget({ serverId, metric, kind, title: resolvedTitle });
      updateWidget(widget.id, patch);
    }
    router.dismissTo('/');
  };

  const previewTitle = resolveTitleTokens(
    title.trim() || defaultWidgetTitle(kind, resolveMetricForKind(kind, metric)),
    sample,
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <YStack flex={1} p="$4" gap="$3">
        <H2>{existing ? 'Edit widget' : 'New widget'}</H2>

        <ScrollView flex={1} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <YStack gap="$4">
            <YStack gap="$2">
              <Label>Server</Label>
              <OptionList
                options={servers.map((s) => s.name)}
                value={server?.name ?? ''}
                onSelect={(name) => {
                  const match = servers.find((s) => s.name === name);
                  if (match) setServerId(match.id);
                }}
                emptyMessage="No servers configured. Add one in Settings first."
                testID="widget-server"
              />
            </YStack>

            <YStack gap="$2">
              <Label>Metric</Label>
              <OptionList
                options={metricOptions}
                value={metric}
                onSelect={handleMetricChange}
                emptyMessage="No metrics available."
                testID="widget-metric"
              />
            </YStack>

            <YStack gap="$2">
              <Label htmlFor="widget-title">Title</Label>
              <Input
                id="widget-title"
                value={title}
                onChangeText={setTitle}
                placeholder={defaultWidgetTitle(kind, resolveMetricForKind(kind, metric))}
                testID="widget-title-input"
              />
              <Paragraph size="$1" opacity={0.6}>
                Use {'{{field}}'} or {'{{field:round(1)}}'} to show a live value in the title.
              </Paragraph>
            </YStack>

            <YStack gap="$2">
              <Label>Fields</Label>
              <OptionList
                options={availableFields}
                value={fields}
                onSelect={toggleField}
                multi
                emptyMessage={
                  isLoading
                    ? 'Loading fields…'
                    : error
                      ? `Could not read fields: ${error.message}`
                      : 'No fields discovered yet.'
                }
                testID="widget-fields"
              />
              <Paragraph size="$1" opacity={0.6}>
                {isChart
                  ? 'Leave empty to chart every numeric field in the payload.'
                  : 'Leave empty to show the whole payload.'}
              </Paragraph>
            </YStack>

            {isChart && (
              <>
                <YStack gap="$2">
                  <Label>Segment colours</Label>
                  <FieldColorsSection
                    fields={fields}
                    fieldColors={fieldColors}
                    onChange={setFieldColors}
                    testID="widget-field-color"
                  />
                </YStack>

                <XStack items="center" gap="$2">
                  <YStack flex={1}>
                    <Paragraph size="$2">Split percentage into Used / Free</Paragraph>
                    <Paragraph size="$1" opacity={0.6}>
                      For a single 0–100 field, such as memory percent.
                    </Paragraph>
                  </YStack>
                  <Button
                    size="$2"
                    theme={splitUsedFree ? 'blue' : undefined}
                    onPress={() => setSplitUsedFree((current) => !current)}
                    testID="widget-split-used-free"
                  >
                    {splitUsedFree ? 'On' : 'Off'}
                  </Button>
                </XStack>

                <YStack gap="$2">
                  <Label htmlFor="widget-chart-label">Chart label</Label>
                  <Input
                    id="widget-chart-label"
                    value={chartLabel}
                    onChangeText={setChartLabel}
                    placeholder={metric}
                    testID="widget-chart-label-input"
                  />
                  <Paragraph size="$1" opacity={0.6}>
                    Shown in the middle of a donut. Tokens work here too.
                  </Paragraph>
                </YStack>

                <YStack gap="$2">
                  <Label>Chart options</Label>
                  <ChartOptionsSection
                    kind={kind}
                    options={chartOptions}
                    onChange={setChartOptions}
                    testID="widget-chart-options"
                  />
                </YStack>
              </>
            )}

            <YStack gap="$2">
              <Label>Preview</Label>
              <Card borderWidth={1} borderColor="$borderColor" p="$3" height={172} testID="widget-preview">
                <YStack flex={1} gap="$2">
                  <Paragraph size="$2" opacity={0.8} numberOfLines={1}>
                    {previewTitle}
                  </Paragraph>
                  <YStack flex={1}>
                    <WidgetContent
                      kind={kind}
                      data={sample ?? null}
                      config={previewConfig}
                      noServer={!server}
                      loading={isLoading}
                      error={error ? error.message : null}
                      testID="widget-preview-content"
                    />
                  </YStack>
                </YStack>
              </Card>
            </YStack>
          </YStack>
        </ScrollView>

        <XStack gap="$2">
          <Button flex={1} size="$4" onPress={() => router.back()} testID="widget-cancel">
            Cancel
          </Button>
          <Button
            flex={1}
            size="$4"
            theme="blue"
            onPress={handleSave}
            disabled={!canSave}
            testID="widget-save"
          >
            Save
          </Button>
        </XStack>
      </YStack>
    </SafeAreaView>
  );
}
