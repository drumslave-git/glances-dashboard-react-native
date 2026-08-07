import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input, Label, Paragraph, ScrollView, Spinner, XStack, YStack } from 'tamagui';

import { ToolbarButton } from '@/components/telemetry/surfaces';
import { Label as SectionLabel } from '@/components/telemetry/text';
import { GEOMETRY } from '@/theme/telemetry';

import { coerceServerUrl } from '@/api/glances';
import { probeEndpoint } from '@/data/probe';
import { DEFAULT_POLL_INTERVAL_MS, useEndpointsStore } from '@/state/endpoints';

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; version: string; pluginCount: number }
  | { status: 'error'; message: string };

export function ServerFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = !id || id === 'new';

  const servers = useEndpointsStore((state) => state.endpoints);
  const addEndpoint = useEndpointsStore((state) => state.addEndpoint);
  const updateEndpoint = useEndpointsStore((state) => state.updateEndpoint);

  const existing = isNew ? undefined : servers.find((server) => server.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [url, setUrl] = useState(existing?.url ?? '');
  const [refreshSeconds, setRefreshSeconds] = useState(
    String((existing?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS) / 1000),
  );
  const [test, setTest] = useState<TestState>({ status: 'idle' });

  const trimmedUrl = url.trim();
  const canSave = trimmedUrl.length > 0;

  const parsedRefreshMs = (() => {
    const seconds = Number.parseFloat(refreshSeconds.replace(',', '.'));
    if (Number.isNaN(seconds) || seconds < 0) return DEFAULT_POLL_INTERVAL_MS;
    return Math.round(seconds * 1000);
  })();

  /**
   * Probe rather than merely fetch.
   *
   * The old test asked for `/system` and reported a hostname, which answers "did something reply"
   * and nothing else. `probeEndpoint` answers the two questions that actually decide whether this
   * address is usable: which Glances version is on the other end — a 3.x server is reported as
   * unsupported instead of failing cryptically — and which plugins it exposes, which is what will
   * decide the widgets this endpoint can offer.
   */
  const handleTest = async () => {
    if (!canSave) return;
    setTest({ status: 'testing' });
    const result = await probeEndpoint(coerceServerUrl(trimmedUrl));
    setTest(
      result.ok
        ? { status: 'ok', version: result.glancesVersion, pluginCount: result.capabilities.length }
        : { status: 'error', message: result.message },
    );
  };

  const handleSave = () => {
    if (!canSave) return;
    if (existing) {
      updateEndpoint(existing.id, { name, url: trimmedUrl, pollIntervalMs: parsedRefreshMs });
    } else {
      addEndpoint({ name, url: trimmedUrl, pollIntervalMs: parsedRefreshMs });
    }
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <YStack flex={1} bg="$appBg" p={GEOMETRY.gridPadding} gap="$3">
        <SectionLabel variant="readout">
          {existing ? 'Edit endpoint' : 'Add endpoint'}
        </SectionLabel>

        <ScrollView flex={1} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <YStack gap="$4">
            <YStack gap="$2">
              <Label htmlFor="server-name">Name</Label>
              <Input
                id="server-name"
                value={name}
                onChangeText={setName}
                placeholder="Home server"
                autoCapitalize="words"
                testID="server-name-input"
              />
            </YStack>

            <YStack gap="$2">
              <Label htmlFor="server-url">Address</Label>
              <Input
                id="server-url"
                value={url}
                onChangeText={(next) => {
                  setUrl(next);
                  setTest({ status: 'idle' });
                }}
                placeholder="192.168.1.10"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                testID="server-url-input"
              />
              <Paragraph size="$1" opacity={0.6}>
                {/* The live resolution, so the rule below is visible rather than described: a bare
                    IP is a direct `glances -w`, a bare hostname is assumed proxied. */}
                {trimmedUrl
                  ? coerceServerUrl(trimmedUrl)
                  : 'An IP gets http:// and port 61208; a hostname gets https:// on the default port.'}
              </Paragraph>
            </YStack>

            <YStack gap="$2">
              <Label htmlFor="server-refresh">Refresh interval (seconds)</Label>
              <Input
                id="server-refresh"
                value={refreshSeconds}
                onChangeText={setRefreshSeconds}
                keyboardType="decimal-pad"
                testID="server-refresh-input"
              />
              <Paragraph size="$1" opacity={0.6}>
                {/* "Fetch once" was retired in M11: pausing is how an endpoint is stopped, and the
                    interval is floored at a second because the server caches its stats for that
                    long anyway. */}
                Floored at 1 second. Pause an endpoint to stop polling it.
              </Paragraph>
            </YStack>

            <YStack gap="$2">
              <XStack>
                <ToolbarButton
                  label={test.status === 'testing' ? 'Testing…' : 'Test connection'}
                  onPress={handleTest}
                  disabled={!canSave || test.status === 'testing'}
                  testID="server-test"
                />
              </XStack>

              {test.status === 'testing' && <Spinner testID="server-test-spinner" />}
              {test.status === 'ok' && (
                <Paragraph size="$2" theme="green" testID="server-test-ok">
                  {`Glances ${test.version}` +
                    (test.pluginCount > 0 ? ` · ${test.pluginCount} plugins` : '')}
                </Paragraph>
              )}
              {test.status === 'error' && (
                <Paragraph size="$2" theme="red" testID="server-test-error">
                  {test.message}
                </Paragraph>
              )}
            </YStack>
          </YStack>
        </ScrollView>

        <XStack gap="$2">
          <YStack flex={1}>
            <ToolbarButton label="Cancel" onPress={() => router.back()} testID="server-cancel" />
          </YStack>
          <YStack flex={1}>
            <ToolbarButton
              label="Save"
              variant="primary"
              onPress={handleSave}
              disabled={!canSave}
              testID="server-save"
            />
          </YStack>
        </XStack>
      </YStack>
    </SafeAreaView>
  );
}
