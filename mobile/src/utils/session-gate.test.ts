import assert from 'node:assert/strict';

import { sessionGateDestination } from './session-gate';

assert.equal(sessionGateDestination({ hasSession: true, mfaPending: false, onboardingRequired: false, inTabs: true, pathname: '/' }), null);
assert.equal(sessionGateDestination({ hasSession: true, mfaPending: false, onboardingRequired: true, inTabs: true, pathname: '/' }), '/onboarding');
assert.equal(sessionGateDestination({ hasSession: true, mfaPending: false, onboardingRequired: true, inTabs: false, pathname: '/onboarding' }), null);
assert.equal(sessionGateDestination({ hasSession: true, mfaPending: true, onboardingRequired: false, inTabs: false, pathname: '/onboarding' }), '/auth?mode=mfa');
assert.equal(sessionGateDestination({ hasSession: false, mfaPending: false, onboardingRequired: false, inTabs: true, pathname: '/' }), '/auth?mode=signin');

console.log('session gate tests passed');
