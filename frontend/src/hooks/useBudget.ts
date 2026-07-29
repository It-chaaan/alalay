import { useApiQuery } from "./useApiQuery";
import type { BudgetSummary } from "./types";

export function useBudget(month?: string) {
  const params = new URLSearchParams();

  if (month) {
    params.set("month", month);
  }

  return useApiQuery<BudgetSummary>(`/budget/summary${params.size ? `?${params.toString()}` : ""}`);
}
