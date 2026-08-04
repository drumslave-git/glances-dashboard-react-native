import { XStack, YStack } from 'tamagui';

import { ToolbarButton } from '@/components/telemetry/surfaces';
import { Label, MicroLabel, UiText } from '@/components/telemetry/text';
import { usePreferencesStore, type ThemePreference } from '@/state/preferences';
import { ACCENT_ORDER, type AccentName } from '@/theme/telemetry';
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

/**
 * The endpoint colour picker, shown on each endpoint row.
 *
 * Offers the design's own accents and **nothing else** — an endpoint marked in a colour the
 * dashboard does not already speak stops being legible against one of the two schemes, and a grid
 * of arbitrary hues would turn a wall of panels into confetti. The reference restricts its picker
 * for the same reason (ref §7.6).
 *
 * The first swatch is "none", which is also the default. Clearing the accent *is* its reset: with
 * no colour the chip shows connection state instead, which is the more useful thing for someone
 * running a single host.
 */
export function AccentPicker({
  color,
  onChange,
  testID,
}: {
  color: AccentName | null;
  onChange: (color: AccentName | null) => void;
  testID?: string;
}) {
  const { t, accentFor } = useTelemetry();
  const options: (AccentName | null)[] = [null, ...ACCENT_ORDER];

  return (
    <XStack gap={8} items="center" testID={testID}>
      <MicroLabel>Colour</MicroLabel>
      {options.map((option) => {
        const selected = color === option;
        const swatch = option ? accentFor(option).stroke : null;
        return (
          <YStack
            key={option ?? 'none'}
            width={26}
            height={26}
            rounded={4}
            items="center"
            justify="center"
            borderWidth={1}
            pressStyle={{ opacity: 0.6 }}
            onPress={() => onChange(option)}
            role="button"
            aria-label={option ? `Endpoint colour ${option}` : 'No endpoint colour'}
            style={{ borderColor: selected ? (swatch ?? t.text.secondary) : t.border.control }}
            testID={testID ? `${testID}-${option ?? 'none'}` : undefined}
          >
            {/* A plain swatch inside the control: a Button would paint over an
                arbitrary hex background. */}
            {swatch ? (
              <YStack width={14} height={14} rounded={3} style={{ backgroundColor: swatch }} />
            ) : (
              // "None" is drawn as an empty outline rather than a coloured chip, so the absence
              // reads as a deliberate option and not as a swatch that failed to load.
              <YStack
                width={14}
                height={14}
                rounded={3}
                borderWidth={1}
                style={{ borderColor: t.text.faint }}
              />
            )}
          </YStack>
        );
      })}
    </XStack>
  );
}
