import { XStack, YStack } from 'tamagui';

import { ToolbarButton } from '@/components/telemetry/surfaces';
import { Label, MicroLabel, UiText } from '@/components/telemetry/text';
import { usePreferencesStore, type ThemePreference } from '@/state/preferences';
import {
  DEFAULT_APPEARANCE,
  isDefaultAppearance,
  isDefaultAppearanceKey,
  type Appearance,
} from '@/theme/appearance';
import { ACCENT_ORDER, type AccentName } from '@/theme/telemetry';
import { useAppearance, useTelemetry } from '@/theme/use-telemetry';
import { READING_SCALE_MAX, READING_SCALE_MIN } from '@/utils/typeScale';

import { SizeField, ThemedColorField } from './appearance-fields';

/**
 * The appearance tab: everything about the board the user owns (ref §7.6).
 *
 * **Every control applies — and saves — the moment it changes**, the same as the theme buttons
 * always did. The dashboard beside this panel repaints live, so it is the preview; undo is the
 * per-field Reset, and "Reset everything" is the way back to a fresh install. There is no Save and
 * no Cancel, because a panel where half the controls commit on press and the other half wait for a
 * button at the bottom of the scroll teaches the user not to trust any of it.
 */

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
];

/** Named steps rather than a slider: text has four legible sizes, not a continuum worth walking. */
const SCALES: { value: number; label: string }[] = [
  { value: READING_SCALE_MIN, label: 'Small' },
  { value: 1, label: 'Default' },
  { value: 1.2, label: 'Large' },
  { value: READING_SCALE_MAX, label: 'Largest' },
];

export function AppearanceSection() {
  const theme = usePreferencesStore((state) => state.theme);
  const setTheme = usePreferencesStore((state) => state.setTheme);
  const summaryStripVisible = usePreferencesStore((state) => state.summaryStripVisible);
  const toggleSummaryStrip = usePreferencesStore((state) => state.toggleSummaryStrip);

  const appearance = useAppearance();
  const setAppearance = usePreferencesStore((state) => state.setAppearance);
  const resetKey = usePreferencesStore((state) => state.resetAppearanceKey);
  const resetAll = usePreferencesStore((state) => state.resetAppearance);

  const isDefault = <K extends keyof Appearance>(key: K) =>
    isDefaultAppearanceKey(appearance, key as never);

  return (
    <YStack gap={18} py={4} testID="appearance-section">
      <YStack gap={4}>
        <Label>Appearance</Label>
        <UiText variant="footer" color="$textDim">
          Changes apply to the board as you make them. Reset puts one setting back.
        </UiText>
      </YStack>

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
        <UiText variant="footer" color="$textDim">
          Colours below are stored for both schemes, so switching theme keeps a board readable.
        </UiText>
      </YStack>

      <YStack gap={7}>
        <XStack items="center" gap={8}>
          <MicroLabel flex={1}>Reading text</MicroLabel>
          <ToolbarButton
            label="Reset"
            disabled={isDefault('interfaceScale')}
            onPress={() => resetKey('interfaceScale')}
            testID="appearance-interfaceScale-reset"
          />
        </XStack>
        <XStack gap={8} flexWrap="wrap">
          {SCALES.map((option) => (
            <ToolbarButton
              key={option.label}
              label={option.label}
              active={Math.abs(appearance.interfaceScale - option.value) < 0.001}
              onPress={() => setAppearance('interfaceScale', option.value)}
              testID={`reading-scale-${option.label.toLowerCase()}`}
            />
          ))}
        </XStack>
        <UiText variant="footer" color="$textDim">
          Labels, table rows and axis ticks only. Hero numbers size off their widget.
        </UiText>
      </YStack>

      <ThemedColorField
        label="Grid background"
        value={appearance.gridBackground}
        onChange={(next) => setAppearance('gridBackground', next)}
        onReset={() => resetKey('gridBackground')}
        isDefault={isDefault('gridBackground')}
        testID="appearance-gridBackground"
      />

      <ThemedColorField
        label="Widget background"
        value={appearance.widgetBackground}
        onChange={(next) => setAppearance('widgetBackground', next)}
        onReset={() => resetKey('widgetBackground')}
        isDefault={isDefault('widgetBackground')}
        testID="appearance-widgetBackground"
      />

      <SizeField
        label="Grid spacing"
        value={appearance.gridGap}
        max={40}
        onChange={(next) => setAppearance('gridGap', next)}
        onReset={() => resetKey('gridGap')}
        isDefault={isDefault('gridGap')}
        hint="One value for the gap between widgets and the space around the board."
        testID="appearance-gridGap"
      />

      <SizeField
        label="Widget padding"
        value={appearance.widgetPadding}
        max={40}
        onChange={(next) => setAppearance('widgetPadding', next)}
        onReset={() => resetKey('widgetPadding')}
        isDefault={isDefault('widgetPadding')}
        testID="appearance-widgetPadding"
      />

      <SizeField
        label="Corner radius"
        value={appearance.widgetRadius}
        max={24}
        onChange={(next) => setAppearance('widgetRadius', next)}
        onReset={() => resetKey('widgetRadius')}
        isDefault={isDefault('widgetRadius')}
        testID="appearance-widgetRadius"
      />

      <SizeField
        label="Widget border"
        value={appearance.widgetBorder.width}
        max={6}
        onChange={(next) => setAppearance('widgetBorder', { ...appearance.widgetBorder, width: next })}
        onReset={() => resetKey('widgetBorder')}
        isDefault={isDefault('widgetBorder')}
        hint="Zero removes the outline; the background is then what separates a widget from the board."
        testID="appearance-widgetBorder"
      />

      <ThemedColorField
        label="Border colour"
        value={appearance.widgetBorder.color}
        onChange={(next) => setAppearance('widgetBorder', { ...appearance.widgetBorder, color: next })}
        onReset={() => resetKey('widgetBorder')}
        isDefault={isDefault('widgetBorder')}
        testID="appearance-borderColor"
      />

      <YStack gap={7}>
        <MicroLabel>Widget headers</MicroLabel>
        <XStack gap={8}>
          <ToolbarButton
            label={appearance.hideWidgetHeaders ? 'Hidden' : 'Shown'}
            active={!appearance.hideWidgetHeaders}
            onPress={() => setAppearance('hideWidgetHeaders', !appearance.hideWidgetHeaders)}
            testID="toggle-widget-headers"
          />
        </XStack>
        <UiText variant="footer" color="$textDim">
          Hidden leaves a corner mark on each widget: press it, or hover the widget, to bring the
          header back. Edit mode always shows them.
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

      <XStack gap={8} flexWrap="wrap" items="center">
        <ToolbarButton
          label="Reset everything"
          disabled={isDefaultAppearance(appearance)}
          onPress={resetAll}
          testID="appearance-reset-all"
        />
      </XStack>
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
            cursor="pointer"
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

/** Re-exported so the widget config screen can offer the same swatches for one widget. */
export { DEFAULT_APPEARANCE };
