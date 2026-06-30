import { useApiQuery } from "./useApiQuery";
import type { SavingsGoal } from "./types";

export function useSavingsGoals() {
  return useApiQuery<SavingsGoal[]>("/savings-goals");
}
