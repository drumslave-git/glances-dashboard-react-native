import { useState } from 'react';
import { Button, Label, Paragraph, XStack, YStack } from 'tamagui';

import { FormatterEditor } from '@/components/config/formatter-editor';
import { CHART_PALETTE, getFieldColor } from '@/utils/chartColors';
import { describeFormatter, setFieldFormatter } from '@/utils/formatterSpec';

interface FieldOptionsSectionProps {
  fields: string[];
  fieldColors: Record<string, string>;
  fieldFormatters: Record<string, string>;
  /** Colours only mean something for chart kinds. */
  showColors: boolean;
  /** Reordering rewrites `fields`, which is also the display order. */
  onFieldsChange: (fields: string[]) => void;
  onColorsChange: (fieldColors: Record<string, string>) => void;
  onFormattersChange: (fieldFormatters: Record<string, string>) => void;
  testID: string;
}

/** Move one field up or down, returning a new array. Out-of-range moves are ignored. */
export function moveField(fields: string[], index: number, direction: -1 | 1): string[] {
  const target = index + direction;
  if (index < 0 || index >= fields.length || target < 0 || target >= fields.length) return fields;
  const next = [...fields];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

/**
 * Per-field options for the selected fields: display order, colour (charts only)
 * and formatter. The reference app packed all three into one row of a desktop
 * table; on a phone the row stays compact and expands to the pickers on tap.
 */
export function FieldOptionsSection({
  fields,
  fieldColors,
  fieldFormatters,
  showColors,
  onFieldsChange,
  onColorsChange,
  onFormattersChange,
  testID,
}: FieldOptionsSectionProps) {
  const [openField, setOpenField] = useState<string | null>(null);

  if (fields.length === 0) {
    return (
      <Paragraph size="$2" opacity={0.6} testID={`${testID}-empty`}>
        Pick fields above to set their order{showColors ? ', colours' : ''} and formatters.
      </Paragraph>
    );
  }

  return (
    <YStack gap="$2">
      {fields.map((field, index) => {
        const current = getFieldColor(field, fieldColors);
        const isOpen = openField === field;
        return (
          <YStack key={field} gap="$2">
            <XStack items="center" gap="$1">
              <Button
                size="$2"
                disabled={index === 0}
                opacity={index === 0 ? 0.4 : 1}
                onPress={() => onFieldsChange(moveField(fields, index, -1))}
                testID={`${testID}-${field}-up`}
              >
                ↑
              </Button>
              <Button
                size="$2"
                disabled={index === fields.length - 1}
                opacity={index === fields.length - 1 ? 0.4 : 1}
                onPress={() => onFieldsChange(moveField(fields, index, 1))}
                testID={`${testID}-${field}-down`}
              >
                ↓
              </Button>
              <Button
                size="$3"
                height="auto"
                py="$2"
                flex={1}
                justify="flex-start"
                onPress={() => setOpenField(isOpen ? null : field)}
                testID={`${testID}-${field}`}
              >
                <XStack items="center" gap="$2" flex={1}>
                  {showColors && (
                    // Arbitrary hex, so the colour has to go through `style` —
                    // Tamagui's `bg` only accepts theme tokens.
                    <YStack
                      width={18}
                      height={18}
                      rounded="$2"
                      style={{ backgroundColor: current }}
                    />
                  )}
                  <Paragraph size="$2" flex={1} numberOfLines={1}>
                    {field}
                  </Paragraph>
                  <Paragraph
                    size="$1"
                    opacity={0.6}
                    testID={`${testID}-${field}-formatter-summary`}
                  >
                    {describeFormatter(fieldFormatters[field])}
                  </Paragraph>
                </XStack>
              </Button>
            </XStack>

            {isOpen && (
              <YStack gap="$3" pl="$2" pb="$2">
                {showColors && (
                  <YStack gap="$2">
                    <Label size="$1">Colour</Label>
                    <XStack flexWrap="wrap" gap="$2" testID={`${testID}-${field}-palette`}>
                      {CHART_PALETTE.map((color, colorIndex) => (
                        <Button
                          key={color}
                          size="$3"
                          width={40}
                          p={0}
                          onPress={() => onColorsChange({ ...fieldColors, [field]: color })}
                          testID={`${testID}-${field}-option-${colorIndex}`}
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
                  </YStack>
                )}

                <YStack gap="$2">
                  <Label size="$1">Formatter</Label>
                  <FormatterEditor
                    spec={fieldFormatters[field]}
                    onChange={(spec) =>
                      onFormattersChange(setFieldFormatter(fieldFormatters, field, spec))
                    }
                    testID={`${testID}-${field}-formatter`}
                  />
                </YStack>
              </YStack>
            )}
          </YStack>
        );
      })}
    </YStack>
  );
}
