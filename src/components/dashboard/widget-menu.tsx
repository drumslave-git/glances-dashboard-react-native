import { Modal, Pressable } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { Label, MonoText } from '@/components/telemetry/text';
import { GEOMETRY } from '@/theme/telemetry';
import { useTelemetry } from '@/theme/use-telemetry';

/**
 * The ⋮ menu. In the desktop design this is a small popover; on touch it is a
 * bottom sheet, which is where a thumb already is and which does not need to be
 * anchored to a 34pt glyph.
 *
 * It exists because the redesign removes the row of always-visible edit buttons
 * from the widget header. The header now carries only identity — tick, label,
 * endpoint chip, state chips — and everything that *acts* on the widget lives
 * here, which is what makes a dense board of widgets readable.
 *
 * Built on React Native's own `Modal` rather than a sheet library: it is one
 * screen, it needs no animation config, and it behaves identically on Android,
 * web and the Tauri window.
 */

export interface WidgetMenuItem {
  key: string;
  label: string;
  /** Right-aligned current value, e.g. the size preset or the time window. */
  value?: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface WidgetMenuProps {
  open: boolean;
  title: string;
  items: WidgetMenuItem[];
  onClose: () => void;
  testID?: string;
}

export function WidgetMenu({ open, title, items, onClose, testID }: WidgetMenuProps) {
  const { t, accent } = useTelemetry();

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}
        onPress={onClose}
        aria-label="Close menu"
        testID={testID ? `${testID}-backdrop` : undefined}
      >
        {/* A press inside the card must not reach the backdrop above. */}
        <Pressable onPress={() => undefined}>
          <YStack
            bg="$sheetBg"
            borderTopWidth={1}
            borderColor="$borderColor"
            style={{
              borderTopLeftRadius: GEOMETRY.radius.window,
              borderTopRightRadius: GEOMETRY.radius.window,
            }}
            pb={24}
            testID={testID}
          >
            <YStack px={17} py={14} borderBottomWidth={1} borderColor="$hairline">
              <Label numberOfLines={1}>{title}</Label>
            </YStack>

            {items.map((item) => (
              <XStack
                key={item.key}
                items="center"
                justify="space-between"
                gap={12}
                px={17}
                py={14}
                borderBottomWidth={1}
                borderColor="$rowBorder"
                opacity={item.disabled ? 0.4 : 1}
                cursor={item.disabled ? 'default' : 'pointer'}
                pressStyle={{ bg: '$trackBg' }}
                onPress={
                  item.disabled
                    ? undefined
                    : () => {
                        // Close first: leaving the sheet up while the dashboard
                        // navigates away strands it over the next screen.
                        onClose();
                        item.onPress();
                      }
                }
                role="button"
                aria-label={item.label}
                disabled={item.disabled}
                testID={testID ? `${testID}-${item.key}` : undefined}
              >
                <Text
                  fontFamily="$body"
                  fontWeight="500"
                  fontSize={14}
                  style={{ color: item.destructive ? accent('amber').text : t.text.primary }}
                >
                  {item.label}
                </Text>
                {item.value != null && (
                  <MonoText variant="metric" color="$textDim">
                    {item.value}
                  </MonoText>
                )}
              </XStack>
            ))}
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
