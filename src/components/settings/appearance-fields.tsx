import { XStack, YStack } from 'tamagui';

import { ToolbarButton } from '@/components/telemetry/surfaces';
import { MicroLabel, MonoText, UiText } from '@/components/telemetry/text';
import {
  cssColor,
  type ColorStop,
  type ThemedColor,
} from '@/theme/appearance';
import { ACCENT_ORDER, accent as accentValues, tokensFor, type ThemeMode } from '@/theme/telemetry';
import { useTelemetry } from '@/theme/use-telemetry';

/**
 * The controls the appearance editor is made of: a themed colour, a size, and a reset.
 *
 * Two rules from the reference (§7.6) shape them:
 *
 * - **Both schemes, side by side.** A colour is `{ light, dark }`, so the editor shows both halves
 *   and marks the one currently on screen. Editing only the scheme you happen to be in is how a
 *   dashboard ends up unreadable the first time someone switches theme.
 * - **The design's own palette and nothing else.** A grid of every hue invites colours belonging to
 *   no part of this design and buries the ten values that are usually the right answer. What is on
 *   offer is the two canvases, the two panels, the rails and the accents — the surfaces the app
 *   already speaks.
 */

/** The swatches on offer, per scheme: this design's surfaces, then its accents. */
export function paletteFor(mode: ThemeMode): string[] {
  const t = tokensFor(mode);
  const surfaces = [t.bg.app, t.bg.widget[1], t.bg.rail, t.bg.track, t.bg.sheet, t.border.hairline];
  const accents = ACCENT_ORDER.map((name) => accentValues(mode, name).stroke);
  // De-duplicated: light mode paints several surfaces the same, and two identical swatches read as
  // a rendering fault rather than as a palette.
  return [...new Set([...surfaces, ...accents])];
}

/** The opacities offered. Steps rather than a slider — this is a look, not a fine adjustment. */
const ALPHAS = [1, 0.9, 0.75, 0.5, 0.25];

export function ResetButton({
  onPress,
  disabled,
  testID,
}: {
  onPress: () => void;
  disabled: boolean;
  testID?: string;
}) {
  return (
    <ToolbarButton
      label="Reset"
      onPress={disabled ? () => undefined : onPress}
      disabled={disabled}
      testID={testID}
    />
  );
}

/**
 * One themed colour: a row of swatches per scheme, then the opacity.
 *
 * Undoing one experiment must not cost the rest of the theme, so the reset sits on the field.
 */
export function ThemedColorField({
  label,
  value,
  onChange,
  onReset,
  isDefault,
  testID,
}: {
  label: string;
  value: ThemedColor;
  onChange: (next: ThemedColor) => void;
  onReset: () => void;
  isDefault: boolean;
  testID: string;
}) {
  const { mode } = useTelemetry();

  const setStop = (scheme: ThemeMode, stop: Partial<ColorStop>) =>
    onChange({ ...value, [scheme]: { ...value[scheme], ...stop } });

  return (
    <YStack gap={7} testID={testID}>
      <XStack items="center" gap={8}>
        <MicroLabel flex={1}>{label}</MicroLabel>
        <ResetButton onPress={onReset} disabled={isDefault} testID={`${testID}-reset`} />
      </XStack>

      {(['dark', 'light'] as const).map((scheme) => (
        <YStack key={scheme} gap={5}>
          <UiText variant="footer" color={scheme === mode ? '$textStrong' : '$textDim'}>
            {scheme === 'dark' ? 'Dark' : 'Light'}
            {scheme === mode ? ' · on screen' : ''}
          </UiText>
          <XStack gap={6} flexWrap="wrap">
            {paletteFor(scheme).map((swatch) => (
              <Swatch
                key={swatch}
                color={swatch}
                selected={value[scheme].color === swatch}
                onPress={() => setStop(scheme, { color: swatch })}
                label={`${label} ${scheme} ${swatch}`}
                testID={`${testID}-${scheme}-${swatch.replace('#', '')}`}
              />
            ))}
          </XStack>
        </YStack>
      ))}

      <XStack gap={6} items="center" flexWrap="wrap">
        <UiText variant="footer" color="$textDim">
          Opacity
        </UiText>
        {ALPHAS.map((alpha) => (
          <ToolbarButton
            key={alpha}
            label={`${Math.round(alpha * 100)}%`}
            // One control for both schemes: an opacity that differs between them is a difference
            // nobody can see two of at once, and the window is either see-through or it is not.
            active={value.dark.alpha === alpha && value.light.alpha === alpha}
            onPress={() =>
              onChange({
                light: { ...value.light, alpha },
                dark: { ...value.dark, alpha },
              })
            }
            testID={`${testID}-alpha-${Math.round(alpha * 100)}`}
          />
        ))}
      </XStack>
    </YStack>
  );
}

function Swatch({
  color,
  selected,
  onPress,
  label,
  testID,
}: {
  color: string;
  selected: boolean;
  onPress: () => void;
  label: string;
  testID: string;
}) {
  const { t } = useTelemetry();
  return (
    <YStack
      width={26}
      height={26}
      rounded={4}
      items="center"
      justify="center"
      borderWidth={1}
      pressStyle={{ opacity: 0.6 }}
      onPress={onPress}
      role="button"
      aria-label={label}
      style={{ borderColor: selected ? t.text.primary : t.border.control }}
      testID={testID}
    >
      {/* A plain view inside the control: a Button would paint over the colour being shown. */}
      <YStack width={16} height={16} rounded={3} style={{ backgroundColor: cssColor({ color, alpha: 1 }) }} />
    </YStack>
  );
}

/**
 * A size in points, offered as steps.
 *
 * Free entry would need a keyboard, a parse and a range check for a value nobody types twice; the
 * steps are the ones the design is legible at.
 */
export function SizeField({
  label,
  value,
  steps,
  onChange,
  onReset,
  isDefault,
  hint,
  testID,
}: {
  label: string;
  value: number;
  steps: number[];
  onChange: (next: number) => void;
  onReset: () => void;
  isDefault: boolean;
  hint?: string;
  testID: string;
}) {
  return (
    <YStack gap={7} testID={testID}>
      <XStack items="center" gap={8}>
        <MicroLabel flex={1}>{label}</MicroLabel>
        <MonoText variant="footer" color="$textDim" testID={`${testID}-value`}>
          {value}
        </MonoText>
        <ResetButton onPress={onReset} disabled={isDefault} testID={`${testID}-reset`} />
      </XStack>
      <XStack gap={8} flexWrap="wrap">
        {steps.map((step) => (
          <ToolbarButton
            key={step}
            label={String(step)}
            active={value === step}
            onPress={() => onChange(step)}
            testID={`${testID}-${step}`}
          />
        ))}
      </XStack>
      {hint != null && (
        <UiText variant="footer" color="$textDim">
          {hint}
        </UiText>
      )}
    </YStack>
  );
}
