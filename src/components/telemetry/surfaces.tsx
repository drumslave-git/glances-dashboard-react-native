import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Text, XStack, YStack, type YStackProps } from 'tamagui';

import { GEOMETRY } from '@/theme/telemetry';
import { useTelemetry } from '@/theme/use-telemetry';

/**
 * Surfaces, the logo mark, and the two button shapes the toolbar uses.
 *
 * The design specifies the toolbar and widget surfaces as two-stop gradients.
 * React Native has no CSS gradient, so they are drawn with an absolutely
 * positioned `LinearGradient` behind the content rather than approximated with a
 * flat mid-tone — the stops are close enough that flattening them would be
 * invisible in dark mode and wrong in principle, and `expo-linear-gradient` runs
 * in Expo Go, so it costs nothing in native surface.
 */

interface GradientSurfaceProps extends YStackProps {
  colors: readonly [string, string];
  children?: ReactNode;
}

export function GradientSurface({ colors, children, ...props }: GradientSurfaceProps) {
  return (
    // `position` and `zIndex` come after the spread because both are load-bearing
    // on web, where this component behaves nothing like it does on native:
    //
    //  - Tamagui leaves a `YStack` `position: static`, so without `relative` the
    //    absolutely-filled gradient escapes to the nearest positioned ancestor and
    //    covers the whole window.
    //  - CSS paints positioned boxes after in-flow ones, so even once contained the
    //    gradient would sit on top of `children` rather than behind them. `zIndex: 0`
    //    makes this box a stacking context and `-1` puts the gradient at its back —
    //    the containment matters, or the gradient would fall behind an ancestor's
    //    background instead.
    //
    // On native both are inert: every view is already a containing block and the
    // gradient is behind the children by tree order.
    <YStack overflow="hidden" {...props} position="relative" style={{ zIndex: 0 }}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { zIndex: -1 }]}
        pointerEvents="none"
      />
      {children}
    </YStack>
  );
}

/**
 * A rounded square with a 45°-rotated square punched into it. Pure views, no
 * image asset — and in dark mode the one shadow this design allows anywhere.
 */
export function LogoMark({ size = 25, testID }: { size?: number; testID?: string }) {
  const { t, mode, accent } = useTelemetry();
  const lime = accent('lime');

  return (
    <YStack
      width={size}
      height={size}
      rounded={6}
      items="center"
      justify="center"
      style={{
        backgroundColor: lime.fill,
        ...(mode === 'dark'
          ? {
              shadowColor: lime.stroke,
              shadowOpacity: 0.28,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 0 },
            }
          : null),
      }}
      testID={testID}
    >
      <YStack
        width={size * 0.32}
        height={size * 0.32}
        rotate="45deg"
        style={{ backgroundColor: mode === 'dark' ? t.bg.app : t.bg.widget[0] }}
      />
    </YStack>
  );
}

/** `GLANCES TELEMETRY`, the two-weight wordmark beside the logo. */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  const { size } = useTelemetry();
  return (
    <XStack items="baseline" gap={6}>
      <Text
        fontFamily="$body"
        fontWeight="700"
        // Rides the reading scale like its sibling, or the two halves of the wordmark diverge.
        fontSize={Math.max(13, size('readout'))}
        letterSpacing={2.6}
        color="$textPrimary"
      >
        GLANCES
      </Text>
      {!compact && (
        <Text
          fontFamily="$body"
          fontWeight="400"
          fontSize={Math.max(9, size('label'))}
          letterSpacing={2.1}
          color="$textDim"
        >
          TELEMETRY
        </Text>
      )}
    </XStack>
  );
}

interface ToolbarButtonProps {
  label: string;
  onPress: () => void;
  /** Filled lime for the primary action, outlined for everything else. */
  variant?: 'primary' | 'outline';
  /** Rendered before the label at the same size. */
  glyph?: string;
  active?: boolean;
  disabled?: boolean;
  testID?: string;
}

/**
 * 10pt/600/.14em uppercase, `6×11` padding, radius 4. The primary action is a
 * lime fill with `text.onAccent`; everything else is a 1px `border.control`
 * outline with `text.secondary`.
 */
export function ToolbarButton({
  label,
  onPress,
  variant = 'outline',
  glyph,
  active = false,
  disabled = false,
  testID,
}: ToolbarButtonProps) {
  const { t, size, tracking, accent } = useTelemetry();
  const lime = accent('lime');
  const primary = variant === 'primary';

  return (
    <XStack
      items="center"
      justify="center"
      gap={5}
      px={11}
      // A 6pt vertical pad hits the design's 56pt toolbar but leaves a ~26pt
      // target. Touch needs more, so the minimum height is bumped on every
      // platform rather than branching — the toolbar has room for it.
      py={6}
      minH={34}
      rounded={GEOMETRY.radius.control}
      borderWidth={1}
      opacity={disabled ? 0.45 : 1}
      pressStyle={{ opacity: 0.65 }}
      // Web only; ignored on native. Every pressable in this app declares its cursor, because
      // Tamagui does not infer one from `onPress` and a button under a text caret reads as inert.
      cursor={disabled ? 'default' : 'pointer'}
      onPress={disabled ? undefined : onPress}
      role="button"
      aria-label={label}
      disabled={disabled}
      style={{
        backgroundColor: primary ? lime.fill : active ? lime.chip.bg : 'transparent',
        borderColor: primary ? lime.fill : active ? lime.chip.border : t.border.control,
      }}
      testID={testID}
    >
      {glyph != null && (
        <Text
          fontFamily="$body"
          fontSize={size('label')}
          style={{ color: primary ? t.text.onAccent : active ? lime.chip.text : t.text.secondary }}
        >
          {glyph}
        </Text>
      )}
      <Text
        fontFamily="$body"
        fontWeight="600"
        fontSize={size('label')}
        letterSpacing={tracking('label') * 0.78}
        textTransform="uppercase"
        numberOfLines={1}
        style={{ color: primary ? t.text.onAccent : active ? lime.chip.text : t.text.secondary }}
      >
        {label}
      </Text>
    </XStack>
  );
}

/** A square icon-only control — the toolbar's gear, and the widget's ⋮. */
export function GlyphButton({
  glyph,
  label,
  onPress,
  size: box = 34,
  color,
  testID,
}: {
  glyph: string;
  label: string;
  onPress: () => void;
  size?: number;
  color?: string;
  testID?: string;
}) {
  const { t, size } = useTelemetry();

  return (
    <YStack
      width={box}
      height={box}
      items="center"
      justify="center"
      rounded={GEOMETRY.radius.control}
      pressStyle={{ opacity: 0.6 }}
      cursor="pointer"
      onPress={onPress}
      role="button"
      aria-label={label}
      testID={testID}
    >
      <Text
        fontFamily="$body"
        fontSize={Math.max(13, size('readout'))}
        style={{ color: color ?? t.text.faint }}
      >
        {glyph}
      </Text>
    </YStack>
  );
}
