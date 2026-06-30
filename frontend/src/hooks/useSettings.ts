import { useApiQuery } from "./useApiQuery";
import type { Profile } from "./types";

export function useSettings() {
  return useApiQuery<Profile>("/users/me");
}
