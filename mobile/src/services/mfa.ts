import { authenticatedApiRequest } from './api';
import { clearTrustedDeviceToken, saveTrustedDeviceToken } from './trusted-device';
import { getSupabaseClient } from './supabase';

export type MfaFactor = { id: string; friendlyName?: string | null };

export async function getMfaState() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Authentication is unavailable right now.');
  const [{ data: factors, error: factorError }, { data: assurance, error: assuranceError }] = await Promise.all([
    client.auth.mfa.listFactors(),
    client.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (factorError) throw factorError;
  if (assuranceError) throw assuranceError;
  const factor = factors.totp.find((candidate) => candidate.status === 'verified');
  return {
    factor: factor ? { id: factor.id, friendlyName: factor.friendly_name } : null,
    currentLevel: assurance.currentLevel,
    nextLevel: assurance.nextLevel,
  };
}

export async function isTrustedDevice() {
  try {
    const result = await authenticatedApiRequest<{ trusted: boolean }>('/api/trusted-device');
    return result.trusted;
  } catch {
    return false;
  }
}

export async function rememberTrustedDevice() {
  const result = await authenticatedApiRequest<{ trusted: boolean; token?: string }>('/api/trusted-device', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'mobile' },
    body: JSON.stringify({}),
  });
  if (result.token) await saveTrustedDeviceToken(result.token);
}

export async function clearMobileTrust() {
  await clearTrustedDeviceToken();
}

export async function requiresMfa() {
  const state = await getMfaState();
  if (!state.factor || state.currentLevel === 'aal2' || state.nextLevel !== 'aal2') return { required: false, factor: state.factor };
  if (await isTrustedDevice()) return { required: false, factor: state.factor };
  return { required: true, factor: state.factor };
}
