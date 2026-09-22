import assert from 'node:assert/strict';
import { oauthRedirectUri } from './oauth-redirect';

const fake = (path: string, options?: { scheme?: string }) =>
  options?.scheme
    ? `${options.scheme}://${path.replace(/^\//, '')}`
    : `exp://192.0.2.10:8081/--/${path.replace(/^\//, '')}`;
assert.equal(
  oauthRedirectUri({ platform: 'ios', executionEnvironment: 'storeClient', createUrl: fake }),
  'exp://192.0.2.10:8081/--/auth/callback',
);
assert.equal(
  oauthRedirectUri({ platform: 'android', executionEnvironment: 'storeClient', createUrl: fake }),
  'exp://192.0.2.10:8081/--/auth/callback',
);
assert.equal(
  oauthRedirectUri({ platform: 'ios', executionEnvironment: 'standalone', createUrl: fake }),
  'alalay://auth/callback',
);
assert.equal(
  oauthRedirectUri({ platform: 'android', executionEnvironment: 'standalone', createUrl: fake }),
  'alalay://auth/callback',
);
assert.equal(
  oauthRedirectUri({
    platform: 'web',
    webOrigin: 'https://alalay-orpin.vercel.app',
    createUrl: (_path, _options) => 'https://alalay-orpin.vercel.app/auth/callback',
  }),
  'https://alalay-orpin.vercel.app/auth/callback',
);
console.log('OAuth redirect tests passed');
