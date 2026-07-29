import { useApiQuery } from "./useApiQuery";
import type { SavingsDashboard, SavingsGoal } from "./types";

export function useSavingsGoals() {
  return useApiQuery<SavingsGoal[]>("/savings-goals");
}

export function useSavingsDashboard() {
  return useApiQuery<SavingsDashboard>("/savings-goals/summary");
}
