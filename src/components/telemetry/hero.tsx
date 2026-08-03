import { Text, XStack, YStack } from 'tamagui';

import { useTelemetry } from '@/theme/use-telemetry';
import {
  gaugeUnitFontSize,
  gaugeValueFontSize,
  heroFontSize,
  heroUnitFontSize,
  statFontSize,
  statUnitFontSize,
} from '@/utils/typeScale';

import { MicroLabel, MonoText, TABULAR } from './text';

/**
 * The **display channel**: numerals that size off their widget box and ignore
 * the user's font-size setting entirely.
 *
 * This is the single most important rule in the handoff. The reading channel
 * (labels, chips, rows — see `text.tsx`) scales with the user's multiplier; a
 * hero numeral does not, because a 46pt hero multiplied to ~90pt inside a 450pt
 * card is what made the first implementation of this design fall apart. There is
 * deliberately no `scale` parameter anywhere in this file.
 */

interface HeroValueProps {
  /** Already formatted — this component sizes and lays out, it does not format. */
  value: string;
  /** `%`, `°C`, `KB/s` — rendered as a nested run at ~41% of the hero size. */
  unit?: string;
  /** The measured width of the widget box. */
  widgetWidth: number;
  color?: string;
  testID?: string;
}

export function HeroValue({ value, unit, widgetWidth, color, testID }: HeroValueProps) {
  const { t } = useTelemetry();
  const size = heroFontSize(widgetWidth);

  return (
    <XStack items="flex-end" testID={testID}>
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
          fontSize={heroUnitFontSize(widgetWidth)}
          lineHeight={Math.round(heroUnitFontSize(widgetWidth) * 1.2)}
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
  color?: string;
  testID?: string;
}

/** The second display size — network throughput, and anything paired with it. */
export function StatValue({ value, unit, widgetWidth, color, testID }: StatValueProps) {
  const { t } = useTelemetry();
  const size = statFontSize(widgetWidth);

  return (
    <XStack items="flex-end" testID={testID}>
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
          fontSize={statUnitFontSize(widgetWidth)}
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
