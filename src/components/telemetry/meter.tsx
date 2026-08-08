import { LinearGradient } from 'expo-linear-gradient';
import { XStack, YStack } from 'tamagui';

import { GEOMETRY } from '@/theme/telemetry';
import { useTelemetry } from '@/theme/use-telemetry';
import type { MeterRung } from '@/utils/typeScale';

import { MonoText } from './text';

/**
 * A labelled bar — the GPU widget's Utilization / Memory / Fan rows, and what a
 * ring gauge becomes when it drops below the 72pt floor.
 *
 * The fill is a real left-to-right gradient in dark mode (`#5e8a2e → #b6f24a`)
 * and flat in light, which is the handoff's own split: the bright lime is a
 * stroke and fill colour only, never a surface under text.
 */

export interface MeterProps {
  label: string;
  /** 0–100. Values outside that are clamped, not hidden. */
  percent: number;
  /** Right-aligned readout. Defaults to the percentage. */
  value?: string;
  /** Extra detail after the value, e.g. `9.4 / 24 GB`. */
  detail?: string;
  /** Which rung of the degrade ladder to draw. */
  rung?: MeterRung;
  /** Override the fill, e.g. to colour a meter by its endpoint. */
  color?: string;
  testID?: string;
}

function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, percent));
}

export function Meter({
  label,
  percent,
  value,
  detail,
  rung = 'stacked',
  color,
  testID,
}: MeterProps) {
  const { t } = useTelemetry();
  const filled = clampPercent(percent);
  const readout = value ?? `${Math.round(filled)}%`;

  const readoutRow = (
    <XStack items="center" gap={8} shrink={0}>
      {detail != null && (
        <MonoText variant="metric" color="$textTertiary" numberOfLines={1}>
          {detail}
        </MonoText>
      )}
      <MonoText variant="metric" color="$textStrong" testID={testID ? `${testID}-value` : undefined}>
        {readout}
      </MonoText>
    </XStack>
  );

  // `grow` is only for the inline rung, where the track shares a row and takes the leftover
  // width. In the stacked rung the track is a child of a *column*: there `flex: 1` resolves to
  // `flex-basis: 0%` on web, which collapses the track to zero height — the bars simply vanish
  // on web and desktop while native looks fine. Stretch provides the width in a column.
  const track = (grow: boolean) => (
    <YStack
      height={GEOMETRY.meterTrack}
      rounded={GEOMETRY.radius.bar}
      overflow="hidden"
      bg="$trackBg"
      {...(grow ? { flex: 1 } : null)}
      testID={testID ? `${testID}-track` : undefined}
    >
      <YStack width={`${filled}%`} height="100%" rounded={GEOMETRY.radius.bar} overflow="hidden">
        <LinearGradient
          colors={color ? [color, color] : t.meterFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </YStack>
    </YStack>
  );

  // Label + value only: the track is dropped rather than drawn too short to read.
  if (rung === 'value') {
    return (
      <XStack items="center" justify="space-between" gap={10} testID={testID}>
        <MeterLabel label={label} />
        {readoutRow}
      </XStack>
    );
  }

  // One row: label, track, value.
  if (rung === 'inline') {
    return (
      <XStack items="center" gap={10} testID={testID}>
        <MeterLabel label={label} />
        {track(true)}
        {readoutRow}
      </XStack>
    );
  }

  return (
    <YStack gap={5} testID={testID}>
      <XStack items="center" justify="space-between" gap={10}>
        <MeterLabel label={label} />
        {readoutRow}
      </XStack>
      {track(false)}
    </YStack>
  );
}

function MeterLabel({ label }: { label: string }) {
  return (
    <MonoText variant="metric" color="$textSecondary" numberOfLines={1} shrink={1}>
      {label}
    </MonoText>
  );
}
