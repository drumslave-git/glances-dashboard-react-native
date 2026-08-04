import { Text, XStack, YStack } from 'tamagui';

import { GEOMETRY, type AccentName } from '@/theme/telemetry';
import { useTelemetry } from '@/theme/use-telemetry';
import type { EndpointState } from '@/types/glances';
import { endpointStateLabel, endpointTone } from '@/utils/endpointStatus';

/**
 * Endpoint provenance, and the small state chips beside a widget label.
 *
 * Because the toolbar auto-hides, **the widget itself has to say which machine
 * its numbers came from** — that is the whole job of the endpoint chip, and why
 * it is the one element in the header that never truncates. When the header runs
 * out of room it degrades to a bare colour dot rather than disappearing.
 */

interface EndpointChipProps {
  name: string;
  /** The endpoint's chosen accent, or `null` for none — then the chip shows its state colour. */
  color?: AccentName | null;
  /** Connection state. Absent is treated as `online`, for previews with no live endpoint behind them. */
  state?: EndpointState;
  /** `dot` is the compact rung of the header ladder. */
  variant?: 'chip' | 'dot';
  testID?: string;
}

/**
 * The colour resolution both variants share.
 *
 * `endpointTone` decides *which* palette applies (accent when healthy, signal otherwise); this
 * turns that into the actual chip skin. A signal-coloured chip is drawn as the colour over a
 * transparent fill rather than getting its own tinted background — the design has chip fills for
 * the three accents only, and inventing four more would be five new surfaces to hold to the
 * contrast floor for no gain.
 */
function useEndpointSkin(state: EndpointState, color: AccentName | null) {
  const { t, accent } = useTelemetry();
  const tone = endpointTone(state, color);
  if (tone.kind === 'accent') {
    const skin = accent(tone.name);
    return { dot: skin.stroke, text: skin.chip.text, border: skin.chip.border, bg: skin.chip.bg };
  }
  const colour = t.signal[tone.role];
  return { dot: colour, text: colour, border: t.border.chip, bg: 'transparent' };
}

export function EndpointChip({
  name,
  color = null,
  state = 'online',
  variant = 'chip',
  testID,
}: EndpointChipProps) {
  const { size } = useTelemetry();
  const skin = useEndpointSkin(state, color);

  if (variant === 'dot') {
    return (
      <YStack
        width={6}
        height={6}
        rounded={GEOMETRY.radius.pill}
        // Arbitrary hex: Tamagui's `bg` takes theme tokens only.
        style={{ backgroundColor: skin.dot }}
        // The dot is the *only* provenance left at this size, so it keeps the
        // accessible name the chip would have had — and the state with it, which is
        // otherwise carried by a colour a screen reader cannot see.
        aria-label={`Endpoint ${name}, ${endpointStateLabel(state).toLowerCase()}`}
        testID={testID}
      />
    );
  }

  return (
    <XStack
      items="center"
      gap={5}
      px={7}
      py={2}
      rounded={GEOMETRY.radius.chip}
      borderWidth={1}
      // `flex: none` in the handoff — it never shrinks and never truncates.
      shrink={0}
      style={{ backgroundColor: skin.bg, borderColor: skin.border }}
      aria-label={`Endpoint ${name}, ${endpointStateLabel(state).toLowerCase()}`}
      testID={testID}
    >
      <YStack
        width={4}
        height={4}
        rounded={GEOMETRY.radius.pill}
        style={{ backgroundColor: skin.dot }}
      />
      <Text
        fontFamily="$mono"
        fontWeight="500"
        fontSize={size('chip')}
        letterSpacing={size('chip') * 0.1}
        textTransform="uppercase"
        numberOfLines={1}
        style={{ color: skin.text }}
      >
        {name}
      </Text>
    </XStack>
  );
}

interface StateChipProps {
  label: string;
  /** Accent-tinted state chips (the sort chip, the time window) name their hue. */
  accent?: AccentName;
  onPress?: () => void;
  testID?: string;
}

/**
 * A widget's state, shown beside its label: the time window `15m`, the process
 * sort `CPU ↓`. Plain chips are outlined in `border.chip`; accent-tinted ones
 * take their accent's colour and border.
 */
export function StateChip({ label, accent, onPress, testID }: StateChipProps) {
  const { t, size, accent: accentValues } = useTelemetry();
  const skin = accent ? accentValues(accent) : null;

  return (
    <XStack
      items="center"
      px={5}
      py={1}
      rounded={GEOMETRY.radius.chip}
      borderWidth={1}
      shrink={0}
      pressStyle={onPress ? { opacity: 0.65 } : undefined}
      onPress={onPress}
      style={{
        borderColor: skin ? skin.chip.border : t.border.chip,
        backgroundColor: skin ? skin.chip.bg : 'transparent',
      }}
      {...(onPress ? { role: 'button' as const, 'aria-label': label } : {})}
      testID={testID}
    >
      <Text
        fontFamily="$mono"
        fontWeight="500"
        fontSize={size('chip')}
        letterSpacing={size('chip') * 0.1}
        textTransform="uppercase"
        style={{ color: skin ? skin.chip.text : t.text.faint }}
      >
        {label}
      </Text>
    </XStack>
  );
}

/**
 * The 2×11 accent tick that opens every widget header.
 *
 * It carries the **endpoint** colour, not the metric family's — so a screen of
 * widgets reads as grouped by machine at a glance. The handoff offers
 * metric-coded ticks as an alternative and asks for one choice applied
 * consistently; this is that choice.
 */
export function AccentTick({
  color = null,
  state = 'online',
  testID,
}: {
  color?: AccentName | null;
  state?: EndpointState;
  testID?: string;
}) {
  const skin = useEndpointSkin(state, color);
  return (
    <YStack
      width={2}
      height={11}
      rounded={1}
      // The tick follows the chip, so a failing endpoint's widgets are marked as failing down
      // their whole left edge rather than only in the chip a squeezed header may have dropped.
      style={{ backgroundColor: skin.dot }}
      testID={testID}
    />
  );
}
