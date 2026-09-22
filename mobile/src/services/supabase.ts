import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
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
let appStateSubscription: { remove: () => void } | null = null;
let configurationDiagnosticLogged = false;

function isValidPublicSupabaseUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || (__DEV__ && url.protocol === 'http:')) && Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

function isValidPublicSupabaseKey(value: string | undefined) {
  if (!value || value.length < 20) return false;
  // Supabase supports legacy JWT anon keys and newer publishable keys. Do not
  // log or decode the key in production; service-role credentials are never a
  // valid mobile configuration value.
  if (value.startsWith('sb_publishable_')) return true;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  try {
    const encodedPayload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(
      atob(
        encodedPayload.padEnd(encodedPayload.length + ((4 - (encodedPayload.length % 4)) % 4), '='),
      ),
    );
    return payload.role !== 'service_role';
  } catch {
    return false;
  }
}

export function hasPublicSupabaseConfiguration() {
  return (
    isValidPublicSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL) &&
    isValidPublicSupabaseKey(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function getSupabaseClient() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || !hasPublicSupabaseConfiguration()) {
    if (__DEV__ && !configurationDiagnosticLogged) {
      configurationDiagnosticLogged = true;
      console.warn('[Mobile auth] Public authentication configuration is unavailable or invalid.');
    }
    return null;
  }

  client ??= createClient(url, anonKey, {
    auth: {
      storage: sessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });

  if (Platform.OS !== 'web' && !appStateSubscription) {
    void client.auth.startAutoRefresh();
    appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void client?.auth.startAutoRefresh();
      else void client?.auth.stopAutoRefresh();
    });
  }

  return client;
}
