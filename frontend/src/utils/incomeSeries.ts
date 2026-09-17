import type { IncomeEntry } from "../hooks/types";
import { buildIncomeOccurrences } from "./incomeRecurrence";

export type IncomeMonth = {
  key: string;
  month: string;
  total: number;
  current: boolean;
};

function getMonthParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
  };
}

export function getIncomeMonthKey(date: Date) {
  const { year, month } = getMonthParts(date);
  return `${year}-${String(month).padStart(2, '0')}`;
}

function monthDate(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1, 12));
}

export function buildIncomeMonthlySeries(entries: IncomeEntry[], today: Date): IncomeMonth[] {
  const { year, month } = getMonthParts(today);
  const currentKey = getIncomeMonthKey(today);
  const rangeStart = monthDate(year, month - 5);
  const rangeEnd = monthDate(year, month);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const occurrences = buildIncomeOccurrences(entries, getIncomeMonthKey(rangeStart) + "-01", getIncomeMonthKey(rangeEnd) + `-${lastDay}`);

  return Array.from({ length: 6 }, (_, index) => {
    const date = monthDate(year, month - (5 - index));
    const key = getIncomeMonthKey(date);
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
