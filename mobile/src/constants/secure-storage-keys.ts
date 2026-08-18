export const SECURE_STORAGE_KEYS = {
  appearancePreference: 'alalay-appearance-preference',
  balanceVisibility: 'alalay-balance-visibility',
  reminderPermissionRequested: 'alalay.financial-reminders.permission-requested',
  trustedDeviceToken: 'alalay-trusted-device-token',
} as const;

export type SecureStorageKey = (typeof SECURE_STORAGE_KEYS)[keyof typeof SECURE_STORAGE_KEYS];

const SECURE_STORE_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;

export function isValidSecureStoreKey(key: string): boolean {
  return key.length > 0 && SECURE_STORE_KEY_PATTERN.test(key);
}

export function reminderStorageKey(userId: string): string | null {
  if (!isValidSecureStoreKey(userId)) return null;
  return `alalay.financial-reminders.${userId}`;
}
