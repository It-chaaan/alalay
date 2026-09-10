import assert from 'node:assert/strict';

import { createRedirectGuard } from './redirect-guard';

const guard = createRedirectGuard();
assert.equal(guard.shouldRedirect('user-a:false:false:/(tabs)'), true);
assert.equal(guard.shouldRedirect('user-a:false:false:/(tabs)'), false);
assert.equal(guard.shouldRedirect('user-a:false:true:/onboarding'), true);
guard.reset();
assert.equal(guard.shouldRedirect('user-a:false:false:/(tabs)'), true);

console.log('redirect guard tests passed');
