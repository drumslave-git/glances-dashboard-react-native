/**
 * jest-expo installs React Native's resolver, and react-native-worklets ships its
 * own (`react-native-worklets/jest/resolver.js`) — but Jest only accepts one.
 * This composes them: worklets requests drop the `.native.*` extensions (their
 * native entry points call into JSI bindings that do not exist under Jest), and
 * everything else goes straight to React Native's resolver.
 *
 * @type {import('jest-resolve').SyncResolver}
 */
const reactNativeResolver = require('@react-native/jest-preset/jest/resolver');

const isWorklets = (request, options) =>
  request.includes('react-native-worklets') ||
  String(options.basedir).includes('react-native-worklets');

module.exports = (request, options) => {
  if (!isWorklets(request, options)) return reactNativeResolver(request, options);

  return reactNativeResolver(request, {
    ...options,
    extensions: options.extensions?.filter((extension) => !extension.includes('native')),
  });
};
