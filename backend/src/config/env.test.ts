import assert from 'node:assert/strict';
import { parseEnv } from './env.js';

const base = { NODE_ENV: 'development', NOTIFICATION_SCHEDULER_ENABLED: 'false' };
assert.doesNotThrow(() => parseEnv(base));
assert.throws(
  () => parseEnv({ ...base, NOTIFICATION_SCHEDULER_ENABLED: 'true' }),
  /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required/,
);
assert.doesNotThrow(() =>
  parseEnv({
    ...base,
    NOTIFICATION_SCHEDULER_ENABLED: 'true',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  }),
);
console.log('notification scheduler environment tests passed');
