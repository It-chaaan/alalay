import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function warnSecureStoreFailure(operation: string, error: unknown) {
  // TODO: persistent failures mean auth sessions are not being saved. Keep
  // this warning until the running native build includes the matching module.
  if (__DEV__) {
    console.warn(`[SecureStore] ${operation} failed; the session may not persist.`, error);
  }
}

const secureStorage = {
  async getItem(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      // Treat an unreadable store as signed out instead of crashing Supabase's
      // automatic session restore during app startup.
      warnSecureStoreFailure('getItem', error);
      return null;
    }
  },
  async setItem(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      // Do not block sign-in when persistence is unavailable (for example in
      // an Expo Go binary with an older native SecureStore module).
      warnSecureStoreFailure('setItem', error);
    }
  },
  async removeItem(key: string) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      warnSecureStoreFailure('removeItem', error);
    }
  },
};

let client: SupabaseClient | null = null;

export function getSupabaseClient() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  client ??= createClient(url, anonKey, {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });

  return client;
}
