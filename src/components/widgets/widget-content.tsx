import { Platform } from 'react-native';
import { Paragraph, ScrollView, Text } from 'tamagui';

import type { WidgetKind } from '@/types/dashboard';
import { getTextBody } from '@/utils/widgetData';

export interface WidgetContentConfig {
  metric: string;
  fields?: string[];
  fieldColors?: Record<string, string>;
  fieldFormatters?: Record<string, string>;
  chartLabel?: string;
  splitPercentageIntoUsedFree?: boolean;
}

export interface WidgetContentProps {
  kind: WidgetKind;
  data: unknown;
  config: WidgetContentConfig;
  /** No server is configured for this widget at all. */
  noServer?: boolean;
  loading?: boolean;
  error?: string | null;
  testID?: string;
}

/**
 * Which message replaces the body, if any. Ported from the reference app so the
 * precedence (no server → loading → error → no data) stays identical.
 */
export function getStatusMessage({
  noServer,
  loading,
  error,
  data,
}: {
  noServer?: boolean;
  loading?: boolean;
  error?: string | null;
  data: unknown;
}): string | null {
  if (noServer) return 'Pick a server for this widget.';
  if (loading && data == null) return 'Loading…';
  if (error) return `Error: ${error}`;
  if (data == null) return 'No data yet.';
  return null;
}

/** Chart and process widgets land in M3/M4; until then they say so plainly. */
const NOT_YET_IMPLEMENTED: Partial<Record<WidgetKind, string>> = {
  donut: 'Donut charts arrive in milestone M3.',
  pie: 'Pie charts arrive in milestone M3.',
  bar: 'Bar charts arrive in milestone M3.',
  processes: 'The process table arrives in milestone M4.',
};

export function WidgetContent({
  kind,
  data,
  config,
  noServer = false,
  loading = false,
  error = null,
  testID,
}: WidgetContentProps) {
  const statusMessage = getStatusMessage({ noServer, loading, error, data });
  const fields = config.fields && config.fields.length > 0 ? config.fields : [];

  if (statusMessage) {
    return (
      <Paragraph size="$2" opacity={0.6} testID={testID ? `${testID}-status` : undefined}>
        {statusMessage}
      </Paragraph>
    );
  }

  const pending = NOT_YET_IMPLEMENTED[kind];
  if (pending) {
    return (
      <Paragraph size="$2" opacity={0.6} testID={testID ? `${testID}-pending` : undefined}>
        {pending}
      </Paragraph>
    );
  }

  return (
    <ScrollView flex={1} showsVerticalScrollIndicator={false}>
      <Text
        // The Tamagui config ships only body and heading fonts, but `key = value`
        // dumps need a monospace face to line up, so this one comes from the platform.
        style={{ fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }}
        fontSize={12}
        lineHeight={18}
        testID={testID ? `${testID}-body` : undefined}
      >
        {getTextBody(data, fields, config.fieldFormatters)}
      </Text>
    </ScrollView>
  );
}
