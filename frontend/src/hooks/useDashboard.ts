import { useApiQuery } from "./useApiQuery";
import type { DashboardSummary } from "./types";

export function useDashboard() {
  return useApiQuery<DashboardSummary>("/dashboard/summary");
}
