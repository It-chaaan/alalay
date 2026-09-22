import { todayIso } from './db.js';

export type AiDateRange = {
  start: string;
  end: string;
  label: string;
  period:
    | 'today'
    | 'yesterday'
    | 'this_week'
    | 'last_week'
    | 'this_month'
    | 'last_month'
    | 'month'
    | 'custom';
};

const monthNames = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

function dateParts(date: Date) {
  const value = todayIso(date);
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function dateOnly(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function shiftDays(value: string, amount: number) {
  const [year, month, day] = value.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + amount));
  return dateOnly(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

function monthRange(year: number, month: number) {
  const end = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: dateOnly(year, month, 1), end: dateOnly(year, month, end) };
}

function label(start: string, end: string) {
  return start === end ? start : `${start} to ${end}`;
}

export function resolveAiDateRange(message: string, now = new Date()): AiDateRange | null {
  const text = message.trim().toLowerCase();
  const today = todayIso(now);
  const current = dateParts(now);

  if (/\b(today|this day)\b/.test(text))
    return { start: today, end: today, label: 'today', period: 'today' };
  if (/\b(yesterday)\b/.test(text)) {
    const value = shiftDays(today, -1);
    return { start: value, end: value, label: 'yesterday', period: 'yesterday' };
  }

  const currentWeekStart = shiftDays(
    today,
    -(new Date(Date.UTC(current.year, current.month - 1, current.day)).getUTCDay() + 6) % 7,
  );
  if (/\b(this|current) week\b/.test(text))
    return { start: currentWeekStart, end: today, label: 'this week', period: 'this_week' };
  if (/\blast week\b/.test(text)) {
    const start = shiftDays(currentWeekStart, -7);
    return { start, end: shiftDays(currentWeekStart, -1), label: 'last week', period: 'last_week' };
  }

  const currentMonth = monthRange(current.year, current.month);
  if (/\b(this|current) month\b/.test(text))
    return { ...currentMonth, label: 'this month', period: 'this_month' };
  if (/\blast month\b/.test(text)) {
    const previous = new Date(Date.UTC(current.year, current.month - 2, 1));
    const range = monthRange(previous.getUTCFullYear(), previous.getUTCMonth() + 1);
    return { ...range, label: 'last month', period: 'last_month' };
  }

  const custom = text.match(
    /\b(20\d{2}-\d{2}-\d{2})\s+(?:to|through|until|-)\s+(20\d{2}-\d{2}-\d{2})\b/,
  );
  if (custom) {
    const [start, end] = custom.slice(1).sort();
    return { start, end, label: label(start, end), period: 'custom' };
  }

  const numericMonth = text.match(/\b(20\d{2})[-\/](0?[1-9]|1[0-2])\b/);
  const namedMonth = text.match(new RegExp(`\\b(${monthNames.join('|')})\\s+(20\\d{2})\\b`));
  if (numericMonth || namedMonth) {
    const year = Number(numericMonth?.[1] ?? namedMonth?.[2]);
    const month = Number(numericMonth?.[2] ?? monthNames.indexOf(namedMonth?.[1] ?? '') + 1);
    if (year && month) {
      const range = monthRange(year, month);
      return { ...range, label: `${year}-${String(month).padStart(2, '0')}`, period: 'month' };
    }
  }

  return null;
}
