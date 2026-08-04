import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Input, Label, Paragraph, ScrollView, XStack, YStack } from 'tamagui';

import { ToolbarButton } from '@/components/telemetry/surfaces';
import { Label as SectionLabel } from '@/components/telemetry/text';
import { GEOMETRY } from '@/theme/telemetry';

import { FALLBACK_METRICS } from '@/api/glances';
import { ChartOptionsSection } from '@/components/config/chart-options-section';
import { FieldOptionsSection } from '@/components/config/field-options-section';
import { OptionList } from '@/components/config/option-list';
import { isChartKind, WidgetContent } from '@/components/widgets/widget-content';
import { TIME_WINDOW_ORDER, type TimeWindow } from '@/utils/sampleBuffer';
import { useGlancesQuery, usePluginsList } from '@/hooks/useGlancesQuery';
import { selectEndpointById, useEndpointsStore } from '@/state/endpoints';
import { useWidgetsStore, type WidgetPatch } from '@/state/widgets';
import type { DonutChartOptions, WidgetKind } from '@/types/dashboard';
import { pickFormatters } from '@/utils/formatterSpec';
import {
  DEFAULT_PROCESS_FIELDS,
  DEFAULT_PROCESS_SORT,
  getProcessHeaderLabel,
} from '@/utils/processTable';
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

  const servers = useEndpointsStore((state) => state.endpoints);
  const defaultEndpointId = useEndpointsStore((state) => state.defaultEndpointId);
  const widgets = useWidgetsStore((state) => state.widgets);
  const addWidget = useWidgetsStore((state) => state.addWidget);
  const updateWidget = useWidgetsStore((state) => state.updateWidget);

  const existing = isNew ? undefined : widgets.find((widget) => widget.id === params.id);
  const kind: WidgetKind = existing?.kind ?? ((params.kind as WidgetKind | undefined) ?? 'text');
  const isProcesses = kind === 'processes';
  const isChart = isChartKind(kind);
  const isLine = kind === 'line';
  /**
   * Slice geometry, the centre label and the Used/Free split belong to the
   * round and bar charts. A ring gauge has no slices to inset and a time series
   * has no segments to label, so offering those controls there would be lying
   * about what they do.
   */
  const isSegmentChart = kind === 'donut' || kind === 'pie' || kind === 'bar';

  const [serverId, setServerId] = useState(
    existing?.serverId ?? defaultEndpointId ?? servers[0]?.id ?? '',
  );
  const [metric, setMetric] = useState(
    existing?.metric ?? (isProcesses ? 'processlist' : 'cpu'),
  );
  const [title, setTitle] = useState(existing?.title ?? '');
  const [fields, setFields] = useState<string[]>(existing?.fields ?? []);
  const [fieldColors, setFieldColors] = useState<Record<string, string>>(
    existing?.fieldColors ?? {},
  );
  const [fieldFormatters, setFieldFormatters] = useState<Record<string, string>>(
    existing?.fieldFormatters ?? {},
  );
  const [chartOptions, setChartOptions] = useState<DonutChartOptions>(
    existing?.donutChartOptions ?? {},
  );
  const [chartLabel, setChartLabel] = useState(existing?.chartLabel ?? '');
  const [splitUsedFree, setSplitUsedFree] = useState(
    existing?.splitPercentageIntoUsedFree ?? false,
  );
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(existing?.timeWindow ?? '15m');
  const [processSort, setProcessSort] = useState(existing?.processSort ?? DEFAULT_PROCESS_SORT);

  const server = useEndpointsStore((state) => selectEndpointById(state, serverId));

  const { data: plugins } = usePluginsList(server);
  const metricOptions = useMemo(() => {
    const list = Array.isArray(plugins) && plugins.length > 0 ? plugins : FALLBACK_METRICS;
    // Process widgets are locked to processlist; everything else excludes it.
    return isProcesses ? ['processlist'] : list.filter((name) => name !== 'processlist');
  }, [isProcesses, plugins]);

  // Live sample of the chosen endpoint: drives both the field picker and preview.
  const endpointPath = metricToEndpoint(resolveMetricForKind(kind, metric));
  const { data: sample, isLoading, error } = useGlancesQuery(server, endpointPath, {
    pollIntervalMs: 0,
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
    setFieldFormatters({});
  };

  const canSave = Boolean(serverId);

  const previewConfig = {
    metric,
    fields,
    fieldFormatters,
    ...(isChart && {
      fieldColors,
      donutChartOptions: chartOptions,
      chartLabel: chartLabel.trim() || undefined,
      splitPercentageIntoUsedFree: splitUsedFree,
      ...(isLine ? { timeWindow } : {}),
      ...(isProcesses ? { processSort } : {}),
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
      fieldFormatters: pickFormatters(fieldFormatters, fields),
      ...(isChart && {
        fieldColors: pickColors(fieldColors, fields),
        donutChartOptions: chartOptions,
        chartLabel: chartLabel.trim() || undefined,
        splitPercentageIntoUsedFree: splitUsedFree,
        ...(isLine ? { timeWindow } : {}),
        ...(isProcesses ? { processSort } : {}),
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
      <YStack flex={1} bg="$appBg" p={GEOMETRY.gridPadding} gap="$3">
        <SectionLabel variant="readout">{existing ? 'Edit widget' : 'New widget'}</SectionLabel>

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
              <Label>{isProcesses ? 'Columns' : 'Fields'}</Label>
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
                {isProcesses
                  ? `Leave empty for the default columns: ${DEFAULT_PROCESS_FIELDS.join(', ')}.`
                  : isChart
                    ? 'Leave empty to chart every numeric field in the payload.'
                    : 'Leave empty to show the whole payload.'}
              </Paragraph>
            </YStack>

            <YStack gap="$2">
              <Label>{isProcesses ? 'Column order' : 'Selected fields'}</Label>
              <FieldOptionsSection
                fields={fields}
                fieldColors={fieldColors}
                fieldFormatters={fieldFormatters}
                showColors={isChart}
                onFieldsChange={setFields}
                onColorsChange={setFieldColors}
                onFormattersChange={setFieldFormatters}
                testID="widget-field"
              />
            </YStack>

            {isLine && (
              <YStack gap="$2">
                <Label>Time window</Label>
                <XStack gap="$2" flexWrap="wrap">
                  {TIME_WINDOW_ORDER.map((option) => (
                    <ToolbarButton
                      key={option}
                      label={option}
                      active={timeWindow === option}
                      onPress={() => setTimeWindow(option)}
                      testID={`widget-time-window-${option}`}
                    />
                  ))}
                </XStack>
                <Paragraph size="$1" opacity={0.6}>
                  How much history the chart covers. Samples are kept in memory only
                  and start over when the app restarts.
                </Paragraph>
              </YStack>
            )}

            {isProcesses && fields.length > 0 && (
              <YStack gap="$2">
                <Label>Sort by</Label>
                <XStack gap="$2" flexWrap="wrap">
                  {fields.map((field) => (
                    <ToolbarButton
                      key={field}
                      label={getProcessHeaderLabel(field)}
                      active={processSort === field}
                      onPress={() => setProcessSort(field)}
                      testID={`widget-process-sort-${field}`}
                    />
                  ))}
                </XStack>
                <Paragraph size="$1" opacity={0.6}>
                  Descending — the biggest consumer leads.
                </Paragraph>
              </YStack>
            )}

            {isSegmentChart && (
              <>
                <XStack items="center" gap="$2">
                  <YStack flex={1}>
                    <Paragraph size="$2">Split percentage into Used / Free</Paragraph>
                    <Paragraph size="$1" opacity={0.6}>
                      For a single 0–100 field, such as memory percent.
                    </Paragraph>
                  </YStack>
                  <ToolbarButton
                    label={splitUsedFree ? 'On' : 'Off'}
                    active={splitUsedFree}
                    onPress={() => setSplitUsedFree((current) => !current)}
                    testID="widget-split-used-free"
                  />
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
          <YStack flex={1}>
            <ToolbarButton label="Cancel" onPress={() => router.back()} testID="widget-cancel" />
          </YStack>
          <YStack flex={1}>
            <ToolbarButton
              label="Save"
              variant="primary"
              onPress={handleSave}
              disabled={!canSave}
              testID="widget-save"
            />
          </YStack>
        </XStack>
      </YStack>
    </SafeAreaView>
  );
}
