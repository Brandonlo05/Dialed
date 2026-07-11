/**
 * Thin JSON persistence wrapper over AsyncStorage.
 * All failures degrade to null / no-op — storage problems must never
 * crash a focus session.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export async function loadJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Non-fatal — the session continues with in-memory state.
  }
}
