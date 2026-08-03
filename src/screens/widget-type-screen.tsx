import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, XStack, YStack } from 'tamagui';

import { ToolbarButton } from '@/components/telemetry/surfaces';
import { Label, UiText } from '@/components/telemetry/text';
import { GEOMETRY } from '@/theme/telemetry';

import type { WidgetKind } from '@/types/dashboard';

interface WidgetTypeOption {
  kind: WidgetKind;
  label: string;
  description: string;
}

const WIDGET_TYPES: WidgetTypeOption[] = [
  {
    kind: 'text',
    label: 'Summary',
    description:
      'Fields as labelled rows, with a meter for anything that reads as a percentage and a hero numeral when there is only one number.',
  },
  {
    kind: 'line',
    label: 'Time series',
    description:
      'A live line chart over sampled history, with peak and average. History is kept in memory and resets when the app restarts.',
  },
  {
    kind: 'gauge',
    label: 'Ring gauge',
    description: 'One percentage as a ring, with the remaining fields listed underneath.',
  },
  {
    kind: 'donut',
    label: 'Donut chart',
    description: 'Numeric fields as a donut, with an optional centre label.',
  },
  {
    kind: 'pie',
    label: 'Pie chart',
    description: 'Numeric fields as a pie chart.',
  },
  {
    kind: 'bar',
    label: 'Bar chart',
    description: 'Numeric fields side by side as bars.',
  },
  {
    kind: 'processes',
    label: 'Processes table',
    description: 'The process list, as a scrollable table.',
  },
];

export function WidgetTypeScreen() {
  const router = useRouter();

  const choose = (kind: WidgetKind) => {
    // The config screen creates the widget; "new" tells it there is nothing to load.
    router.replace({ pathname: '/widget/[id]', params: { id: 'new', kind } });
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <YStack flex={1} bg="$appBg" p={GEOMETRY.gridPadding} gap="$3">
        <XStack items="center" gap="$3">
          <Label flex={1} variant="readout">
            Add widget
          </Label>
          <ToolbarButton label="Cancel" onPress={() => router.back()} testID="widget-type-cancel" />
        </XStack>

        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
          <YStack gap="$3">
            {WIDGET_TYPES.map((option) => (
              <YStack
                key={option.kind}
                gap={5}
                p={14}
                rounded={GEOMETRY.radius.widget}
                borderWidth={1}
                borderColor="$borderColor"
                bg="$widgetBg"
                pressStyle={{ borderColor: '$borderRaised' }}
                onPress={() => choose(option.kind)}
                role="button"
                aria-label={option.label}
                testID={`widget-type-${option.kind}`}
              >
                <Label variant="metric">{option.label}</Label>
                <UiText variant="footer" color="$textDim">
                  {option.description}
                </UiText>
              </YStack>
            ))}
          </YStack>
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}
