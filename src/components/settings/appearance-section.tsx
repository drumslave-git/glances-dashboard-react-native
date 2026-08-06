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
 * **The dashboard behind this screen is the preview.** Every control writes the *draft*, which
 * `useAppearance` prefers over the stored value, so the board repaints as the control moves. There
 * is no preview surface to keep in step with the real thing, and Cancel is a matter of dropping the
 * draft rather than undoing a series of writes.
 *
 * Each setting carries its own reset, disabled while it is already at the default. Undoing one
 * experiment must not cost the rest of the theme.
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
  const summaryStripVisible = usePreferencesStore((state) => state.summaryStripVisible);
  const toggleSummaryStrip = usePreferencesStore((state) => state.toggleSummaryStrip);

  const appearance = useAppearance();
  const draft = usePreferencesStore((state) => state.appearanceDraft);
  const setDraft = usePreferencesStore((state) => state.setAppearanceDraft);
  const resetKey = usePreferencesStore((state) => state.resetAppearanceKey);
  const resetAll = usePreferencesStore((state) => state.resetAppearance);
  const commit = usePreferencesStore((state) => state.commitAppearance);
  const cancel = usePreferencesStore((state) => state.cancelAppearance);

  const isDefault = <K extends keyof Appearance>(key: K) =>
    isDefaultAppearanceKey(appearance, key as never);

  return (
    <YStack gap={18} py={4} testID="appearance-section">
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
              onPress={() => setDraft('interfaceScale', option.value)}
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
        onChange={(next) => setDraft('gridBackground', next)}
        onReset={() => resetKey('gridBackground')}
        isDefault={isDefault('gridBackground')}
        testID="appearance-gridBackground"
      />

      <ThemedColorField
        label="Widget background"
        value={appearance.widgetBackground}
        onChange={(next) => setDraft('widgetBackground', next)}
        onReset={() => resetKey('widgetBackground')}
        isDefault={isDefault('widgetBackground')}
        testID="appearance-widgetBackground"
      />

      <SizeField
        label="Grid spacing"
        value={appearance.gridGap}
        steps={[0, 4, 8, 11, 16, 24]}
        onChange={(next) => setDraft('gridGap', next)}
        onReset={() => resetKey('gridGap')}
        isDefault={isDefault('gridGap')}
        hint="One value for the gap between widgets and the space around the board."
        testID="appearance-gridGap"
      />

      <SizeField
        label="Widget padding"
        value={appearance.widgetPadding}
        steps={[6, 11, 17, 22, 28]}
        onChange={(next) => setDraft('widgetPadding', next)}
        onReset={() => resetKey('widgetPadding')}
        isDefault={isDefault('widgetPadding')}
        testID="appearance-widgetPadding"
      />

      <SizeField
        label="Corner radius"
        value={appearance.widgetRadius}
        steps={[0, 3, 6, 10, 16]}
        onChange={(next) => setDraft('widgetRadius', next)}
        onReset={() => resetKey('widgetRadius')}
        isDefault={isDefault('widgetRadius')}
        testID="appearance-widgetRadius"
      />

      <SizeField
        label="Widget border"
        value={appearance.widgetBorder.width}
        steps={[0, 1, 2, 3]}
        onChange={(next) => setDraft('widgetBorder', { ...appearance.widgetBorder, width: next })}
        onReset={() => resetKey('widgetBorder')}
        isDefault={isDefault('widgetBorder')}
        hint="Zero removes the outline; the background is then what separates a widget from the board."
        testID="appearance-widgetBorder"
      />

      <ThemedColorField
        label="Border colour"
        value={appearance.widgetBorder.color}
        onChange={(next) => setDraft('widgetBorder', { ...appearance.widgetBorder, color: next })}
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
            onPress={() => setDraft('hideWidgetHeaders', !appearance.hideWidgetHeaders)}
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
        <YStack flex={1} />
        {draft != null && (
          <>
            <ToolbarButton label="Cancel" onPress={cancel} testID="appearance-cancel" />
            <ToolbarButton
              label="Save"
              variant="primary"
              onPress={commit}
              testID="appearance-save"
            />
          </>
        )}
      </XStack>
      {draft != null && (
        <UiText variant="footer" color="$textDim" testID="appearance-draft-notice">
          Previewing on the dashboard behind this screen. Cancel puts it back.
        </UiText>
      )}
      {/* Only there while the defaults still hold, because that is the one state the sentence
          above cannot describe. */}
      {draft == null && !isDefaultAppearance(appearance) && (
        <UiText variant="footer" color="$textDim" testID="appearance-saved-notice">
          Saved.
        </UiText>
      )}
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

/** Re-exported so the widget config screen can offer the same swatches for one widget. */
export { DEFAULT_APPEARANCE };
