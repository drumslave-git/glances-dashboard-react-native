import { useState } from 'react';
import { Button, Paragraph, XStack, YStack } from 'tamagui';

import { CHART_PALETTE, getFieldColor } from '@/utils/chartColors';

interface FieldColorsSectionProps {
  fields: string[];
  fieldColors: Record<string, string>;
  onChange: (fieldColors: Record<string, string>) => void;
  testID: string;
}

/**
 * Per-field colour overrides. The reference app used a Mantine popover with a
 * full colour wheel; on touch a row of palette swatches is both easier to hit
 * and enough — `CHART_PALETTE` is where the deterministic defaults come from too.
 */
export function FieldColorsSection({
  fields,
  fieldColors,
  onChange,
  testID,
}: FieldColorsSectionProps) {
  const [openField, setOpenField] = useState<string | null>(null);

  if (fields.length === 0) {
    return (
      <Paragraph size="$2" opacity={0.6} testID={`${testID}-empty`}>
        Pick fields above to give them colours.
      </Paragraph>
    );
  }

  return (
    <YStack gap="$2">
      {fields.map((field) => {
        const current = getFieldColor(field, fieldColors);
        const isOpen = openField === field;
        return (
          <YStack key={field} gap="$2">
            <Button
              size="$3"
              height="auto"
              py="$2"
              justify="flex-start"
              onPress={() => setOpenField(isOpen ? null : field)}
              testID={`${testID}-${field}`}
            >
              <XStack items="center" gap="$2" flex={1}>
                {/* Arbitrary hex, so the colour has to go through `style` —
                    Tamagui's `bg` only accepts theme tokens. */}
                <YStack width={18} height={18} rounded="$2" style={{ backgroundColor: current }} />
                <Paragraph size="$2" flex={1} numberOfLines={1}>
                  {field}
                </Paragraph>
                <Paragraph size="$1" opacity={0.6}>
                  {current}
                </Paragraph>
              </XStack>
            </Button>

            {isOpen && (
              <XStack flexWrap="wrap" gap="$2" testID={`${testID}-${field}-palette`}>
                {CHART_PALETTE.map((color, index) => (
                  <Button
                    key={color}
                    size="$3"
                    width={40}
                    p={0}
                    onPress={() => {
                      onChange({ ...fieldColors, [field]: color });
                      setOpenField(null);
                    }}
                    testID={`${testID}-${field}-option-${index}`}
                  >
                    <YStack
                      width={22}
                      height={22}
                      rounded="$2"
                      borderWidth={color === current ? 2 : 0}
                      borderColor="$color"
                      style={{ backgroundColor: color }}
                    />
                  </Button>
                ))}
              </XStack>
            )}
          </YStack>
        );
      })}
    </YStack>
  );
}
