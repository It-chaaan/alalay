import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
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

const webStorage = {
  async getItem(key: string) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      if (__DEV__) {
        console.warn(`[localStorage] getItem failed; the session may not persist.`, error);
      }
      return null;
    }
  },
  async setItem(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      if (__DEV__) {
        console.warn(`[localStorage] setItem failed; the session may not persist.`, error);
      }
    }
  },
  async removeItem(key: string) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      if (__DEV__) {
        console.warn(`[localStorage] removeItem failed; the session may not persist.`, error);
      }
    }
  },
};

// localStorage is accessible to any JavaScript running on the page and is less
// secure than SecureStore's OS-level encrypted storage (for example, it is
// vulnerable to XSS). This is acceptable for Expo web preview/development;
// a production web deployment should use storage appropriate to its own threat model.
const sessionStorage = Platform.OS === 'web' ? webStorage : secureStorage;

let client: SupabaseClient | null = null;

export function getSupabaseClient() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  client ??= createClient(url, anonKey, {
    auth: {
      storage: sessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });

  return client;
}
