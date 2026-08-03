import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, H2, Input, Label, Paragraph, ScrollView, XStack, YStack } from 'tamagui';

import { FALLBACK_METRICS } from '@/api/glances';
import { OptionList } from '@/components/config/option-list';
import { WidgetContent } from '@/components/widgets/widget-content';
import { useGlancesQuery, usePluginsList } from '@/hooks/useGlancesQuery';
import { selectServerById, useServersStore } from '@/state/servers';
import { useWidgetsStore } from '@/state/widgets';
import type { WidgetKind } from '@/types/dashboard';
import { getRecordFromPayload, resolveTitleTokens } from '@/utils/widgetData';
import { defaultWidgetTitle, metricToEndpoint, resolveMetricForKind } from '@/utils/widgetFactory';

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

  const [serverId, setServerId] = useState(
    existing?.serverId ?? defaultServerId ?? servers[0]?.id ?? '',
  );
  const [metric, setMetric] = useState(
    existing?.metric ?? (isProcesses ? 'processlist' : 'cpu'),
  );
  const [title, setTitle] = useState(existing?.title ?? '');
  const [fields, setFields] = useState<string[]>(existing?.fields ?? []);

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
  };

  const canSave = Boolean(serverId);

  const handleSave = () => {
    if (!canSave) return;
    const resolvedTitle = title.trim() || defaultWidgetTitle(kind, resolveMetricForKind(kind, metric));

    if (existing) {
      updateWidget(existing.id, {
        serverId,
        metric,
        title: resolvedTitle,
        fields: fields.length > 0 ? fields : undefined,
      });
    } else {
      const widget = addWidget({ serverId, metric, kind, title: resolvedTitle });
      if (fields.length > 0) updateWidget(widget.id, { fields });
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
                Leave empty to show the whole payload.
              </Paragraph>
            </YStack>

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
                      config={{ metric, fields }}
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
