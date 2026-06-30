import { useApiQuery } from "./useApiQuery";
import type { IncomeEntry } from "./types";

export function useIncome() {
  return useApiQuery<IncomeEntry[]>("/income");
}
