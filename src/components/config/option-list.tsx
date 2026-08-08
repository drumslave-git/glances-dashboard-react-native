import { useMemo, useState } from 'react';
import { Input, Text, XStack, YStack } from 'tamagui';

import { UiText } from '@/components/telemetry/text';
import { GEOMETRY } from '@/theme/telemetry';
import { useTelemetry } from '@/theme/use-telemetry';

interface OptionListProps {
  options: string[];
  /** Selected value(s). A string for single select, an array for multi. */
  value: string | string[];
  onSelect: (option: string) => void;
  multi?: boolean;
  /** Show a filter box once the list is long enough to need one. */
  filterThreshold?: number;
  emptyMessage: string;
  testID: string;
}

/**
 * Touch-friendly stand-in for a native select: a wrapped set of toggle chips
 * with an optional filter. Works for both the metric picker (single) and the
 * field picker (multi).
 */
export function OptionList({
  options,
  value,
  onSelect,
  multi = false,
  filterThreshold = 12,
  emptyMessage,
  testID,
}: OptionListProps) {
  const { t, size, accent } = useTelemetry();
  const lime = accent('lime');
  const [filter, setFilter] = useState('');
  const selected = Array.isArray(value) ? value : [value];

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.toLowerCase().includes(needle));
  }, [filter, options]);

  if (options.length === 0) {
    return (
      <UiText variant="metric" color="$textDim" testID={`${testID}-empty`}>
        {emptyMessage}
      </UiText>
    );
  }

  return (
    <YStack gap="$2">
      {options.length >= filterThreshold && (
        <Input
          value={filter}
          onChangeText={setFilter}
          placeholder="Filter…"
          autoCapitalize="none"
          autoCorrect={false}
          size="$3"
          bg="$widgetBg"
          borderColor="$controlBorder"
          color="$textPrimary"
          testID={`${testID}-filter`}
        />
      )}
      <XStack flexWrap="wrap" gap={7}>
        {visible.map((option) => {
          const isSelected = selected.includes(option);
          return (
            // Chip-shaped rather than a stock Button: these are the same
            // outlined-then-accent-tinted control as the widget state chips, and
            // a Button would paint its own background over the tint.
            <XStack
              key={option}
              items="center"
              px={9}
              py={6}
              minH={32}
              rounded={GEOMETRY.radius.control}
              borderWidth={1}
              cursor="pointer"
              pressStyle={{ opacity: 0.65 }}
              onPress={() => onSelect(option)}
              role="button"
              aria-label={option}
              style={{
                backgroundColor: isSelected ? lime.chip.bg : 'transparent',
                borderColor: isSelected ? lime.chip.border : t.border.control,
              }}
              testID={`${testID}-option-${option}`}
            >
              <Text
                fontFamily="$mono"
                fontSize={size('metric')}
                style={{ color: isSelected ? lime.chip.text : t.text.secondary }}
              >
                {multi && isSelected ? `✓ ${option}` : option}
              </Text>
            </XStack>
          );
        })}
      </XStack>
      {visible.length === 0 && (
        <UiText variant="metric" color="$textDim">
          Nothing matches “{filter}”.
        </UiText>
      )}
    </YStack>
  );
}
