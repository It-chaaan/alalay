import { useApiQuery } from "./useApiQuery";
import type { ReportsSummary } from "./types";

export function useReports() {
  return useApiQuery<ReportsSummary>("/reports/summary");
}
