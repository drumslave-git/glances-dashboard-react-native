import { useState } from 'react';
import { Platform } from 'react-native';
import { Input, Slider, XStack, YStack } from 'tamagui';

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
 * - **The design's palette first, anything after.** The swatches are the surfaces and accents the
 *   app already speaks — usually the right answer — but they are a shortcut, not a fence: the hex
 *   field (and, on web and desktop, the OS colour picker) reaches every colour, which is exactly
 *   how the reference words it: "anything genuinely outside the system is still reachable through
 *   the OS color picker and the hex field".
 *
 * Every control **applies immediately**; the board beside the panel is the preview and the field's
 * Reset is the undo.
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
 * One slider in the Telemetry idiom: hairline track, accent fill, square thumb.
 *
 * Tamagui's `Slider` drives it on every platform; the value readout is the caller's, because it
 * usually belongs on the label row rather than beside the track.
 */
function SettingSlider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  testID,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  label: string;
  testID?: string;
}) {
  return (
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(next) => {
        if (typeof next[0] === 'number' && next[0] !== value) onChange(next[0]);
      }}
      width="100%"
      height={24}
      cursor="pointer"
      aria-label={label}
      testID={testID}
    >
      <Slider.Track bg="$trackBg" height={3} rounded={2}>
        <Slider.TrackActive bg="$accent" rounded={2} />
      </Slider.Track>
      <Slider.Thumb
        index={0}
        size={16}
        circular={false}
        rounded={4}
        bg="$accent"
        borderWidth={1}
        borderColor="$borderColor"
        cursor="pointer"
        aria-label={label}
      />
    </Slider>
  );
}

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

/**
 * A hex field that edits freely and commits only a legal `#rrggbb` — on submit, on blur, or the
 * moment a pasted/typed value parses. An illegal draft is the *typist's* state, not the board's,
 * so it never reaches the store and snaps back on blur.
 */
function HexField({
  value,
  onChange,
  label,
  testID,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  testID?: string;
}) {
  const { size } = useTelemetry();
  const [draft, setDraft] = useState(value);
  // A change arriving from outside (a swatch, the OS picker, a reset) wins over a stale draft.
  // Reconciled during render — React's sanctioned "adjust state when a prop changes" shape —
  // rather than in an effect, which the set-state-in-effect lint rightly refuses.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }

  const commit = (text: string) => {
    const match = HEX_RE.exec(text.trim());
    if (match) onChange(`#${match[1].toLowerCase()}`);
    else setDraft(value);
  };

  return (
    <Input
      value={draft}
      onChangeText={(text) => {
        setDraft(text);
        const match = HEX_RE.exec(text.trim());
        if (match) onChange(`#${match[1].toLowerCase()}`);
      }}
      onBlur={() => commit(draft)}
      onSubmitEditing={() => commit(draft)}
      autoCapitalize="none"
      autoCorrect={false}
      fontFamily="$mono"
      fontSize={size('metric')}
      height={Math.max(30, Math.round(size('metric') * 2.5))}
      width={Math.max(92, Math.round(size('metric') * 7.7))}
      px={8}
      // Android's TextInput carries its own vertical padding, which inside a fixed 30pt height
      // pushes the baseline low enough to clip the glyphs — zero it and let the height centre.
      py={0}
      rounded={4}
      borderWidth={1}
      borderColor="$borderColor"
      bg="$trackBg"
      color="$textStrong"
      aria-label={label}
      testID={testID}
    />
  );
}

/**
 * The OS colour picker, where there is one to offer. On web (and the desktop build, which runs the
 * web bundle) this is a real `<input type="color">` — the RN tree on web renders through react-dom,
 * so a host element is legal here and needs no platform-split file. Native returns nothing: the
 * swatches and the hex field carry the same reach.
 */
function OsColorInput({
  value,
  onChange,
  label,
  testID,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  testID?: string;
}) {
  if (Platform.OS !== 'web') return null;
  return (
    <input
      type="color"
      value={value}
      onChange={(event) => onChange(event.target.value.toLowerCase())}
      aria-label={label}
      data-testid={testID}
      style={{
        width: 30,
        height: 30,
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
      }}
    />
  );
}

/**
 * One themed colour: per scheme a row of swatches, the hex field and the OS picker, then one
 * opacity slider for both schemes.
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

  const alpha = value.dark.alpha;

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
          <XStack gap={6} items="center" flexWrap="wrap">
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
            <HexField
              value={value[scheme].color}
              onChange={(color) => setStop(scheme, { color })}
              label={`${label} ${scheme} hex`}
              testID={`${testID}-${scheme}-hex`}
            />
            <OsColorInput
              value={value[scheme].color}
              onChange={(color) => setStop(scheme, { color })}
              label={`${label} ${scheme} colour picker`}
              testID={`${testID}-${scheme}-picker`}
            />
          </XStack>
        </YStack>
      ))}

      <XStack gap={10} items="center">
        <UiText variant="footer" color="$textDim">
          Opacity
        </UiText>
        <YStack flex={1}>
          <SettingSlider
            // One control for both schemes: an opacity that differs between them is a difference
            // nobody can see two of at once, and the window is either see-through or it is not.
            value={Math.round(alpha * 100)}
            min={10}
            max={100}
            step={5}
            onChange={(percent) =>
              onChange({
                light: { ...value.light, alpha: percent / 100 },
                dark: { ...value.dark, alpha: percent / 100 },
              })
            }
            label={`${label} opacity`}
            testID={`${testID}-alpha`}
          />
        </YStack>
        <MonoText variant="footer" color="$textDim" width={38} text="right" testID={`${testID}-alpha-value`}>
          {`${Math.round(alpha * 100)}%`}
        </MonoText>
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
      cursor="pointer"
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
 * A size in points: a slider over the legal range, with the value printed on the label row.
 *
 * These were fixed steps once; the v0.2.0 review called that what it was — a handful of arbitrary
 * values where a range was meant. The bounds come from the schema, so the slider cannot say
 * anything the store would refuse.
 */
export function SizeField({
  label,
  value,
  min = 0,
  max,
  step = 1,
  onChange,
  onReset,
  isDefault,
  hint,
  testID,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  step?: number;
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
      <SettingSlider
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        label={label}
        testID={`${testID}-slider`}
      />
      {hint != null && (
        <UiText variant="footer" color="$textDim">
          {hint}
        </UiText>
      )}
    </YStack>
  );
}
