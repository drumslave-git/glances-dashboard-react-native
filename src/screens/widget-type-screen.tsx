import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, H2, Paragraph, ScrollView, SizableText, XStack, YStack } from 'tamagui';

import type { WidgetKind } from '@/types/dashboard';

interface WidgetTypeOption {
  kind: WidgetKind;
  label: string;
  description: string;
  /** Kinds whose renderer lands in a later milestone. */
  availableFrom?: string;
}

const WIDGET_TYPES: WidgetTypeOption[] = [
  {
    kind: 'text',
    label: 'Text metric',
    description: 'Shows one or more fields from a Glances endpoint as plain text.',
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
    availableFrom: 'M4',
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
      <YStack flex={1} p="$4" gap="$3">
        <XStack items="center" gap="$3">
          <H2 flex={1}>Add widget</H2>
          <Button size="$3" onPress={() => router.back()} testID="widget-type-cancel">
            Cancel
          </Button>
        </XStack>

        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
          <YStack gap="$3">
            {WIDGET_TYPES.map((option) => (
              <Button
                key={option.kind}
                height="auto"
                py="$3"
                px="$3"
                justify="flex-start"
                opacity={option.availableFrom ? 0.5 : 1}
                disabled={Boolean(option.availableFrom)}
                onPress={() => choose(option.kind)}
                testID={`widget-type-${option.kind}`}
              >
                <YStack gap="$1" flex={1}>
                  <XStack items="center" gap="$2">
                    <SizableText size="$5" flex={1}>
                      {option.label}
                    </SizableText>
                    {option.availableFrom && (
                      <SizableText size="$1" opacity={0.8}>
                        {option.availableFrom}
                      </SizableText>
                    )}
                  </XStack>
                  <Paragraph size="$2" opacity={0.7}>
                    {option.description}
                  </Paragraph>
                </YStack>
              </Button>
            ))}
          </YStack>
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}
