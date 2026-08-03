import { XStack, YStack } from 'tamagui';

import { ToolbarButton } from '@/components/telemetry/surfaces';
import { Label, MicroLabel, UiText } from '@/components/telemetry/text';
import { usePreferencesStore, type ThemePreference } from '@/state/preferences';
import { useTelemetry } from '@/theme/use-telemetry';
import { READING_SCALE_MAX, READING_SCALE_MIN } from '@/utils/typeScale';

/**
 * The three display preferences the redesign introduces.
 *
 * The font-size control is labelled **"Reading text"** rather than "Font size"
 * on purpose: it only moves the reading channel — labels, chips, table rows,
 * footers, axis ticks. Hero numerals and gauge centre values size off their
 * widget box and are deliberately out of its reach, and a control called "font
 * size" would be promising something it does not do.
 */

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
];

/** Named steps rather than a slider: this is a preference, not a fine adjustment. */
const SCALES: { value: number; label: string }[] = [
  { value: READING_SCALE_MIN, label: 'Small' },
  { value: 1, label: 'Default' },
  { value: 1.2, label: 'Large' },
  { value: READING_SCALE_MAX, label: 'Largest' },
];

export function AppearanceSection() {
  const theme = usePreferencesStore((state) => state.theme);
  const setTheme = usePreferencesStore((state) => state.setTheme);
  const readingScale = usePreferencesStore((state) => state.readingScale);
  const setReadingScale = usePreferencesStore((state) => state.setReadingScale);
  const summaryStripVisible = usePreferencesStore((state) => state.summaryStripVisible);
  const toggleSummaryStrip = usePreferencesStore((state) => state.toggleSummaryStrip);

  return (
    <YStack gap={16} py={4} testID="appearance-section">
      <Label>Appearance</Label>

      <YStack gap={7}>
        <MicroLabel>Theme</MicroLabel>
        <XStack gap={8} flexWrap="wrap">
          {THEMES.map((option) => (
            <ToolbarButton
              key={option.value}
              label={option.label}
              active={theme === option.value}
              onPress={() => setTheme(option.value)}
              testID={`theme-${option.value}`}
            />
          ))}
        </XStack>
      </YStack>

      <YStack gap={7}>
        <MicroLabel>Reading text</MicroLabel>
        <XStack gap={8} flexWrap="wrap">
          {SCALES.map((option) => (
            <ToolbarButton
              key={option.label}
              label={option.label}
              active={Math.abs(readingScale - option.value) < 0.001}
              onPress={() => setReadingScale(option.value)}
              testID={`reading-scale-${option.label.toLowerCase()}`}
            />
          ))}
        </XStack>
        <UiText variant="footer" color="$textDim">
          Labels, table rows and axis ticks only. Hero numbers size off their widget.
        </UiText>
      </YStack>

      <YStack gap={7}>
        <MicroLabel>Summary strip</MicroLabel>
        <XStack gap={8}>
          <ToolbarButton
            label={summaryStripVisible ? 'Shown' : 'Hidden'}
            active={summaryStripVisible}
            onPress={toggleSummaryStrip}
            testID="toggle-summary-strip"
          />
        </XStack>
      </YStack>
    </YStack>
  );
}

/** The three-swatch endpoint colour picker, shown on each server row. */
export function AccentPicker({
  accentIndex,
  onChange,
  testID,
}: {
  accentIndex: number;
  onChange: (accentIndex: number) => void;
  testID?: string;
}) {
  const { t, accentFor } = useTelemetry();

  return (
    <XStack gap={8} items="center" testID={testID}>
      <MicroLabel>Colour</MicroLabel>
      {[0, 1, 2].map((index) => {
        const selected = accentIndex % 3 === index;
        return (
          <YStack
            key={index}
            width={26}
            height={26}
            rounded={4}
            items="center"
            justify="center"
            borderWidth={1}
            pressStyle={{ opacity: 0.6 }}
            onPress={() => onChange(index)}
            role="button"
            aria-label={`Endpoint colour ${index + 1}`}
            style={{
              borderColor: selected ? accentFor(index).stroke : t.border.control,
            }}
            testID={testID ? `${testID}-${index}` : undefined}
          >
            {/* A plain swatch inside the control: a Button would paint over an
                arbitrary hex background. */}
            <YStack
              width={14}
              height={14}
              rounded={3}
              style={{ backgroundColor: accentFor(index).stroke }}
            />
          </YStack>
        );
      })}
    </XStack>
  );
}
