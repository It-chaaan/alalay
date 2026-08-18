import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { SECURE_STORAGE_KEYS } from '@/constants/secure-storage-keys';

const STORAGE_KEY = SECURE_STORAGE_KEYS.trustedDeviceToken;

export async function getTrustedDeviceToken() {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }
  try { return await SecureStore.getItemAsync(STORAGE_KEY); } catch { return null; }
}

export async function saveTrustedDeviceToken(token: string) {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(STORAGE_KEY, token); } catch { /* best effort in web preview */ }
    return;
  }
  try { await SecureStore.setItemAsync(STORAGE_KEY, token); } catch { /* session remains server-authoritative */ }
}

export async function clearTrustedDeviceToken() {
  if (Platform.OS === 'web') {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* best effort in web preview */ }
    return;
  }
  try { await SecureStore.deleteItemAsync(STORAGE_KEY); } catch { /* best effort */ }
}
