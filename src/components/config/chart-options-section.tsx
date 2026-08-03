import { Button, Label, Paragraph, XStack, YStack } from 'tamagui';

import type { ChartKind } from '@/components/charts/chart-view';
import type { DonutChartOptions } from '@/types/dashboard';
import { DEFAULT_CHART_THICKNESS } from '@/utils/chartGeometry';

/** 0 means "fill the card", which is what the reference app called auto. */
const SIZE_PRESETS = [0, 120, 160, 200, 240, 300];

interface ChartOptionsSectionProps {
  kind: ChartKind;
  options: DonutChartOptions;
  onChange: (options: DonutChartOptions) => void;
  testID: string;
}

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  testID: string;
}

/**
 * A slider is fiddly with a thumb on a phone and hard to drive from a test, so
 * the reference app's sliders become plus/minus steppers.
 */
function Stepper({ label, value, min, max, step, onChange, testID }: StepperProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <XStack items="center" gap="$2">
      <Paragraph size="$2" flex={1}>
        {label}
      </Paragraph>
      <Button
        size="$2"
        disabled={value <= min}
        opacity={value <= min ? 0.4 : 1}
        onPress={() => onChange(clamp(value - step))}
        testID={`${testID}-decrease`}
      >
        −
      </Button>
      <Paragraph size="$2" width={36} text="center" testID={`${testID}-value`}>
        {value}
      </Paragraph>
      <Button
        size="$2"
        disabled={value >= max}
        opacity={value >= max ? 0.4 : 1}
        onPress={() => onChange(clamp(value + step))}
        testID={`${testID}-increase`}
      >
        +
      </Button>
    </XStack>
  );
}

/**
 * Chart appearance: the reference app only offered these for donuts, but its
 * `ChartView` honoured them for pies and bars too, so they are offered wherever
 * they actually do something.
 */
export function ChartOptionsSection({ kind, options, onChange, testID }: ChartOptionsSectionProps) {
  const size = options.size ?? 0;
  const withLabels = options.withLabels ?? true;

  return (
    <YStack gap="$3">
      <YStack gap="$2">
        <Label size="$2">Size</Label>
        <XStack flexWrap="wrap" gap="$2">
          {SIZE_PRESETS.map((preset) => (
            <Button
              key={preset}
              size="$2"
              theme={preset === size ? 'blue' : undefined}
              onPress={() =>
                onChange({ ...options, ...(preset === 0 ? { size: undefined } : { size: preset }) })
              }
              testID={`${testID}-size-${preset}`}
            >
              {preset === 0 ? 'Fill' : String(preset)}
            </Button>
          ))}
        </XStack>
      </YStack>

      {kind === 'donut' && (
        <Stepper
          label="Ring thickness"
          value={options.thickness ?? DEFAULT_CHART_THICKNESS}
          min={1}
          max={60}
          step={4}
          onChange={(thickness) => onChange({ ...options, thickness })}
          testID={`${testID}-thickness`}
        />
      )}

      {kind !== 'bar' && (
        <Stepper
          label="Gap between slices"
          value={options.paddingAngle ?? 0}
          min={0}
          max={30}
          step={2}
          onChange={(paddingAngle) => onChange({ ...options, paddingAngle })}
          testID={`${testID}-padding`}
        />
      )}

      <XStack items="center" gap="$2">
        <Paragraph size="$2" flex={1}>
          {kind === 'bar' ? 'Legend' : 'Segment labels'}
        </Paragraph>
        <Button
          size="$2"
          theme={withLabels ? 'blue' : undefined}
          onPress={() => onChange({ ...options, withLabels: !withLabels })}
          testID={`${testID}-labels`}
        >
          {withLabels ? 'On' : 'Off'}
        </Button>
      </XStack>
    </YStack>
  );
}
