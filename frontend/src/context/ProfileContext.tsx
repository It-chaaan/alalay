import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Profile } from "../hooks/types";
import { apiRequest } from "../lib/apiClient";
import { getSupabaseClient } from "../lib/supabase";

type ProfileContextValue = {
  profile: Profile | null;
  isLoading: boolean;
  updateProfile: (patch: Partial<Profile> | Profile) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      const nextProfile = await apiRequest<Profile>("/users/me");
      setProfile(nextProfile);
    } catch {
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    const supabase = getSupabaseClient();
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange(() => void loadProfile());
    return () => data.subscription.unsubscribe();
  }, [loadProfile]);

  const value = useMemo(() => ({
    profile,
    isLoading,
    updateProfile: (patch: Partial<Profile> | Profile) => setProfile((current) => {
      if (current) return { ...current, ...patch };
      return typeof patch.id === "string" ? patch as Profile : current;
    }),
  }), [isLoading, profile]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used inside ProfileProvider");
  return context;
}
