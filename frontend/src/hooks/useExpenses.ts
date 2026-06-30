import { useApiQuery } from "./useApiQuery";
import type { Expense } from "./types";

export function useExpenses() {
  return useApiQuery<Expense[]>("/expenses");
}
