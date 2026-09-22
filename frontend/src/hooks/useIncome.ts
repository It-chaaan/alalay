import { useApiQuery } from './useApiQuery';
import type { IncomeMonth } from '../utils/incomeMonth';
export {
  incomeMonthEntries,
  type IncomeMonthEntry,
  type IncomeMonthItem,
  type IncomeMonth,
} from '../utils/incomeMonth';

export function useIncome(month: string) {
  return useApiQuery<IncomeMonth>(`/income/my-income?month=${encodeURIComponent(month)}`);
}
