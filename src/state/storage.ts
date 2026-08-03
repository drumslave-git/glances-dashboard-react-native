import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/**
 * Single place where persistence keys live. Every persisted store goes through
 * here — nothing else in the app should touch AsyncStorage directly.
 */
export const STORAGE_KEYS = {
  servers: 'glances-dashboard:servers',
  widgets: 'glances-dashboard:widgets',
  preferences: 'glances-dashboard:preferences',
} as const;

export const asyncStorageJSON = () => createJSONStorage(() => AsyncStorage);
