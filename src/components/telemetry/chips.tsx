import { Text, XStack, YStack } from 'tamagui';

import { GEOMETRY, type AccentName } from '@/theme/telemetry';
import { useTelemetry } from '@/theme/use-telemetry';

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
  /** The server's persisted accent index. */
  accentIndex: number;
  /** `dot` is the compact rung of the header ladder. */
  variant?: 'chip' | 'dot';
  testID?: string;
}

export function EndpointChip({ name, accentIndex, variant = 'chip', testID }: EndpointChipProps) {
  const { size, accentFor } = useTelemetry();
  const skin = accentFor(accentIndex);

  if (variant === 'dot') {
    return (
      <YStack
        width={6}
        height={6}
        rounded={GEOMETRY.radius.pill}
        // Arbitrary hex: Tamagui's `bg` takes theme tokens only.
        style={{ backgroundColor: skin.stroke }}
        // The dot is the *only* provenance left at this size, so it keeps the
        // accessible name the chip would have had.
        aria-label={`Endpoint ${name}`}
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
      style={{ backgroundColor: skin.chip.bg, borderColor: skin.chip.border }}
      testID={testID}
    >
      <YStack
        width={4}
        height={4}
        rounded={GEOMETRY.radius.pill}
        style={{ backgroundColor: skin.stroke }}
      />
      <Text
        fontFamily="$mono"
        fontWeight="500"
        fontSize={size('chip')}
        letterSpacing={size('chip') * 0.1}
        textTransform="uppercase"
        numberOfLines={1}
        style={{ color: skin.chip.text }}
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
export function AccentTick({ accentIndex, testID }: { accentIndex: number; testID?: string }) {
  const { accentFor } = useTelemetry();
  return (
    <YStack
      width={2}
      height={11}
      rounded={1}
      style={{ backgroundColor: accentFor(accentIndex).stroke }}
      testID={testID}
    />
  );
}
