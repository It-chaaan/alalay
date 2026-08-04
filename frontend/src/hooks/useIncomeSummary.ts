import { useApiQuery } from "./useApiQuery";

export type IncomeSummary = {
  this_month: number;
  ytd: number;
  average_month: number;
  sources: number;
};

export function useIncomeSummary(month?: string) {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return useApiQuery<IncomeSummary>(`/income/summary${query}`);
}
