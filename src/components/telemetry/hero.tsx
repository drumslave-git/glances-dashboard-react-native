import { Text, XStack, YStack } from 'tamagui';

import { useTelemetry } from '@/theme/use-telemetry';
import {
  gaugeUnitFontSize,
  gaugeValueFontSize,
  heroFontSize,
  statFontSize,
} from '@/utils/typeScale';

import { MicroLabel, MonoText, TABULAR } from './text';

/**
 * The **display channel**: numerals that size off their widget box first, and
 * the user's multiplier second.
 *
 * The handoff kept the user's setting out of this channel; the owner overrode
 * that (2026-08-12) — a font-size setting the hero ignores reads as broken. The
 * box still leads: `typeScale.ts` applies the multiplier after the box clamp
 * and under a width ceiling, and everything that reserves room for a hero
 * (`heroRowHeight`) scales with it, which is what made the original rule
 * necessary. The ring gauge stays box-only: its value must fit the ring.
 */

/**
 * The space between a numeral and its unit, as a fraction of the numeral's size.
 *
 * SI convention, and it reads: a word-like unit (`KB/s`, `MB`) takes a space, a symbol (`%`, `°C`)
 * sits tight against the number. Rendering the unit as its own smaller run is what makes this a
 * decision at all — the joined string `formatRate` returns carries its own space.
 */
function unitGap(unit: string | undefined, size: number): number {
  return unit != null && unit.length > 1 ? Math.round(size * 0.14) : 0;
}

interface HeroValueProps {
  /** Already formatted — this component sizes and lays out, it does not format. */
  value: string;
  /** `%`, `°C`, `KB/s` — rendered as a nested run at ~41% of the hero size. */
  unit?: string;
  /** The measured width of the widget box. */
  widgetWidth: number;
  /** Display-channel override — a pair-fitted size from `ratePairFontSize`. */
  fontSize?: number;
  color?: string;
  testID?: string;
}

export function HeroValue({ value, unit, widgetWidth, fontSize, color, testID }: HeroValueProps) {
  const { t, scale } = useTelemetry();
  const size = fontSize ?? heroFontSize(widgetWidth, scale);
  const unitSize = Math.round(size * (19 / 46));

  return (
    <XStack items="flex-end" gap={unitGap(unit, size)} testID={testID}>
      <Text
        fontFamily="$mono"
        fontWeight="600"
        fontSize={size}
        // line-height .88 and the tight tracking are what make the numeral read
        // as an instrument readout rather than as body copy.
        lineHeight={Math.round(size * 0.88)}
        letterSpacing={size * -0.04}
        numberOfLines={1}
        style={{ ...TABULAR, color: color ?? t.text.primary }}
      >
        {value}
      </Text>
      {unit != null && unit !== '' && (
        <Text
          fontFamily="$mono"
          fontWeight="500"
          fontSize={unitSize}
          lineHeight={Math.round(unitSize * 1.2)}
          color="$textTertiary"
          style={TABULAR}
        >
          {unit}
        </Text>
      )}
    </XStack>
  );
}

interface StatValueProps {
  value: string;
  unit?: string;
  widgetWidth: number;
  /** Display-channel override — a pair-fitted size from `ratePairFontSize`. */
  fontSize?: number;
  color?: string;
  testID?: string;
}

/** The second display size — network throughput, and anything paired with it. */
export function StatValue({ value, unit, widgetWidth, fontSize, color, testID }: StatValueProps) {
  const { t, scale } = useTelemetry();
  const size = fontSize ?? statFontSize(widgetWidth, scale);
  const unitSize = Math.round(Math.min(24, Math.max(9, size * (12 / 26))));

  return (
    <XStack items="flex-end" gap={unitGap(unit, size)} testID={testID}>
      <Text
        fontFamily="$mono"
        fontWeight="600"
        fontSize={size}
        lineHeight={Math.round(size * 0.95)}
        letterSpacing={size * -0.02}
        numberOfLines={1}
        style={{ ...TABULAR, color: color ?? t.text.primary }}
      >
        {value}
      </Text>
      {unit != null && unit !== '' && (
        <Text
          fontFamily="$mono"
          fontWeight="500"
          fontSize={unitSize}
          color="$textTertiary"
          style={TABULAR}
        >
          {unit}
        </Text>
      )}
    </XStack>
  );
}

/**
 * The number in the middle of a ring gauge. Display channel too: it sizes off
 * the ring's diameter, so a gauge squeezed into a small card shrinks its value
 * rather than overflowing the hole.
 */
export function GaugeValue({
  value,
  unit,
  diameter,
  testID,
}: {
  value: string;
  unit?: string;
  diameter: number;
  testID?: string;
}) {
  const size = gaugeValueFontSize(diameter);

  return (
    <XStack items="flex-end" testID={testID}>
      <Text
        fontFamily="$mono"
        fontWeight="600"
        fontSize={size}
        lineHeight={Math.round(size * 1.02)}
        color="$textPrimary"
        numberOfLines={1}
        style={TABULAR}
      >
        {value}
      </Text>
      {unit != null && unit !== '' && (
        <Text
          fontFamily="$mono"
          fontWeight="500"
          fontSize={gaugeUnitFontSize(diameter)}
          color="$textTertiary"
          style={TABULAR}
        >
          {unit}
        </Text>
      )}
    </XStack>
  );
}

export interface StatBlock {
  label: string;
  value: string;
}

/**
 * The micro stat cluster that sits beside a hero — PEAK / AVG / THREADS. Each is
 * a micro-label above a mono value, bottom-aligned to the hero.
 */
export function StatCluster({ stats, testID }: { stats: StatBlock[]; testID?: string }) {
  if (stats.length === 0) return null;

  return (
    <XStack gap={20} items="flex-end" testID={testID}>
      {stats.map((stat) => (
        <YStack key={stat.label} gap={2}>
          <MicroLabel>{stat.label}</MicroLabel>
          <MonoText variant="metric" color="$textStrong">
            {stat.value}
          </MonoText>
        </YStack>
      ))}
    </XStack>
  );
}

/** The same stats as a single footer line, one rung down the ladder. */
export function StatFooterLine({ stats, testID }: { stats: StatBlock[]; testID?: string }) {
  if (stats.length === 0) return null;

  return (
    <MonoText variant="footer" color="$textTertiary" numberOfLines={1} testID={testID}>
      {stats.map((stat) => `${stat.label.toLowerCase()} ${stat.value}`).join('  ·  ')}
    </MonoText>
  );
}
