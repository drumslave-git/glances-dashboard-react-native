import { Button, Paragraph, XStack, YStack } from 'tamagui';

import {
  buildFormatterSpec,
  FORMATTER_OPTIONS,
  MAX_DECIMALS,
  parseFormatterSpec,
  TRUNCATE_POSITIONS,
  type FormatterKind,
  type ParsedFormatter,
} from '@/utils/formatterSpec';

interface FormatterEditorProps {
  /** The field's current formatter spec, e.g. "round(2)". */
  spec: string | undefined;
  /** Called with the new spec, or null to clear the field's formatter. */
  onChange: (spec: string | null) => void;
  testID: string;
}

interface NumberStepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  testID: string;
}

function NumberStepper({ label, value, min, max, onChange, testID }: NumberStepperProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <XStack items="center" gap="$2">
      <Paragraph size="$1" flex={1}>
        {label}
      </Paragraph>
      <Button
        size="$2"
        disabled={value <= min}
        opacity={value <= min ? 0.4 : 1}
        onPress={() => onChange(clamp(value - 1))}
        testID={`${testID}-decrease`}
      >
        −
      </Button>
      <Paragraph size="$2" width={28} text="center" testID={`${testID}-value`}>
        {value}
      </Paragraph>
      <Button
        size="$2"
        disabled={value >= max}
        opacity={value >= max ? 0.4 : 1}
        onPress={() => onChange(clamp(value + 1))}
        testID={`${testID}-increase`}
      >
        +
      </Button>
    </XStack>
  );
}

/**
 * Picks one field's formatter. The reference app used a select plus number
 * inputs; the same choices become chips and steppers here, and the spec string
 * is assembled by `buildFormatterSpec` so the stored value stays exactly what
 * `formatFieldValue` expects.
 */
export function FormatterEditor({ spec, onChange, testID }: FormatterEditorProps) {
  const parsed = parseFormatterSpec(spec);

  const emit = (next: Partial<ParsedFormatter>) => {
    onChange(buildFormatterSpec({ ...parsed, ...next }));
  };

  return (
    <YStack gap="$2" testID={testID}>
      <XStack flexWrap="wrap" gap="$2">
        {FORMATTER_OPTIONS.map((option) => (
          <Button
            key={option.kind}
            size="$2"
            theme={option.kind === parsed.kind ? 'blue' : undefined}
            onPress={() => emit({ kind: option.kind as FormatterKind })}
            testID={`${testID}-kind-${option.kind}`}
          >
            {option.label}
          </Button>
        ))}
      </XStack>

      {parsed.kind === 'round' && (
        <NumberStepper
          label="Decimals"
          value={parsed.decimals}
          min={0}
          max={MAX_DECIMALS}
          onChange={(decimals) => emit({ decimals })}
          testID={`${testID}-decimals`}
        />
      )}

      {parsed.kind === 'truncate' && (
        <YStack gap="$2">
          <NumberStepper
            label="Max length"
            value={parsed.length}
            min={1}
            max={80}
            onChange={(length) => emit({ length })}
            testID={`${testID}-length`}
          />
          <XStack items="center" gap="$2">
            <Paragraph size="$1" flex={1}>
              Cut from
            </Paragraph>
            {TRUNCATE_POSITIONS.map((position) => (
              <Button
                key={position}
                size="$2"
                theme={position === parsed.position ? 'blue' : undefined}
                onPress={() => emit({ position })}
                testID={`${testID}-position-${position}`}
              >
                {position}
              </Button>
            ))}
          </XStack>
        </YStack>
      )}
    </YStack>
  );
}
