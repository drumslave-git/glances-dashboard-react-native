import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, H2, Input, Label, Paragraph, ScrollView, Spinner, XStack, YStack } from 'tamagui';

import { coerceServerUrl, testGlancesConnection } from '@/api/glances';
import { DEFAULT_REFRESH_MS, useServersStore } from '@/state/servers';

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; hostname?: string }
  | { status: 'error'; message: string };

export function ServerFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = !id || id === 'new';

  const servers = useServersStore((state) => state.servers);
  const addServer = useServersStore((state) => state.addServer);
  const updateServer = useServersStore((state) => state.updateServer);

  const existing = isNew ? undefined : servers.find((server) => server.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [url, setUrl] = useState(existing?.url ?? '');
  const [refreshSeconds, setRefreshSeconds] = useState(
    String((existing?.refreshMs ?? DEFAULT_REFRESH_MS) / 1000),
  );
  const [test, setTest] = useState<TestState>({ status: 'idle' });

  const trimmedUrl = url.trim();
  const canSave = trimmedUrl.length > 0;

  const parsedRefreshMs = (() => {
    const seconds = Number.parseFloat(refreshSeconds.replace(',', '.'));
    if (Number.isNaN(seconds) || seconds < 0) return DEFAULT_REFRESH_MS;
    return Math.round(seconds * 1000);
  })();

  const handleTest = async () => {
    if (!canSave) return;
    setTest({ status: 'testing' });
    const result = await testGlancesConnection(coerceServerUrl(trimmedUrl));
    setTest(
      result.ok
        ? { status: 'ok', hostname: result.hostname }
        : { status: 'error', message: result.error },
    );
  };

  const handleSave = () => {
    if (!canSave) return;
    if (existing) {
      updateServer(existing.id, { name, url: trimmedUrl, refreshMs: parsedRefreshMs });
    } else {
      addServer({ name, url: trimmedUrl, refreshMs: parsedRefreshMs });
    }
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <YStack flex={1} p="$4" gap="$3">
        <H2>{existing ? 'Edit server' : 'Add server'}</H2>

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
                {trimmedUrl ? coerceServerUrl(trimmedUrl) : 'http:// and port 61208 are filled in automatically.'}
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
                0 fetches once without polling.
              </Paragraph>
            </YStack>

            <YStack gap="$2">
              <Button
                size="$3"
                onPress={handleTest}
                disabled={!canSave || test.status === 'testing'}
                testID="server-test"
              >
                {test.status === 'testing' ? 'Testing…' : 'Test connection'}
              </Button>

              {test.status === 'testing' && <Spinner testID="server-test-spinner" />}
              {test.status === 'ok' && (
                <Paragraph size="$2" theme="green" testID="server-test-ok">
                  {test.hostname ? `Connected to ${test.hostname}` : 'Connected'}
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
          <Button flex={1} size="$4" onPress={() => router.back()} testID="server-cancel">
            Cancel
          </Button>
          <Button
            flex={1}
            size="$4"
            theme="blue"
            onPress={handleSave}
            disabled={!canSave}
            testID="server-save"
          >
            Save
          </Button>
        </XStack>
      </YStack>
    </SafeAreaView>
  );
}
