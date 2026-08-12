import { Input, Text, type InputProps, type TextProps } from 'tamagui';

import { useTelemetry } from '@/theme/use-telemetry';
import type { TypeRole } from '@/utils/typeScale';

/**
 * The reading channel, as components.
 *
 * Everything here takes its size from `useTelemetry().size(variant)` — the user's
 * font-size multiplier with the design's floors applied. Nothing here is ever
 * the right component for a hero numeral or a gauge centre value: those size off
 * their widget box and live in `hero.tsx`.
 *
 * Two rules from the handoff are baked in rather than left to call sites:
 * numerals are always JetBrains Mono with tabular figures, so digits do not
 * jitter as values update; and no component here defaults to a faded colour —
 * hierarchy comes from size, weight, letter-spacing and accent.
 */

interface TelemetryTextProps extends Omit<TextProps, 'fontSize' | 'letterSpacing' | 'fontFamily'> {
  variant?: TypeRole;
}

/** Section and widget labels: uppercase, tracked out, Space Grotesk. */
export function Label({ variant = 'label', ...props }: TelemetryTextProps) {
  const { size, tracking } = useTelemetry();
  return (
    <Text
      fontFamily="$body"
      fontWeight="600"
      fontSize={size(variant)}
      letterSpacing={tracking(variant)}
      textTransform="uppercase"
      color="$textSecondary"
      {...props}
    />
  );
}

/** PEAK · AVG · THREADS · column heads. One rung below `Label`. */
export function MicroLabel({ variant = 'micro', ...props }: TelemetryTextProps) {
  const { size, tracking } = useTelemetry();
  return (
    <Text
      fontFamily="$body"
      fontWeight="600"
      fontSize={size(variant)}
      letterSpacing={tracking(variant)}
      textTransform="uppercase"
      color="$textDim"
      {...props}
    />
  );
}

/**
 * Every metric value, PID, command, timestamp and axis label. Tabular figures
 * are the point: a proportional digit set makes a live number twitch sideways
 * on every poll.
 */
export function MonoText({ variant = 'metric', ...props }: TelemetryTextProps) {
  const { size, tracking } = useTelemetry();
  return (
    <Text
      fontFamily="$mono"
      fontWeight="500"
      fontSize={size(variant)}
      letterSpacing={tracking(variant)}
      color="$textStrong"
      style={TABULAR}
      {...props}
    />
  );
}

/** Non-numeric prose at reading-channel size — the few places the design has any. */
export function UiText({ variant = 'metric', ...props }: TelemetryTextProps) {
  const { size, tracking } = useTelemetry();
  return (
    <Text
      fontFamily="$body"
      fontWeight="400"
      fontSize={size(variant)}
      letterSpacing={tracking(variant)}
      color="$textSecondary"
      {...props}
    />
  );
}

/**
 * A text input on the reading channel. Tamagui's `Input` sizes off the static
 * font tokens, which is exactly how form fields ended up ignoring the user's
 * font-size setting — every input goes through this instead.
 */
export function TextField({ variant = 'readout', ...props }: Omit<InputProps, 'fontSize'> & { variant?: TypeRole }) {
  const { size } = useTelemetry();
  const fontSize = size(variant);
  return (
    <Input
      fontFamily="$body"
      fontSize={fontSize}
      height={Math.max(40, Math.round(fontSize * 2.6))}
      {...props}
    />
  );
}

export const TABULAR = { fontVariant: ['tabular-nums' as const] };
