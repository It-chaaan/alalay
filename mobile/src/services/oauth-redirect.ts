export type OAuthRuntime = {
  platform: 'ios' | 'android' | 'web';
  executionEnvironment?: string;
  webOrigin?: string;
  createUrl: (path: string, options?: { scheme?: string }) => string;
};

/**
 * Expo Go cannot receive the configured native scheme. Leaving the scheme
 * unset lets Expo generate its current exp://.../-- callback. Standalone and
 * development builds explicitly use the stable Alalay scheme.
 */
export function oauthRedirectUri(runtime: OAuthRuntime) {
  if (runtime.platform === 'web') {
    if (!runtime.webOrigin) throw new Error('A web origin is required for OAuth.');
    return `${runtime.webOrigin.replace(/\/$/, '')}/auth/callback`;
  }
  const createUrl = runtime.createUrl;
  const isExpoGo = runtime.executionEnvironment === 'storeClient';
  return isExpoGo ? createUrl('/auth/callback') : createUrl('/auth/callback', { scheme: 'alalay' });
}
