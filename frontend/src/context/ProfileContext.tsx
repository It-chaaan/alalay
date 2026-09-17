import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Profile } from "../hooks/types";
import { apiRequest } from "../lib/apiClient";
import { getSupabaseClient } from "../lib/supabase";
import { getProfileAvatarUrl } from "../lib/profileAvatar";

type ProfileContextValue = {
  profile: Profile | null;
  isLoading: boolean;
  updateProfile: (patch: Partial<Profile> | Profile) => void;
  refreshProfile: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hydrateProfile = useCallback(async (value: Profile) => ({
    ...value,
    avatar_url: value.avatar_path
      ? await getProfileAvatarUrl(value.avatar_path, value.avatar_updated_at)
      : value.avatar_url,
  }), []);

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
      setProfile(await hydrateProfile(nextProfile));
    } catch (error) {
      setProfile(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [hydrateProfile]);

  useEffect(() => {
    void loadProfile().catch(() => undefined);
    const supabase = getSupabaseClient();
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange(() => void loadProfile().catch(() => undefined));
    return () => data.subscription.unsubscribe();
  }, [loadProfile]);

  useEffect(() => {
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") void loadProfile().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", refreshOnVisible);
    return () => document.removeEventListener("visibilitychange", refreshOnVisible);
  }, [loadProfile]);

  const value = useMemo(() => ({
    profile,
    isLoading,
    updateProfile: (patch: Partial<Profile> | Profile) => setProfile((current) => {
      if (current) return { ...current, ...patch };
      return typeof patch.id === "string" ? patch as Profile : current;
    }),
    refreshProfile: loadProfile,
  }), [isLoading, loadProfile, profile]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used inside ProfileProvider");
  return context;
}
