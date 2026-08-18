import assert from 'node:assert/strict';
import {
  isValidSecureStoreKey,
  reminderStorageKey,
  SECURE_STORAGE_KEYS,
} from './secure-storage-keys';

for (const key of Object.values(SECURE_STORAGE_KEYS)) assert.match(key, /^[A-Za-z0-9._-]+$/);
assert.equal(isValidSecureStoreKey(''), false);
assert.equal(isValidSecureStoreKey('human readable key'), false);
assert.equal(isValidSecureStoreKey('financial/reminders'), false);
assert.equal(isValidSecureStoreKey('financial:reminders'), false);
assert.equal(
  reminderStorageKey('550e8400-e29b-41d4-a716-446655440000'),
  'alalay.financial-reminders.550e8400-e29b-41d4-a716-446655440000',
);
assert.equal(reminderStorageKey(''), null);
assert.equal(reminderStorageKey('user@example.com'), null);
console.log('secure storage key tests passed');
