export type SessionGateInput = {
  hasSession: boolean;
  mfaPending: boolean;
  onboardingRequired: boolean;
  inTabs: boolean;
  pathname: string;
};

/** Returns a redirect only when the resolved app state and current route disagree. */
export function sessionGateDestination({
  hasSession,
  mfaPending,
  onboardingRequired,
  inTabs,
  pathname,
}: SessionGateInput): string | null {
  const standaloneAppRoute =
    pathname === '/wallet-details' ||
    pathname === '/notifications' ||
    pathname === '/loans' ||
    pathname === '/auth/callback';

  if (hasSession && mfaPending && pathname !== '/auth') return '/auth?mode=mfa';
  if (hasSession && !mfaPending && onboardingRequired && pathname !== '/onboarding')
    return '/onboarding';
  if (hasSession && !mfaPending && onboardingRequired) return null;
  if (hasSession && !mfaPending && !onboardingRequired && pathname === '/onboarding')
    return '/(tabs)';
  if (hasSession && !mfaPending && !inTabs && !standaloneAppRoute) return '/(tabs)';
  if (!hasSession && inTabs) return '/auth?mode=signin';
  return null;
}
