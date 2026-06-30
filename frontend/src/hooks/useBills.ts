import { useApiQuery } from "./useApiQuery";
import type { Bill } from "./types";

export function useBills() {
  return useApiQuery<Bill[]>("/bills");
}
