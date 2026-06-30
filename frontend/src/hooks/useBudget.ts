import { useApiQuery } from "./useApiQuery";
import type { BudgetSummary } from "./types";

export function useBudget() {
  return useApiQuery<BudgetSummary>("/budget/summary");
}
