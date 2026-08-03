/**
 * Jest is used for both pure-logic unit tests and React Native Testing Library
 * component tests. Anything shipping untranspiled ESM must be listed in
 * transformIgnorePatterns below.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup-after-env.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(?:.pnpm/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|react-native-worklets|@shopify/react-native-skia|victory-native|tamagui|@tamagui/.*))',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}'],
};
