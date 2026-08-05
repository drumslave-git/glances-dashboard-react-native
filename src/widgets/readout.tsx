/**
 * The shared vocabulary of the text and bars renderings.
 *
 * Every metric with a graphical rendering also has a **text** one (ref §8), and they are all the
 * same shape: labelled rows of current readings, optionally grouped. Six widgets share this, so the
 * degrade behaviour — how many rows fit, what a missing reading looks like — is decided once.
 */
import { Fragment } from 'react';
import { XStack, YStack } from 'tamagui';

import { Meter } from '@/components/telemetry/meter';
import { MicroLabel, MonoText, UiText } from '@/components/telemetry/text';
import { useTelemetry } from '@/theme/use-telemetry';
import { meterRung, type SizeMode } from '@/utils/typeScale';

export interface ReadoutRow {
  label: string;
  /** `null` renders as "—". A metric a host does not report is not a metric reading zero. */
  value: string | null;
  /** Optional right-hand qualifier, e.g. a unit or a total. */
  hint?: string;
  /** Colour override for the value, e.g. from a threshold. */
  color?: string;
}

export interface ReadoutGroup {
  label?: string;
  rows: ReadoutRow[];
}

/** The em dash a missing reading gets, so "not reported" never reads as a number. */
export const NO_VALUE = '—';

/**
 * How many rows fit the measured height.
 *
 * Rows leave from the bottom rather than being squeezed: a half-height row is unreadable and looks
 * like a rendering fault, where a shorter list plainly says there was no room (ref §7.4).
 */
export function rowsThatFit(height: number, rowHeight: number, headings = 0): number {
  const usable = height - headings * (rowHeight * 0.8);
  return Math.max(0, Math.floor(usable / rowHeight));
}

const ROW_HEIGHT = 20;

export function TextReadout({
  groups,
  mode,
  height,
  testID,
}: {
  groups: ReadoutGroup[];
  mode: SizeMode;
  height: number;
  testID?: string;
}) {
  const { t } = useTelemetry();
  const headings = groups.filter((group) => group.label).length;
  const budget = rowsThatFit(height, ROW_HEIGHT, headings);

  let remaining = budget;
  const visible: ReadoutGroup[] = [];
  for (const group of groups) {
    if (remaining <= 0) break;
    const rows = group.rows.slice(0, remaining);
    remaining -= rows.length;
    if (rows.length > 0) visible.push({ ...group, rows });
  }

  return (
    <YStack flex={1} minH={0} testID={testID}>
      {visible.map((group, index) => (
        <Fragment key={group.label ?? index}>
          {group.label && (
            <MicroLabel mt={index === 0 ? 0 : 8} mb={2}>
              {group.label}
            </MicroLabel>
          )}
          {group.rows.map((row) => (
            <XStack
              key={row.label}
              items="center"
              height={ROW_HEIGHT}
              gap={8}
              borderBottomWidth={1}
              borderColor="$rowBorder"
            >
              <UiText variant="row" color="$textSecondary" numberOfLines={1} shrink={1} minW={0}>
                {row.label}
              </UiText>
              <YStack flex={1} />
              {row.hint && mode.tier !== 'compact' && (
                <MonoText variant="footer" color="$textDim" numberOfLines={1}>
                  {row.hint}
                </MonoText>
              )}
              <MonoText
                variant="row"
                numberOfLines={1}
                shrink={1}
                // Capped so a long value — an OS string, a CPU model — cannot squeeze the label
                // it belongs to down to "Sys…". Both may truncate; neither may vanish.
                maxW="62%"
                style={row.color ? { color: row.color } : { color: t.text.strong }}
              >
                {row.value ?? NO_VALUE}
              </MonoText>
            </XStack>
          ))}
        </Fragment>
      ))}
    </YStack>
  );
}

export interface MeterRow {
  label: string;
  /** 0–100. `null` renders an empty track rather than a full one. */
  percent: number | null;
  value?: string;
  color?: string;
}

/**
 * The bars rendering: one `Meter` per reading.
 *
 * The ladder is M8's `meterRung` — stacked → inline → value-only — which is the same shape as the
 * reference's meter family and is already tested. This adds only the two things a *widget* knows
 * and a meter does not: how many rows there is room for, and that `short` skips straight to the
 * value-only rung, because a 3 px track in a two-row panel is decoration rather than information.
 */
export function MeterList({
  rows,
  mode,
  height,
  accentColor,
  testID,
}: {
  rows: MeterRow[];
  mode: SizeMode;
  height: number;
  accentColor: string;
  testID?: string;
}) {
  const rung = mode.short ? 'value' : meterRung(rows.length, height);
  const perRow = rung === 'stacked' ? 30 : rung === 'inline' ? 18 : ROW_HEIGHT;
  // At least one: a panel too short for any row should show the first rather than nothing, which
  // would be indistinguishable from a widget that failed to load.
  const visible = rows.slice(0, Math.max(1, rowsThatFit(height, perRow)));

  return (
    <YStack flex={1} minH={0} gap={rung === 'stacked' ? 4 : 2} testID={testID}>
      {visible.map((row) => (
        <Meter
          key={row.label}
          label={row.label}
          percent={row.percent ?? 0}
          {...(row.value !== undefined
            ? { value: row.value }
            : row.percent == null
              ? { value: NO_VALUE }
              : {})}
          rung={rung}
          color={row.color ?? accentColor}
        />
      ))}
    </YStack>
  );
}
