import { useApiQuery } from "./useApiQuery";
import type { ReportPeriod, ReportsSummary } from "./types";

export type ReportsFilters = {
  period: ReportPeriod;
  from?: string;
  to?: string;
};

export function useReports(filters: ReportsFilters) {
  const params = new URLSearchParams({ period: filters.period });

  if (filters.period === "custom" && filters.from && filters.to) {
    params.set("from", filters.from);
    params.set("to", filters.to);
  }

  return useApiQuery<ReportsSummary>(`/reports/summary?${params.toString()}`);
}
