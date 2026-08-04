import type { IncomeEntry } from "../hooks/types";
import { buildIncomeOccurrences } from "./incomeRecurrence";

export type IncomeMonth = {
  key: string;
  month: string;
  total: number;
  current: boolean;
};

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function buildIncomeMonthlySeries(entries: IncomeEntry[], today: Date): IncomeMonth[] {
  const currentKey = getMonthKey(today);
  const rangeStart = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const rangeEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const occurrences = buildIncomeOccurrences(entries, getMonthKey(rangeStart) + "-01", getMonthKey(rangeEnd) + `-${String(rangeEnd.getDate()).padStart(2, "0")}`);

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
    const key = getMonthKey(date);
    const total = occurrences
      .filter((entry) => entry.date.startsWith(key))
      .reduce((sum, entry) => sum + Number(entry.amount), 0);

    return {
      key,
      month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(date),
      total,
      current: key === currentKey,
    };
  });
}
