import { useMemo, useState } from 'react';
import { Button, Input, Paragraph, XStack, YStack } from 'tamagui';

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
  const [filter, setFilter] = useState('');
  const selected = Array.isArray(value) ? value : [value];

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.toLowerCase().includes(needle));
  }, [filter, options]);

  if (options.length === 0) {
    return (
      <Paragraph size="$2" opacity={0.6} testID={`${testID}-empty`}>
        {emptyMessage}
      </Paragraph>
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
          testID={`${testID}-filter`}
        />
      )}
      <XStack flexWrap="wrap" gap="$2">
        {visible.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <Button
              key={option}
              size="$2"
              theme={isSelected ? 'blue' : undefined}
              onPress={() => onSelect(option)}
              testID={`${testID}-option-${option}`}
            >
              {multi && isSelected ? `✓ ${option}` : option}
            </Button>
          );
        })}
      </XStack>
      {visible.length === 0 && (
        <Paragraph size="$2" opacity={0.6}>
          Nothing matches “{filter}”.
        </Paragraph>
      )}
    </YStack>
  );
}
