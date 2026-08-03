// AsyncStorage is a native module; its maintained in-memory mock lets the
// persisted Zustand stores be exercised for real in tests.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
