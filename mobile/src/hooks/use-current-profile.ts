import { useEffect, useState } from 'react';
import { getCachedCurrentProfile, loadCurrentProfile, subscribeToCurrentProfile, type CurrentProfile } from '@/services/profile';

export function useCurrentProfile() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let currentUserId: string | null = null;
    const sync = () => { if (active && currentUserId) setProfile(getCachedCurrentProfile(currentUserId)); };
    const unsubscribe = subscribeToCurrentProfile(sync);
    void loadCurrentProfile().then((value) => { if (active) { currentUserId = value.userId; setProfile(value); setError(null); } }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load your profile.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; unsubscribe(); };
  }, []);

  return { profile, loading, error, retry: () => { setLoading(true); setError(null); return loadCurrentProfile(true).then(setProfile).catch((reason) => { setError(reason instanceof Error ? reason.message : 'Unable to load your profile.'); throw reason; }).finally(() => setLoading(false)); } };
}
